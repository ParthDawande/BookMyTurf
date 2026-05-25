package com.bookmyturf.controller;

import com.bookmyturf.dto.owner.OwnerDashboardResponse;
import com.bookmyturf.model.User;
import com.bookmyturf.service.OwnerDashboardService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class OwnerDashboardController {

    private final OwnerDashboardService ownerDashboardService;

    public OwnerDashboardController(OwnerDashboardService ownerDashboardService) {
        this.ownerDashboardService = ownerDashboardService;
    }

    @GetMapping("/api/owner/dashboard")
    public ResponseEntity<OwnerDashboardResponse> getDashboard(
            @AuthenticationPrincipal User owner,
            @RequestParam(name = "from_date", required = false) String fromDate,
            @RequestParam(name = "to_date",   required = false) String toDate,
            @RequestParam(name = "turf_id",   required = false) Long turfId) {
        return ResponseEntity.ok(ownerDashboardService.getDashboard(owner, fromDate, toDate, turfId));
    }
}
