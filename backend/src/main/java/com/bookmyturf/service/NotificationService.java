package com.bookmyturf.service;

import com.bookmyturf.dto.notification.MarkAllReadResponse;
import com.bookmyturf.dto.notification.MarkReadResponse;
import com.bookmyturf.dto.notification.NotificationListResponse;
import com.bookmyturf.model.Notification;
import com.bookmyturf.repository.NotificationRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Transactional(readOnly = true)
    public NotificationListResponse list(Long userId, Boolean isRead, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Notification> pageResult;
        if (isRead == null) {
            pageResult = notificationRepository.findByUserId(userId, pageable);
        } else if (isRead) {
            pageResult = notificationRepository.findByUserIdAndRead(userId, pageable);
        } else {
            pageResult = notificationRepository.findByUserIdAndUnread(userId, pageable);
        }

        List<NotificationListResponse.NotificationItem> items = pageResult.getContent().stream()
                .map(n -> new NotificationListResponse.NotificationItem(
                        n.getId(),
                        n.getType(),
                        n.getMessage(),
                        n.getIsRead(),
                        n.getCreatedAt() != null ? n.getCreatedAt().toString() : null))
                .toList();

        return new NotificationListResponse(
                page, size,
                pageResult.getTotalElements(),
                pageResult.getTotalPages(),
                items);
    }

    @Transactional
    public MarkReadResponse markOneRead(Long id, Long userId) {
        LocalDateTime now = LocalDateTime.now();
        // Atomic UPDATE: only fires if is_read=false. Returns 0 if already read or wrong-user/non-existent.
        notificationRepository.markOneRead(id, userId, now);
        // Re-SELECT to get current state. If nothing found → not-yours or non-existent → 404.
        Notification n = notificationRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found"));
        return new MarkReadResponse(
                n.getId(),
                n.getIsRead(),
                n.getReadAt() != null ? n.getReadAt().toString() : null);
    }

    @Transactional
    public MarkAllReadResponse markAllRead(Long userId) {
        LocalDateTime now = LocalDateTime.now();
        int count = notificationRepository.markAllRead(userId, now);
        return new MarkAllReadResponse(count);
    }
}
