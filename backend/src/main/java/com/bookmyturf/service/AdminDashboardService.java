package com.bookmyturf.service;

import com.bookmyturf.dto.admin.AdminDashboardResponse;
import com.bookmyturf.model.BookingStatus;
import com.bookmyturf.model.PayoutStatus;
import com.bookmyturf.model.Role;
import com.bookmyturf.model.SupportTicketStatus;
import com.bookmyturf.model.UserStatus;
import com.bookmyturf.repository.BookingRepository;
import com.bookmyturf.repository.ComplaintRepository;
import com.bookmyturf.repository.CustomerQueryRepository;
import com.bookmyturf.repository.PayoutRepository;
import com.bookmyturf.repository.SubCourtRepository;
import com.bookmyturf.repository.TurfRepository;
import com.bookmyturf.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class AdminDashboardService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final List<BookingStatus> REVENUE_STATUSES =
            List.of(BookingStatus.CONFIRMED, BookingStatus.COMPLETED);
    private static final List<SupportTicketStatus> OPEN_STATUSES =
            List.of(SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS);

    private final BookingRepository bookingRepository;
    private final PayoutRepository payoutRepository;
    private final TurfRepository turfRepository;
    private final SubCourtRepository subCourtRepository;
    private final ComplaintRepository complaintRepository;
    private final CustomerQueryRepository customerQueryRepository;
    private final UserRepository userRepository;

    public AdminDashboardService(BookingRepository bookingRepository,
                                  PayoutRepository payoutRepository,
                                  TurfRepository turfRepository,
                                  SubCourtRepository subCourtRepository,
                                  ComplaintRepository complaintRepository,
                                  CustomerQueryRepository customerQueryRepository,
                                  UserRepository userRepository) {
        this.bookingRepository = bookingRepository;
        this.payoutRepository = payoutRepository;
        this.turfRepository = turfRepository;
        this.subCourtRepository = subCourtRepository;
        this.complaintRepository = complaintRepository;
        this.customerQueryRepository = customerQueryRepository;
        this.userRepository = userRepository;
    }

    public AdminDashboardResponse getDashboard(String fromDateStr, String toDateStr) {
        // booking_date is LocalDate → compare directly (no TZ conversion).
        LocalDate fromDate = parseDateOrNull(fromDateStr);
        LocalDate toDate   = parseDateOrNull(toDateStr);

        // scheduled_at is UTC LocalDateTime → convert IST date bounds to UTC Instant bounds.
        LocalDateTime payoutFrom = toUtcStart(fromDateStr);
        LocalDateTime payoutTo   = toUtcEnd(toDateStr);

        // ── Booking aggregations (filtered by booking_date) ───────────────────
        Map<String, Long> bookingsByStatus = buildStatusCountMap(
                bookingRepository.countByStatusPlatformWide(fromDate, toDate));

        List<Object[]> revRows = bookingRepository.revenuePlatformWide(REVENUE_STATUSES, fromDate, toDate);
        Object[] rev = revRows.isEmpty() ? new Object[]{null, null} : revRows.get(0);
        BigDecimal totalRevenue      = asBigDecimal(rev[0]);
        BigDecimal platformCommission = asBigDecimal(rev[1]);
        BigDecimal ownersPayoutTotal  = totalRevenue.subtract(platformCommission);

        // ── Payout aggregations (filtered by scheduled_at IST bounds) ─────────
        AdminDashboardResponse.PayoutsSummary payoutsSummary = buildPayoutsSummary(
                payoutRepository.payoutSummaryPlatformWide(payoutFrom, payoutTo));

        // ── Snapshot fields — NO date filter (current operational state) ──────
        AdminDashboardResponse.PendingApprovals pendingApprovals =
                new AdminDashboardResponse.PendingApprovals(
                        turfRepository.countPending(),
                        subCourtRepository.countPending());

        long openComplaints = complaintRepository.countByStatusIn(OPEN_STATUSES);
        long openQueries    = customerQueryRepository.countByStatusIn(OPEN_STATUSES);

        AdminDashboardResponse.ActiveUsers activeUsers =
                new AdminDashboardResponse.ActiveUsers(
                        userRepository.countByRoleAndStatus(Role.CUSTOMER, UserStatus.ACTIVE),
                        userRepository.countByRoleAndStatus(Role.OWNER,    UserStatus.ACTIVE),
                        userRepository.countByRoleAndStatus(Role.STAFF,    UserStatus.ACTIVE));

        AdminDashboardResponse.Filters filters =
                new AdminDashboardResponse.Filters(fromDateStr, toDateStr);

        return new AdminDashboardResponse(
                totalRevenue, platformCommission, ownersPayoutTotal,
                bookingsByStatus, payoutsSummary,
                pendingApprovals, openComplaints, openQueries,
                activeUsers, filters);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private LocalDate parseDateOrNull(String s) {
        if (s == null) return null;
        try {
            return LocalDate.parse(s);
        } catch (DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid date format (expected YYYY-MM-DD)");
        }
    }

    private LocalDateTime toUtcStart(String s) {
        if (s == null) return null;
        try {
            return LocalDate.parse(s).atStartOfDay(IST)
                    .withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        } catch (DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid date format (expected YYYY-MM-DD)");
        }
    }

    private LocalDateTime toUtcEnd(String s) {
        if (s == null) return null;
        try {
            return LocalDate.parse(s).atTime(23, 59, 59, 999_999_999)
                    .atZone(IST).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        } catch (DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid date format (expected YYYY-MM-DD)");
        }
    }

    private Map<String, Long> buildStatusCountMap(List<Object[]> rows) {
        Map<String, Long> map = new LinkedHashMap<>();
        map.put("CONFIRMED", 0L);
        map.put("COMPLETED", 0L);
        map.put("CANCELLED", 0L);
        map.put("REFUNDED",  0L);
        for (Object[] row : rows) {
            BookingStatus status = (BookingStatus) row[0];
            Long count = (Long) row[1];
            map.put(status.name(), count);
        }
        return map;
    }

    private AdminDashboardResponse.PayoutsSummary buildPayoutsSummary(List<Object[]> rows) {
        Map<PayoutStatus, BigDecimal> map = new EnumMap<>(PayoutStatus.class);
        map.put(PayoutStatus.PENDING,   BigDecimal.ZERO);
        map.put(PayoutStatus.PAID,      BigDecimal.ZERO);
        map.put(PayoutStatus.CANCELLED, BigDecimal.ZERO);
        for (Object[] row : rows) {
            PayoutStatus status = (PayoutStatus) row[0];
            if (map.containsKey(status)) {
                map.put(status, asBigDecimal(row[1]));
            }
        }
        return new AdminDashboardResponse.PayoutsSummary(
                map.get(PayoutStatus.PENDING),
                map.get(PayoutStatus.PAID),
                map.get(PayoutStatus.CANCELLED));
    }

    private BigDecimal asBigDecimal(Object val) {
        if (val == null) return BigDecimal.ZERO;
        if (val instanceof BigDecimal bd) return bd;
        if (val instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        return BigDecimal.ZERO;
    }
}
