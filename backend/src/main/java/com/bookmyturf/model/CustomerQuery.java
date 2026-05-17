package com.bookmyturf.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

// Table name "queries". No picked_up_at column — DECISIONS.md §8.
@Entity
@Table(name = "queries")
@Getter @Setter @NoArgsConstructor
public class CustomerQuery {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private User customer;

    @Column(length = 200)
    private String subject;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "picked_up_by_staff_id")
    private User pickedUpByStaff;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private SupportTicketStatus status = SupportTicketStatus.OPEN;

    @Column(name = "resolution_text", columnDefinition = "TEXT")
    private String resolutionText;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
