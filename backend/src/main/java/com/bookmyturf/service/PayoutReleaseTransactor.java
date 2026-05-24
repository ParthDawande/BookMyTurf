package com.bookmyturf.service;

import com.bookmyturf.model.Notification;
import com.bookmyturf.model.Payout;
import com.bookmyturf.model.PayoutStatus;
import com.bookmyturf.repository.NotificationRepository;
import com.bookmyturf.repository.PayoutRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;

/**
 * Handles the per-payout flip inside its own REQUIRES_NEW transaction so that
 * a failure on one payout does not roll back sibling payouts processed in the
 * same releaseEligiblePayouts() invocation.
 */
@Service
public class PayoutReleaseTransactor {

    private static final Logger log = LoggerFactory.getLogger(PayoutReleaseTransactor.class);

    private final PayoutRepository payoutRepository;
    private final NotificationRepository notificationRepository;

    public PayoutReleaseTransactor(PayoutRepository payoutRepository,
                                   NotificationRepository notificationRepository) {
        this.payoutRepository = payoutRepository;
        this.notificationRepository = notificationRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean releaseSinglePayout(Long payoutId) {
        // SELECT ... FOR UPDATE — serializes against concurrent cancel touching same row.
        Payout payout = payoutRepository.findByIdForUpdate(payoutId).orElse(null);
        if (payout == null) return false;

        // Re-read status under lock — if cancelled or already paid, skip.
        if (payout.getStatus() != PayoutStatus.PENDING) {
            log.info("Payout {} skipped (status={} under lock)", payoutId, payout.getStatus());
            return false;
        }

        // Defensive: re-read scheduled_at under lock. Convert via explicit IST zone so
        // the comparison is zone-explicit and independent of JVM default zone.
        Instant scheduledInstant = payout.getScheduledAt()
                .atZone(ZoneId.of("Asia/Kolkata")).toInstant();
        if (scheduledInstant.isAfter(Instant.now())) {
            log.info("Payout {} skipped (scheduled_at={} still in future)", payoutId, payout.getScheduledAt());
            return false;
        }

        payout.setStatus(PayoutStatus.PAID);
        payout.setPaidAt(LocalDateTime.now(ZoneOffset.UTC));
        payoutRepository.save(payout);

        Notification notif = new Notification();
        notif.setUser(payout.getOwner());
        notif.setType("PAYOUT_RELEASED");
        notif.setMessage("Payout of ₹" + payout.getAmount()
                + " for booking #" + payout.getBooking().getId() + " has been released.");
        notificationRepository.save(notif);

        log.info("Payout {} released (booking={}, amount={})", payoutId,
                payout.getBooking().getId(), payout.getAmount());
        return true;
    }
}
