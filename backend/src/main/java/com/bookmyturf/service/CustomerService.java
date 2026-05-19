package com.bookmyturf.service;

import com.bookmyturf.dto.customer.*;
import com.bookmyturf.model.CustomerProfile;
import com.bookmyturf.model.User;
import com.bookmyturf.repository.CustomerProfileRepository;
import com.bookmyturf.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class CustomerService {

    private final CustomerProfileRepository customerProfileRepository;
    private final UserRepository userRepository;
    private final TurfDiscoveryService discovery;

    public CustomerService(CustomerProfileRepository customerProfileRepository,
                           UserRepository userRepository,
                           TurfDiscoveryService discovery) {
        this.customerProfileRepository = customerProfileRepository;
        this.userRepository = userRepository;
        this.discovery = discovery;
    }

    public CustomerProfileResponse getProfile(User customer) {
        CustomerProfile cp = customerProfileRepository.findById(customer.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Profile not found"));
        return new CustomerProfileResponse(
                customer.getId(),
                cp.getName(),
                customer.getEmail(),
                customer.getPhone(),
                cp.getCity(),
                parsePreferredSports(cp.getPreferredSports()),
                customer.getCreatedAt() != null ? customer.getCreatedAt().toString() : null,
                null
        );
    }

    @Transactional
    public CustomerProfileResponse updateProfile(User customer, UpdateCustomerProfileRequest req) {
        if (req.name() == null && req.city() == null && req.preferredSports() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one field must be provided");
        }

        CustomerProfile cp = customerProfileRepository.findById(customer.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Profile not found"));

        if (req.name() != null) cp.setName(req.name());
        if (req.city() != null) cp.setCity(req.city());
        if (req.preferredSports() != null) {
            cp.setPreferredSports(req.preferredSports().stream()
                    .map(String::trim).filter(s -> !s.isEmpty())
                    .collect(Collectors.joining(",")));
        }
        customerProfileRepository.save(cp);

        // Re-fetch within transaction and set updatedAt — @PreUpdate fires and persists current timestamp.
        User managed = userRepository.findById(customer.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Profile not found"));
        managed.setUpdatedAt(LocalDateTime.now());
        userRepository.save(managed);

        return new CustomerProfileResponse(
                customer.getId(),
                cp.getName(),
                customer.getEmail(),
                customer.getPhone(),
                cp.getCity(),
                parsePreferredSports(cp.getPreferredSports()),
                null,
                managed.getUpdatedAt() != null ? managed.getUpdatedAt().toString() : null
        );
    }

    public CustomerTurfListResponse searchTurfs(String city, String sport,
                                                 BigDecimal minPrice, BigDecimal maxPrice,
                                                 BigDecimal minRating, String sortBy,
                                                 int page, int pageSize) {
        discovery.validateSearchParams(minPrice, maxPrice, minRating, page, pageSize);
        discovery.validateSortBy(sortBy);

        int effectivePageSize = Math.min(pageSize, 50);
        TurfDiscoveryService.TurfPage turfPage = discovery.searchTurfs(
                city, sport, minPrice, maxPrice, minRating, sortBy, page, effectivePageSize);

        List<CustomerTurfSummary> turfs = turfPage.items().stream()
                .map(meta -> new CustomerTurfSummary(
                        meta.turf().getId(),
                        meta.turf().getName(),
                        meta.turf().getCity(),
                        meta.turf().getAddress(),
                        meta.coverPhotoUrl(),
                        meta.unifiedSports(),
                        meta.minHourlyPrice(),
                        meta.maxHourlyPrice(),
                        meta.turf().getAvgRating(),
                        meta.turf().getReviewCount()
                ))
                .collect(Collectors.toList());

        return new CustomerTurfListResponse(page, effectivePageSize,
                turfPage.totalResults(), turfPage.totalPages(), turfs);
    }

    public CustomerTurfDetailResponse getTurf(Long id) {
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

        // Verify turf is discoverable — throws 404 if not.
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

    private List<String> parsePreferredSports(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }
}
