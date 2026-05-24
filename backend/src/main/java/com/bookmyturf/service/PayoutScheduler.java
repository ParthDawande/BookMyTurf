package com.bookmyturf.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Wraps PayoutReleaseService.releaseEligiblePayouts() in a @Scheduled task.
 * This bean is NOT created unless app.payout.scheduler.enabled=true — which
 * is NOT set in tracked application.properties (default=false). The scheduler
 * is disabled in v1 and can be enabled via application-local.properties for
 * testing or in a future v2 deployment.
 */
@Component
@ConditionalOnProperty(name = "app.payout.scheduler.enabled", havingValue = "true")
public class PayoutScheduler {

    private static final Logger log = LoggerFactory.getLogger(PayoutScheduler.class);

    private final PayoutReleaseService payoutReleaseService;

    public PayoutScheduler(PayoutReleaseService payoutReleaseService) {
        this.payoutReleaseService = payoutReleaseService;
        log.info("PayoutRelease scheduler registered (enabled=true)");
    }

    @Scheduled(fixedRateString = "${app.payout.scheduler.fixed-rate-ms}")
    public void run() {
        log.info("PayoutRelease scheduler firing");
        PayoutReleaseService.ReleaseResult result = payoutReleaseService.releaseEligiblePayouts();
        log.info("PayoutRelease scheduler done: {} payout(s) released", result.count());
    }
}
