package com.bookmyturf.service;

import com.bookmyturf.model.Payout;
import com.bookmyturf.repository.PayoutRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class PayoutReleaseService {

    private static final Logger log = LoggerFactory.getLogger(PayoutReleaseService.class);

    private final PayoutRepository payoutRepository;
    private final PayoutReleaseTransactor transactor;

    public PayoutReleaseService(PayoutRepository payoutRepository,
                                PayoutReleaseTransactor transactor) {
        this.payoutRepository = payoutRepository;
        this.transactor = transactor;
    }

    /**
     * Finds all PENDING payouts whose scheduled_at <= now and releases each one
     * in its own REQUIRES_NEW transaction via PayoutReleaseTransactor.
     *
     * Candidate query: native SQL "WHERE scheduled_at <= UTC_TIMESTAMP()" so
     * MySQL's server-side UTC comparison is used directly, avoiding JDBC
     * LocalDateTime parameter timezone-conversion artifacts.
     *
     * Per-payout lock: SELECT ... FOR UPDATE in PayoutReleaseTransactor.
     * Re-check under lock converts scheduledAt via ZoneId.of("Asia/Kolkata")
     * to Instant for a zone-explicit comparison against Instant.now().
     */
    @Transactional(readOnly = true)
    public ReleaseResult releaseEligiblePayouts() {
        List<Payout> candidates = payoutRepository.findEligible();
        log.info("PayoutRelease: {} candidate(s) found", candidates.size());

        List<Long> releasedIds = new ArrayList<>();
        for (Payout candidate : candidates) {
            try {
                if (transactor.releaseSinglePayout(candidate.getId())) {
                    releasedIds.add(candidate.getId());
                }
            } catch (Exception e) {
                log.error("PayoutRelease: failed to release payout {}: {}", candidate.getId(), e.getMessage());
            }
        }

        log.info("PayoutRelease: {}/{} payout(s) released", releasedIds.size(), candidates.size());
        return new ReleaseResult(releasedIds.size(), releasedIds);
    }

    public record ReleaseResult(int count, List<Long> ids) {}
}
