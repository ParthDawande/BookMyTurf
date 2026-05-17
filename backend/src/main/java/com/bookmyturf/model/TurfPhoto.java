package com.bookmyturf.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "turf_photos")
@Getter @Setter @NoArgsConstructor
public class TurfPhoto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "turf_id", nullable = false)
    private Turf turf;

    @Column(name = "photo_url", nullable = false, length = 500)
    private String photoUrl;
}
