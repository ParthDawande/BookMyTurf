package com.bookmyturf.controller;

import com.bookmyturf.dto.admin.RunReleaseResponse;
import com.bookmyturf.service.PayoutReleaseService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AdminPayoutController {

    private final PayoutReleaseService payoutReleaseService;

    public AdminPayoutController(PayoutReleaseService payoutReleaseService) {
        this.payoutReleaseService = payoutReleaseService;
    }

    @PostMapping("/api/admin/payouts/run-release")
    public ResponseEntity<RunReleaseResponse> runRelease() {
        PayoutReleaseService.ReleaseResult result = payoutReleaseService.releaseEligiblePayouts();
        return ResponseEntity.ok(new RunReleaseResponse(result.count(), result.ids()));
    }
}
