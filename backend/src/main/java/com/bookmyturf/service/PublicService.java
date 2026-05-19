package com.bookmyturf.service;

import com.bookmyturf.dto.publicapi.*;
import com.bookmyturf.repository.TurfRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class PublicService {

    private final TurfRepository turfRepository;
    private final TurfDiscoveryService discovery;

    public PublicService(TurfRepository turfRepository, TurfDiscoveryService discovery) {
        this.turfRepository = turfRepository;
        this.discovery = discovery;
    }

    public CitiesResponse getCities() {
        List<Object[]> rows = turfRepository.findCitiesWithCount();
        List<CityItem> cities = rows.stream()
                .map(row -> new CityItem(titleCase((String) row[0]), ((Number) row[1]).longValue()))
                .collect(Collectors.toList());
        return new CitiesResponse(cities.size(), cities);
    }

    public PublicTurfListResponse searchTurfs(String city, String sport,
                                               BigDecimal minPrice, BigDecimal maxPrice,
                                               BigDecimal minRating, String sortBy,
                                               int page, int pageSize) {
        discovery.validateSearchParams(minPrice, maxPrice, minRating, page, pageSize);
        discovery.validateSortBy(sortBy);

        int effectivePageSize = Math.min(pageSize, 50);
        TurfDiscoveryService.TurfPage turfPage = discovery.searchTurfs(
                city, sport, minPrice, maxPrice, minRating, sortBy, page, effectivePageSize);

        List<PublicTurfSummary> turfs = turfPage.items().stream()
                .map(meta -> new PublicTurfSummary(
                        meta.turf().getId(),
                        meta.turf().getName(),
                        meta.turf().getCity(),
                        meta.turf().getAddress(),
                        meta.coverPhotoUrl(),
                        meta.minHourlyPrice(),
                        meta.maxHourlyPrice(),
                        meta.unifiedSports(),
                        meta.turf().getAvgRating(),
                        meta.turf().getReviewCount()
                ))
                .collect(Collectors.toList());

        return new PublicTurfListResponse(page, effectivePageSize,
                turfPage.totalResults(), turfPage.totalPages(), turfs);
    }

    private String titleCase(String str) {
        if (str == null || str.isBlank()) return str;
        return Arrays.stream(str.trim().split("\\s+"))
                .map(w -> w.isEmpty() ? w
                        : Character.toUpperCase(w.charAt(0)) + w.substring(1).toLowerCase())
                .collect(Collectors.joining(" "));
    }
}
