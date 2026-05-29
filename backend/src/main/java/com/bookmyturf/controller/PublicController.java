package com.bookmyturf.controller;

import com.bookmyturf.dto.customer.AvailabilityResponse;
import com.bookmyturf.dto.customer.CustomerTurfDetailResponse;
import com.bookmyturf.dto.publicapi.*;
import com.bookmyturf.service.PublicService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/public")
public class PublicController {

    private final PublicService publicService;

    public PublicController(PublicService publicService) {
        this.publicService = publicService;
    }

    @GetMapping("/cities")
    public ResponseEntity<CitiesResponse> getCities() {
        return ResponseEntity.ok(publicService.getCities());
    }

    @GetMapping("/turfs/{id}")
    public ResponseEntity<CustomerTurfDetailResponse> getTurf(@PathVariable Long id) {
        return ResponseEntity.ok(publicService.getTurfDetail(id));
    }

    @GetMapping("/turfs/{id}/availability")
    public ResponseEntity<AvailabilityResponse> getAvailability(
            @PathVariable Long id,
            @RequestParam String date) {
        return ResponseEntity.ok(publicService.getAvailability(id, date));
    }

    @GetMapping("/turfs")
    public ResponseEntity<PublicTurfListResponse> listTurfs(
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String sport,
            @RequestParam(name = "min_price", required = false) BigDecimal minPrice,
            @RequestParam(name = "max_price", required = false) BigDecimal maxPrice,
            @RequestParam(name = "min_rating", required = false) BigDecimal minRating,
            @RequestParam(name = "sort_by", defaultValue = "rating_desc") String sortBy,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(name = "page_size", defaultValue = "10") int pageSize) {
        return ResponseEntity.ok(publicService.searchTurfs(
                city, sport, minPrice, maxPrice, minRating, sortBy, page, pageSize));
    }
}
