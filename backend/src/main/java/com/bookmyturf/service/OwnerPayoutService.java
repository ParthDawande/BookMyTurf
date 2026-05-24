package com.bookmyturf.service;

import com.bookmyturf.dto.owner.OwnerPayoutListResponse;
import com.bookmyturf.model.Payout;
import com.bookmyturf.model.PayoutStatus;
import com.bookmyturf.model.User;
import com.bookmyturf.repository.PayoutRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class OwnerPayoutService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final PayoutRepository payoutRepository;

    public OwnerPayoutService(PayoutRepository payoutRepository) {
        this.payoutRepository = payoutRepository;
    }

    public OwnerPayoutListResponse listPayouts(User owner, String statusParam,
                                               String fromDateStr, String toDateStr,
                                               int page, int pageSize) {
        int size = Math.min(Math.max(pageSize, 1), 50);
        int pg = Math.max(page, 1);
        PageRequest pr = PageRequest.of(pg - 1, size);

        PayoutStatus status = statusParam != null ? parseStatus(statusParam) : null;

        // IST date-range bounds → UTC LocalDateTime for column comparison.
        // scheduled_at is stored as UTC LocalDateTime (JDBC serverTimezone=UTC).
        LocalDateTime from = null, to = null;
        if (fromDateStr != null || toDateStr != null) {
            try {
                if (fromDateStr != null) {
                    from = LocalDate.parse(fromDateStr).atStartOfDay(IST)
                            .withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
                }
                if (toDateStr != null) {
                    to = LocalDate.parse(toDateStr).atTime(23, 59, 59, 999_999_999)
                            .atZone(IST).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
                }
            } catch (DateTimeParseException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid date format (expected YYYY-MM-DD)");
            }
        }

        Page<Payout> result = queryPage(owner.getId(), status, from, to, pr);
        int totalPages = (int) Math.max(1, Math.ceil((double) result.getTotalElements() / size));
        List<OwnerPayoutListResponse.PayoutItem> items = result.getContent().stream()
                .map(this::toItem).collect(Collectors.toList());
        return new OwnerPayoutListResponse(pg, size, result.getTotalElements(), totalPages, items);
    }

    public OwnerPayoutListResponse.PayoutItem getPayoutDetail(User owner, Long payoutId) {
        Payout payout = payoutRepository.findById(payoutId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payout not found"));
        if (!payout.getOwner().getId().equals(owner.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Payout not found");
        }
        return toItem(payout);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private Page<Payout> queryPage(Long ownerId, PayoutStatus status,
                                   LocalDateTime from, LocalDateTime to, PageRequest pr) {
        boolean hasStatus = status != null;
        boolean hasRange = from != null || to != null;

        // Fill missing bound with a sentinel so the query always gets both params.
        LocalDateTime effectiveFrom = from != null ? from : LocalDateTime.MIN;
        LocalDateTime effectiveTo   = to   != null ? to   : LocalDateTime.MAX;

        if (hasStatus && hasRange) {
            return payoutRepository.findByOwnerIdAndStatusAndDateRange(ownerId, status, effectiveFrom, effectiveTo, pr);
        } else if (hasStatus) {
            return payoutRepository.findByOwnerIdAndStatus(ownerId, status, pr);
        } else if (hasRange) {
            return payoutRepository.findByOwnerIdAndDateRange(ownerId, effectiveFrom, effectiveTo, pr);
        } else {
            return payoutRepository.findByOwnerId(ownerId, pr);
        }
    }

    private OwnerPayoutListResponse.PayoutItem toItem(Payout p) {
        String turfName = p.getBooking().getSubCourt().getTurf().getName();
        String bookingDate = p.getBooking().getBookingDate().toString();
        return new OwnerPayoutListResponse.PayoutItem(
                p.getId(),
                p.getBooking().getId(),
                turfName,
                bookingDate,
                p.getAmount(),
                p.getStatus().name(),
                p.getScheduledAt() != null ? p.getScheduledAt().toString() : null,
                p.getPaidAt() != null ? p.getPaidAt().toString() : null
        );
    }

    private PayoutStatus parseStatus(String s) {
        try {
            return PayoutStatus.valueOf(s.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid status: " + s + ". Must be PENDING, PAID, or CANCELLED");
        }
    }
}
