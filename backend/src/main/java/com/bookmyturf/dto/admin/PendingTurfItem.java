package com.bookmyturf.dto.admin;

import java.util.List;

public record PendingTurfItem(
        Long turfId,
        String name,
        String description,
        String address,
        String city,
        String contactPhone,
        String status,
        String createdAt,
        OwnerInfo owner,
        List<String> photos,
        SubCourtsSummary subCourtsSummary
) {
    public record OwnerInfo(Long ownerId, String name, String email, String phone) {}
    public record SubCourtsSummary(long total, long pending, long approved, long rejected) {}
}
