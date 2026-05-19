package com.bookmyturf.controller;

import com.bookmyturf.dto.customer.*;
import com.bookmyturf.model.User;
import com.bookmyturf.service.CustomerService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/customer")
public class CustomerController {

    private final CustomerService customerService;

    public CustomerController(CustomerService customerService) {
        this.customerService = customerService;
    }

    @GetMapping("/profile")
    public ResponseEntity<CustomerProfileResponse> getProfile(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(customerService.getProfile(user));
    }

    @PutMapping("/profile")
    public ResponseEntity<CustomerProfileResponse> updateProfile(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody UpdateCustomerProfileRequest req) {
        return ResponseEntity.ok(customerService.updateProfile(user, req));
    }

    @GetMapping("/turfs")
    public ResponseEntity<CustomerTurfListResponse> listTurfs(
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String sport,
            @RequestParam(name = "min_price", required = false) BigDecimal minPrice,
            @RequestParam(name = "max_price", required = false) BigDecimal maxPrice,
            @RequestParam(name = "min_rating", required = false) BigDecimal minRating,
            @RequestParam(name = "sort_by", defaultValue = "rating_desc") String sortBy,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(name = "page_size", defaultValue = "10") int pageSize) {
        return ResponseEntity.ok(customerService.searchTurfs(
                city, sport, minPrice, maxPrice, minRating, sortBy, page, pageSize));
    }

    @GetMapping("/turfs/{id}")
    public ResponseEntity<CustomerTurfDetailResponse> getTurf(@PathVariable Long id) {
        return ResponseEntity.ok(customerService.getTurf(id));
    }

    @GetMapping("/turfs/{id}/availability")
    public ResponseEntity<AvailabilityResponse> getAvailability(
            @PathVariable Long id,
            @RequestParam(required = false) String date) {
        return ResponseEntity.ok(customerService.getAvailability(id, date));
    }
}
