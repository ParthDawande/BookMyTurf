package com.bookmyturf.controller;

import com.bookmyturf.dto.admin.*;
import com.bookmyturf.dto.customer.*;
import com.bookmyturf.dto.staff.*;
import com.bookmyturf.model.User;
import com.bookmyturf.service.QueryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class QueryController {

    private final QueryService queryService;

    public QueryController(QueryService queryService) {
        this.queryService = queryService;
    }

    // ── Customer endpoints ────────────────────────────────────────────────────

    @PostMapping("/api/customer/queries")
    public ResponseEntity<CustomerQueryDetailResponse> createQuery(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody CreateQueryRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(queryService.createQuery(user, req));
    }

    @GetMapping("/api/customer/queries")
    public ResponseEntity<QueryListResponse> listCustomerQueries(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        return ResponseEntity.ok(queryService.listCustomerQueries(user, page, pageSize));
    }

    @GetMapping("/api/customer/queries/{id}")
    public ResponseEntity<CustomerQueryDetailResponse> getCustomerQuery(
            @AuthenticationPrincipal User user,
            @PathVariable Long id) {
        return ResponseEntity.ok(queryService.getCustomerQuery(user, id));
    }

    // ── Staff endpoints ───────────────────────────────────────────────────────

    @GetMapping("/api/staff/queries")
    public ResponseEntity<StaffQueryListResponse> listStaffQueries(
            @AuthenticationPrincipal User staff,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "false") boolean mine) {
        return ResponseEntity.ok(queryService.listStaffQueries(staff, status, mine));
    }

    @GetMapping("/api/staff/queries/{id}")
    public ResponseEntity<StaffQueryDetailResponse> getStaffQuery(
            @AuthenticationPrincipal User staff,
            @PathVariable Long id) {
        return ResponseEntity.ok(queryService.getStaffQuery(staff, id));
    }

    @PostMapping("/api/staff/queries/{id}/claim")
    public ResponseEntity<ClaimQueryResponse> claimQuery(
            @AuthenticationPrincipal User staff,
            @PathVariable Long id) {
        return ResponseEntity.ok(queryService.claimQuery(staff, id));
    }

    @PostMapping("/api/staff/queries/{id}/notes")
    public ResponseEntity<AddNoteResponse> staffAddNote(
            @AuthenticationPrincipal User staff,
            @PathVariable Long id,
            @Valid @RequestBody AddNoteRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(queryService.staffAddQueryNote(staff, id, req));
    }

    @PostMapping("/api/staff/queries/{id}/resolve")
    public ResponseEntity<ResolveQueryResponse> staffResolve(
            @AuthenticationPrincipal User staff,
            @PathVariable Long id,
            @Valid @RequestBody StaffResolveRequest req) {
        return ResponseEntity.ok(queryService.staffResolveQuery(staff, id, req));
    }

    // ── Admin endpoints ───────────────────────────────────────────────────────

    @GetMapping("/api/admin/queries")
    public ResponseEntity<AdminQueryListResponse> listAdminQueries(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(name = "page_size", defaultValue = "10") int pageSize) {
        return ResponseEntity.ok(queryService.listAdminQueries(status, page, pageSize));
    }

    @GetMapping("/api/admin/queries/{id}")
    public ResponseEntity<AdminQueryDetailResponse> getAdminQuery(
            @PathVariable Long id) {
        return ResponseEntity.ok(queryService.getAdminQuery(id));
    }

    @PostMapping("/api/admin/queries/{id}/resolve")
    public ResponseEntity<ResolveQueryResponse> adminResolve(
            @AuthenticationPrincipal User admin,
            @PathVariable Long id,
            @Valid @RequestBody ResolveQueryRequest req) {
        return ResponseEntity.ok(queryService.adminResolveQuery(admin, id, req));
    }

    @PostMapping("/api/admin/queries/{id}/notes")
    public ResponseEntity<AddNoteResponse> adminAddNote(
            @AuthenticationPrincipal User admin,
            @PathVariable Long id,
            @Valid @RequestBody AddNoteRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(queryService.adminAddQueryNote(admin, id, req));
    }
}
