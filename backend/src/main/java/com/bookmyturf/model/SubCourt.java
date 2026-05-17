package com.bookmyturf.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalTime;

// No created_at column — DECISIONS.md §8. Sort pending sub-courts by id ASC as proxy.
@Entity
@Table(name = "sub_courts")
@Getter @Setter @NoArgsConstructor
public class SubCourt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "turf_id", nullable = false)
    private Turf turf;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(columnDefinition = "json", nullable = false)
    private String sports;

    @Column(name = "hourly_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal hourlyPrice;

    @Column(name = "opening_hour", nullable = false)
    private LocalTime openingHour;

    @Column(name = "closing_hour", nullable = false)
    private LocalTime closingHour;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private ListingStatus status = ListingStatus.PENDING;
}
