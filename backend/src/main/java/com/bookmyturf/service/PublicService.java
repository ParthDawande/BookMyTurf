package com.bookmyturf.service;

import com.bookmyturf.dto.customer.AvailabilityResponse;
import com.bookmyturf.dto.customer.CustomerTurfDetailResponse;
import com.bookmyturf.dto.publicapi.*;
import com.bookmyturf.repository.TurfRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
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

    public CustomerTurfDetailResponse getTurfDetail(Long id) {
        TurfDiscoveryService.TurfDetail detail = discovery.getTurfDetail(id);

        List<CustomerTurfDetailResponse.SubCourtItem> subCourts = detail.approvedSubCourts().stream()
                .map(sc -> new CustomerTurfDetailResponse.SubCourtItem(
                        sc.getId(),
                        sc.getName(),
                        discovery.parseSports(sc.getSports()),
                        sc.getHourlyPrice(),
                        discovery.formatTime(sc.getOpeningHour()),
                        discovery.formatTime(sc.getClosingHour())
                ))
                .collect(Collectors.toList());

        List<CustomerTurfDetailResponse.ReviewItem> reviews = detail.recentReviews().stream()
                .map(ri -> {
                    CustomerTurfDetailResponse.OwnerReply reply = ri.replyText() != null
                            ? new CustomerTurfDetailResponse.OwnerReply(ri.replyText(), ri.replyCreatedAt())
                            : null;
                    return new CustomerTurfDetailResponse.ReviewItem(
                            ri.reviewId(), ri.maskedCustomerName(), ri.rating(),
                            ri.reviewText(), ri.createdAt(), reply);
                })
                .collect(Collectors.toList());

        return new CustomerTurfDetailResponse(
                detail.turf().getId(),
                detail.turf().getName(),
                detail.turf().getDescription(),
                detail.turf().getAddress(),
                detail.turf().getCity(),
                detail.turf().getOwner().getPhone(),
                detail.photoUrls(),
                detail.allSports(),
                detail.turf().getAvgRating(),
                detail.turf().getReviewCount(),
                subCourts,
                reviews
        );
    }

    public AvailabilityResponse getAvailability(Long id, String dateStr) {
        if (dateStr == null || dateStr.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid date. Use YYYY-MM-DD format.");
        }
        LocalDate date;
        try {
            date = LocalDate.parse(dateStr);
        } catch (DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid date. Use YYYY-MM-DD format.");
        }
        if (date.isBefore(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot check availability for past dates");
        }

        // Verify turf is APPROVED and discoverable — throws 404 if not.
        discovery.getTurfDetail(id);

        List<TurfDiscoveryService.SubCourtAvailability> sca = discovery.computeAvailability(id, date);

        List<AvailabilityResponse.SubCourtSlots> subCourts = sca.stream()
                .map(a -> new AvailabilityResponse.SubCourtSlots(
                        a.subCourtId(), a.name(), a.hourlyPrice(),
                        a.openingHour(), a.closingHour(),
                        a.slots().stream()
                                .map(s -> new AvailabilityResponse.Slot(s.startTime(), s.endTime(), s.available()))
                                .collect(Collectors.toList())
                ))
                .collect(Collectors.toList());

        return new AvailabilityResponse(id, dateStr, subCourts);
    }

    private String titleCase(String str) {
        if (str == null || str.isBlank()) return str;
        return Arrays.stream(str.trim().split("\\s+"))
                .map(w -> w.isEmpty() ? w
                        : Character.toUpperCase(w.charAt(0)) + w.substring(1).toLowerCase())
                .collect(Collectors.joining(" "));
    }
}
