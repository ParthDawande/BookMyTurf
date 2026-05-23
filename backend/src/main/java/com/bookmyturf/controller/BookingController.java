package com.bookmyturf.controller;

import com.bookmyturf.dto.customer.CancelBookingResponse;
import com.bookmyturf.dto.customer.ConfirmBookingRequest;
import com.bookmyturf.dto.customer.ConfirmBookingResponse;
import com.bookmyturf.dto.customer.InitiateBookingRequest;
import com.bookmyturf.dto.customer.InitiateBookingResponse;
import com.bookmyturf.dto.customer.ReceiptResponse;
import com.bookmyturf.dto.customer.RescheduleConfirmRequest;
import com.bookmyturf.dto.customer.RescheduleConfirmResponse;
import com.bookmyturf.dto.customer.RescheduleInitiateRequest;
import com.bookmyturf.dto.customer.RescheduleInitiateResponse;
import com.bookmyturf.model.User;
import com.bookmyturf.service.BookingService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/customer/bookings")
public class BookingController {

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @PostMapping("/initiate")
    public ResponseEntity<InitiateBookingResponse> initiate(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody InitiateBookingRequest req) {
        return ResponseEntity.ok(bookingService.initiate(user, req));
    }

    @PostMapping("/confirm")
    public ResponseEntity<ConfirmBookingResponse> confirm(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody ConfirmBookingRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(bookingService.confirm(user, req));
    }

    @GetMapping("/{id}/receipt")
    public ResponseEntity<ReceiptResponse> receipt(
            @AuthenticationPrincipal User user,
            @PathVariable Long id) {
        return ResponseEntity.ok(bookingService.getReceipt(user, id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<CancelBookingResponse> cancel(
            @AuthenticationPrincipal User user,
            @PathVariable Long id) {
        return ResponseEntity.ok(bookingService.cancel(user, id));
    }

    @PostMapping("/{id}/reschedule/initiate")
    public ResponseEntity<RescheduleInitiateResponse> rescheduleInitiate(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @Valid @RequestBody RescheduleInitiateRequest req) {
        return ResponseEntity.ok(bookingService.rescheduleInitiate(user, id, req));
    }

    @PutMapping("/{id}/reschedule/confirm")
    public ResponseEntity<RescheduleConfirmResponse> rescheduleConfirm(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @Valid @RequestBody RescheduleConfirmRequest req) {
        return ResponseEntity.ok(bookingService.rescheduleConfirm(user, id, req));
    }
}
