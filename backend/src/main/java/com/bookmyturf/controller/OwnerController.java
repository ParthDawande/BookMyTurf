package com.bookmyturf.controller;

import com.bookmyturf.dto.owner.AddPhotoRequest;
import com.bookmyturf.dto.owner.CreateTurfRequest;
import com.bookmyturf.dto.owner.OwnerProfileResponse;
import com.bookmyturf.dto.owner.PhotoResponse;
import com.bookmyturf.dto.owner.SubCourtListResponse;
import com.bookmyturf.dto.owner.SubCourtRequest;
import com.bookmyturf.dto.owner.SubCourtResponse;
import com.bookmyturf.dto.owner.TurfListResponse;
import com.bookmyturf.dto.owner.TurfResponse;
import com.bookmyturf.dto.owner.UpdateOwnerProfileRequest;
import com.bookmyturf.dto.owner.UpdateSubCourtRequest;
import com.bookmyturf.dto.owner.UpdateTurfRequest;
import com.bookmyturf.model.User;
import com.bookmyturf.service.OwnerService;
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

import java.util.List;

@RestController
@RequestMapping("/api/owner")
public class OwnerController {

    private final OwnerService ownerService;

    public OwnerController(OwnerService ownerService) {
        this.ownerService = ownerService;
    }

    // -------------------------------------------------------------------------
    // Profile
    // -------------------------------------------------------------------------

    @GetMapping("/profile")
    public OwnerProfileResponse getProfile(@AuthenticationPrincipal User owner) {
        return ownerService.getProfile(owner);
    }

    @PutMapping("/profile")
    public OwnerProfileResponse updateProfile(@AuthenticationPrincipal User owner,
                                               @Valid @RequestBody UpdateOwnerProfileRequest req) {
        return ownerService.updateProfile(owner, req);
    }

    // -------------------------------------------------------------------------
    // Turfs
    // -------------------------------------------------------------------------

    @PostMapping("/turfs")
    @ResponseStatus(HttpStatus.CREATED)
    public TurfResponse createTurf(@AuthenticationPrincipal User owner,
                                    @Valid @RequestBody CreateTurfRequest req) {
        return ownerService.createTurf(owner, req);
    }

    @GetMapping("/turfs")
    public TurfListResponse listTurfs(@AuthenticationPrincipal User owner,
                                       @RequestParam(defaultValue = "all") String status,
                                       @RequestParam(name = "sort_by", defaultValue = "created_desc") String sortBy,
                                       @RequestParam(defaultValue = "1") int page,
                                       @RequestParam(name = "page_size", defaultValue = "10") int pageSize) {
        return ownerService.listTurfs(owner, status, sortBy, page, pageSize);
    }

    @GetMapping("/turfs/{id}")
    public TurfResponse getTurf(@AuthenticationPrincipal User owner,
                                 @PathVariable Long id) {
        return ownerService.getTurf(owner, id);
    }

    @PutMapping("/turfs/{id}")
    public TurfResponse updateTurf(@AuthenticationPrincipal User owner,
                                    @PathVariable Long id,
                                    @Valid @RequestBody UpdateTurfRequest req) {
        return ownerService.updateTurf(owner, id, req);
    }

    @DeleteMapping("/turfs/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTurf(@AuthenticationPrincipal User owner,
                            @PathVariable Long id) {
        ownerService.deleteTurf(owner, id);
    }

    // -------------------------------------------------------------------------
    // Sub-courts
    // -------------------------------------------------------------------------

    @PostMapping("/turfs/{id}/sub-courts")
    @ResponseStatus(HttpStatus.CREATED)
    public SubCourtResponse addSubCourt(@AuthenticationPrincipal User owner,
                                         @PathVariable Long id,
                                         @Valid @RequestBody SubCourtRequest req) {
        return ownerService.addSubCourt(owner, id, req);
    }

    @GetMapping("/turfs/{id}/sub-courts")
    public SubCourtListResponse listSubCourts(@AuthenticationPrincipal User owner,
                                               @PathVariable Long id) {
        return ownerService.listSubCourts(owner, id);
    }

    @PutMapping("/sub-courts/{id}")
    public SubCourtResponse updateSubCourt(@AuthenticationPrincipal User owner,
                                            @PathVariable Long id,
                                            @Valid @RequestBody UpdateSubCourtRequest req) {
        return ownerService.updateSubCourt(owner, id, req);
    }

    @DeleteMapping("/sub-courts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSubCourt(@AuthenticationPrincipal User owner,
                                @PathVariable Long id) {
        ownerService.deleteSubCourt(owner, id);
    }

    // -------------------------------------------------------------------------
    // Photos
    // -------------------------------------------------------------------------

    @PostMapping("/turfs/{id}/photos")
    @ResponseStatus(HttpStatus.CREATED)
    public PhotoResponse addPhoto(@AuthenticationPrincipal User owner,
                                   @PathVariable Long id,
                                   @Valid @RequestBody AddPhotoRequest req) {
        return ownerService.addPhoto(owner, id, req);
    }

    @GetMapping("/turfs/{id}/photos")
    public List<PhotoResponse> listPhotos(@AuthenticationPrincipal User owner,
                                           @PathVariable Long id) {
        return ownerService.listPhotos(owner, id);
    }

    @DeleteMapping("/turfs/{id}/photos/{photoId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePhoto(@AuthenticationPrincipal User owner,
                             @PathVariable Long id,
                             @PathVariable Long photoId) {
        ownerService.deletePhoto(owner, id, photoId);
    }
}
