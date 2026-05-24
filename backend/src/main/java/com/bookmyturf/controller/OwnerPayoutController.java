package com.bookmyturf.controller;

import com.bookmyturf.dto.owner.OwnerPayoutListResponse;
import com.bookmyturf.model.User;
import com.bookmyturf.service.OwnerPayoutService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class OwnerPayoutController {

    private final OwnerPayoutService ownerPayoutService;

    public OwnerPayoutController(OwnerPayoutService ownerPayoutService) {
        this.ownerPayoutService = ownerPayoutService;
    }

    @GetMapping("/api/owner/payouts")
    public ResponseEntity<OwnerPayoutListResponse> listPayouts(
            @AuthenticationPrincipal User owner,
            @RequestParam(required = false) String status,
            @RequestParam(name = "from_date", required = false) String fromDate,
            @RequestParam(name = "to_date", required = false) String toDate,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        return ResponseEntity.ok(ownerPayoutService.listPayouts(owner, status, fromDate, toDate, page, pageSize));
    }

    @GetMapping("/api/owner/payouts/{id}")
    public ResponseEntity<OwnerPayoutListResponse.PayoutItem> getPayoutDetail(
            @AuthenticationPrincipal User owner,
            @PathVariable Long id) {
        return ResponseEntity.ok(ownerPayoutService.getPayoutDetail(owner, id));
    }
}
