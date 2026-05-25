package com.bookmyturf.service;

import com.bookmyturf.dto.owner.OwnerDashboardResponse;
import com.bookmyturf.model.BookingStatus;
import com.bookmyturf.model.PayoutStatus;
import com.bookmyturf.model.User;
import com.bookmyturf.repository.BookingRepository;
import com.bookmyturf.repository.PayoutRepository;
import com.bookmyturf.repository.TurfRepository;
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
public class OwnerDashboardService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final List<BookingStatus> REVENUE_STATUSES =
            List.of(BookingStatus.CONFIRMED, BookingStatus.COMPLETED);

    private final BookingRepository bookingRepository;
    private final PayoutRepository payoutRepository;
    private final TurfRepository turfRepository;

    public OwnerDashboardService(BookingRepository bookingRepository,
                                  PayoutRepository payoutRepository,
                                  TurfRepository turfRepository) {
        this.bookingRepository = bookingRepository;
        this.payoutRepository = payoutRepository;
        this.turfRepository = turfRepository;
    }

    public OwnerDashboardResponse getDashboard(User owner, String fromDateStr, String toDateStr, Long turfId) {
        // 404 no-leak: wrong-owner or nonexistent turf_id both return 404
        if (turfId != null) {
            turfRepository.findByIdAndOwnerId(turfId, owner.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Turf not found"));
        }

        // booking_date is stored as LocalDate → compare directly with LocalDate bounds (no TZ conversion).
        LocalDate fromDate = parseDateOrNull(fromDateStr);
        LocalDate toDate   = parseDateOrNull(toDateStr);

        // scheduled_at is stored as UTC LocalDateTime → convert IST date bounds to UTC.
        // Same from_date/to_date params applied to bookings (booking_date) and payouts (scheduled_at).
        LocalDateTime payoutFrom = toUtcStart(fromDateStr);
        LocalDateTime payoutTo   = toUtcEnd(toDateStr);

        Map<String, Long> bookingsByStatus = buildStatusCountMap(
                bookingRepository.countByStatusForOwner(owner.getId(), turfId, fromDate, toDate));

        List<Object[]> revRows = bookingRepository.revenueByOwner(
                owner.getId(), REVENUE_STATUSES, turfId, fromDate, toDate);
        Object[] rev = revRows.isEmpty() ? new Object[]{null, null} : revRows.get(0);
        BigDecimal totalRevenue     = asBigDecimal(rev[0]);
        BigDecimal totalCommission  = asBigDecimal(rev[1]);
        BigDecimal ownerPayoutTotal = totalRevenue.subtract(totalCommission);

        OwnerDashboardResponse.PayoutsSummary payoutsSummary = buildPayoutsSummary(
                payoutRepository.payoutSummaryByOwner(owner.getId(), payoutFrom, payoutTo));

        OwnerDashboardResponse.Filters filters =
                new OwnerDashboardResponse.Filters(fromDateStr, toDateStr, turfId);

        return new OwnerDashboardResponse(
                totalRevenue, totalCommission, ownerPayoutTotal,
                bookingsByStatus, payoutsSummary, filters);
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
        // Pre-seed all four statuses with 0 so they always appear in the response.
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

    private OwnerDashboardResponse.PayoutsSummary buildPayoutsSummary(List<Object[]> rows) {
        // Pre-seed PENDING/PAID/CANCELLED with 0; FAILED payouts are not surfaced in this summary.
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
        return new OwnerDashboardResponse.PayoutsSummary(
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
