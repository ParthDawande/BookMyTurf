package com.bookmyturf.controller;

import com.bookmyturf.dto.admin.AdminDashboardResponse;
import com.bookmyturf.service.AdminDashboardService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AdminDashboardController {

    private final AdminDashboardService adminDashboardService;

    public AdminDashboardController(AdminDashboardService adminDashboardService) {
        this.adminDashboardService = adminDashboardService;
    }

    @GetMapping("/api/admin/dashboard")
    public ResponseEntity<AdminDashboardResponse> getDashboard(
            @RequestParam(name = "from_date", required = false) String fromDate,
            @RequestParam(name = "to_date",   required = false) String toDate) {
        return ResponseEntity.ok(adminDashboardService.getDashboard(fromDate, toDate));
    }
}
