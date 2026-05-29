package com.bookmyturf.controller;

import com.bookmyturf.dto.admin.*;
import com.bookmyturf.dto.customer.*;
import com.bookmyturf.dto.staff.*;
import com.bookmyturf.model.User;
import com.bookmyturf.service.ComplaintService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class ComplaintController {

    private final ComplaintService complaintService;

    public ComplaintController(ComplaintService complaintService) {
        this.complaintService = complaintService;
    }

    // ── Customer endpoints ────────────────────────────────────────────────────

    @PostMapping("/api/customer/complaints")
    public ResponseEntity<CustomerComplaintDetailResponse> createComplaint(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody CreateComplaintRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(complaintService.createComplaint(user, req));
    }

    @GetMapping("/api/customer/complaints")
    public ResponseEntity<ComplaintListResponse> listCustomerComplaints(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        return ResponseEntity.ok(complaintService.listCustomerComplaints(user, page, pageSize));
    }

    @GetMapping("/api/customer/complaints/{id}")
    public ResponseEntity<CustomerComplaintDetailResponse> getCustomerComplaint(
            @AuthenticationPrincipal User user,
            @PathVariable Long id) {
        return ResponseEntity.ok(complaintService.getCustomerComplaint(user, id));
    }

    // ── Admin endpoints ───────────────────────────────────────────────────────

    @GetMapping("/api/admin/complaints")
    public ResponseEntity<AdminComplaintListResponse> listAdminComplaints(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(name = "page_size", defaultValue = "10") int pageSize) {
        return ResponseEntity.ok(complaintService.listAdminComplaints(status, page, pageSize));
    }

    @GetMapping("/api/admin/complaints/{id}")
    public ResponseEntity<AdminComplaintDetailResponse> getAdminComplaint(
            @PathVariable Long id) {
        return ResponseEntity.ok(complaintService.getAdminComplaint(id));
    }

    @PostMapping("/api/admin/complaints/{id}/assign")
    public ResponseEntity<AssignComplaintResponse> assignComplaint(
            @AuthenticationPrincipal User admin,
            @PathVariable Long id,
            @Valid @RequestBody AssignComplaintRequest req) {
        return ResponseEntity.ok(complaintService.assignComplaint(admin, id, req));
    }

    @PostMapping("/api/admin/complaints/{id}/resolve")
    public ResponseEntity<ResolveComplaintResponse> adminResolve(
            @AuthenticationPrincipal User admin,
            @PathVariable Long id,
            @Valid @RequestBody ResolveComplaintRequest req) {
        return ResponseEntity.ok(complaintService.resolveComplaint(admin, id, req));
    }

    @PostMapping("/api/admin/complaints/{id}/notes")
    public ResponseEntity<AddNoteResponse> adminAddNote(
            @AuthenticationPrincipal User admin,
            @PathVariable Long id,
            @Valid @RequestBody AddNoteRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(complaintService.adminAddNote(admin, id, req));
    }

    // ── Staff endpoints ───────────────────────────────────────────────────────

    @GetMapping("/api/staff/complaints")
    public ResponseEntity<StaffComplaintListResponse> listStaffComplaints(
            @AuthenticationPrincipal User staff) {
        return ResponseEntity.ok(complaintService.listStaffComplaints(staff));
    }

    @GetMapping("/api/staff/complaints/{id}")
    public ResponseEntity<StaffComplaintDetailResponse> getStaffComplaint(
            @AuthenticationPrincipal User staff,
            @PathVariable Long id) {
        return ResponseEntity.ok(complaintService.getStaffComplaint(staff, id));
    }

    @PostMapping("/api/staff/complaints/{id}/notes")
    public ResponseEntity<AddNoteResponse> staffAddNote(
            @AuthenticationPrincipal User staff,
            @PathVariable Long id,
            @Valid @RequestBody AddNoteRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(complaintService.staffAddNote(staff, id, req));
    }

    @PostMapping("/api/staff/complaints/{id}/resolve")
    public ResponseEntity<ResolveComplaintResponse> staffResolve(
            @AuthenticationPrincipal User staff,
            @PathVariable Long id,
            @Valid @RequestBody StaffResolveRequest req) {
        return ResponseEntity.ok(complaintService.staffResolve(staff, id, req));
    }
}
