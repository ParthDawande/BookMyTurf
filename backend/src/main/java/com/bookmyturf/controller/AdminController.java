package com.bookmyturf.controller;

import com.bookmyturf.dto.admin.AdminListResponse;
import com.bookmyturf.dto.admin.CreateAccountRequest;
import com.bookmyturf.dto.admin.CreateAdminResponse;
import com.bookmyturf.dto.admin.CreateStaffResponse;
import com.bookmyturf.dto.admin.PendingSubCourtListResponse;
import com.bookmyturf.dto.admin.PendingTurfListResponse;
import com.bookmyturf.dto.admin.ReasonRequest;
import com.bookmyturf.dto.admin.RemoveAdminResponse;
import com.bookmyturf.dto.admin.SubCourtApprovalResponse;
import com.bookmyturf.dto.admin.TurfApprovalResponse;
import com.bookmyturf.dto.admin.UserStatusChangeResponse;
import com.bookmyturf.model.User;
import com.bookmyturf.service.AdminService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    // -------------------------------------------------------------------------
    // Admin account management
    // -------------------------------------------------------------------------

    @PostMapping("/admins")
    @ResponseStatus(HttpStatus.CREATED)
    public CreateAdminResponse createAdmin(@Valid @RequestBody CreateAccountRequest req) {
        return adminService.createAdmin(req);
    }

    @GetMapping("/admins")
    public AdminListResponse listAdmins(@AuthenticationPrincipal User caller,
                                         @RequestParam(required = false) String search,
                                         @RequestParam(name = "sort_by", defaultValue = "created_desc") String sortBy,
                                         @RequestParam(defaultValue = "1") int page,
                                         @RequestParam(name = "page_size", defaultValue = "20") int pageSize) {
        return adminService.listAdmins(caller, search, sortBy, page, pageSize);
    }

    @DeleteMapping("/admins/{id}")
    public RemoveAdminResponse removeAdmin(@AuthenticationPrincipal User caller,
                                            @PathVariable Long id) {
        return adminService.removeAdmin(caller, id);
    }

    // -------------------------------------------------------------------------
    // Staff account creation
    // -------------------------------------------------------------------------

    @PostMapping("/staff")
    @ResponseStatus(HttpStatus.CREATED)
    public CreateStaffResponse createStaff(@AuthenticationPrincipal User caller,
                                            @Valid @RequestBody CreateAccountRequest req) {
        return adminService.createStaff(caller, req);
    }

    // -------------------------------------------------------------------------
    // User status management
    // -------------------------------------------------------------------------

    @PutMapping("/users/{id}/suspend")
    public UserStatusChangeResponse suspendUser(@PathVariable Long id,
                                                 @RequestBody(required = false) ReasonRequest req) {
        return adminService.suspendUser(id, req);
    }

    @PutMapping("/users/{id}/ban")
    public UserStatusChangeResponse banUser(@PathVariable Long id,
                                             @RequestBody(required = false) ReasonRequest req) {
        return adminService.banUser(id, req);
    }

    @PutMapping("/users/{id}/activate")
    public UserStatusChangeResponse activateUser(@PathVariable Long id,
                                                  @RequestBody(required = false) ReasonRequest req) {
        return adminService.activateUser(id, req);
    }

    // -------------------------------------------------------------------------
    // Turf moderation
    // -------------------------------------------------------------------------

    @GetMapping("/turfs/pending")
    public PendingTurfListResponse listPendingTurfs(@RequestParam(required = false) String city,
                                                     @RequestParam(name = "sort_by", defaultValue = "created_asc") String sortBy,
                                                     @RequestParam(defaultValue = "1") int page,
                                                     @RequestParam(name = "page_size", defaultValue = "20") int pageSize) {
        return adminService.listPendingTurfs(city, sortBy, page, pageSize);
    }

    @PutMapping("/turfs/{id}/approve")
    public TurfApprovalResponse approveTurf(@PathVariable Long id) {
        return adminService.approveTurf(id);
    }

    @PutMapping("/turfs/{id}/reject")
    public TurfApprovalResponse rejectTurf(@PathVariable Long id,
                                            @RequestBody(required = false) ReasonRequest req) {
        return adminService.rejectTurf(id, req);
    }

    // -------------------------------------------------------------------------
    // Sub-court moderation
    // -------------------------------------------------------------------------

    @GetMapping("/sub-courts/pending")
    public PendingSubCourtListResponse listPendingSubCourts(
            @RequestParam(name = "turf_id", required = false) Long turfId,
            @RequestParam(required = false) String city,
            @RequestParam(name = "sort_by", defaultValue = "created_asc") String sortBy,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(name = "page_size", defaultValue = "20") int pageSize) {
        return adminService.listPendingSubCourts(turfId, city, sortBy, page, pageSize);
    }

    @PutMapping("/sub-courts/{id}/approve")
    public SubCourtApprovalResponse approveSubCourt(@PathVariable Long id) {
        return adminService.approveSubCourt(id);
    }

    @PutMapping("/sub-courts/{id}/reject")
    public SubCourtApprovalResponse rejectSubCourt(@PathVariable Long id,
                                                    @RequestBody(required = false) ReasonRequest req) {
        return adminService.rejectSubCourt(id, req);
    }
}
