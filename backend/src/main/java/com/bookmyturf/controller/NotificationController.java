package com.bookmyturf.controller;

import com.bookmyturf.dto.notification.MarkAllReadResponse;
import com.bookmyturf.dto.notification.MarkReadResponse;
import com.bookmyturf.dto.notification.NotificationListResponse;
import com.bookmyturf.model.User;
import com.bookmyturf.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<NotificationListResponse> list(
            @AuthenticationPrincipal User caller,
            @RequestParam(name = "is_read", required = false) Boolean isRead,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(notificationService.list(caller.getId(), isRead, page, size));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<MarkReadResponse> markOneRead(
            @AuthenticationPrincipal User caller,
            @PathVariable Long id) {
        return ResponseEntity.ok(notificationService.markOneRead(id, caller.getId()));
    }

    @PutMapping("/mark-all-read")
    public ResponseEntity<MarkAllReadResponse> markAllRead(
            @AuthenticationPrincipal User caller) {
        return ResponseEntity.ok(notificationService.markAllRead(caller.getId()));
    }
}
