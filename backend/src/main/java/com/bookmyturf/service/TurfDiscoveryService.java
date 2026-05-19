package com.bookmyturf.service;

import com.bookmyturf.model.BookingStatus;
import com.bookmyturf.model.CustomerProfile;
import com.bookmyturf.model.Review;
import com.bookmyturf.model.ReviewReply;
import com.bookmyturf.model.SubCourt;
import com.bookmyturf.model.Turf;
import com.bookmyturf.model.TurfPhoto;
import com.bookmyturf.repository.BookingSlotRepository;
import com.bookmyturf.repository.CustomerProfileRepository;
import com.bookmyturf.repository.ReviewRepository;
import com.bookmyturf.repository.SubCourtRepository;
import com.bookmyturf.repository.TurfPhotoRepository;
import com.bookmyturf.repository.TurfRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Shared discovery logic used by both CustomerService and PublicService.
 * Handles turf search (filter/sort/paginate), turf detail, and slot availability.
 */
@Service
@Transactional(readOnly = true)
public class TurfDiscoveryService {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");
    private static final int MAX_PAGE_SIZE = 50;
    private static final int RECENT_REVIEWS_LIMIT = 5;
    private static final Set<String> VALID_SORT_BY = Set.of("rating_desc", "price_asc", "price_desc", "newest");

    private final TurfRepository turfRepository;
    private final SubCourtRepository subCourtRepository;
    private final TurfPhotoRepository turfPhotoRepository;
    private final ReviewRepository reviewRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final BookingSlotRepository bookingSlotRepository;
    private final ObjectMapper objectMapper;

    public TurfDiscoveryService(TurfRepository turfRepository,
                                SubCourtRepository subCourtRepository,
                                TurfPhotoRepository turfPhotoRepository,
                                ReviewRepository reviewRepository,
                                CustomerProfileRepository customerProfileRepository,
                                BookingSlotRepository bookingSlotRepository,
                                ObjectMapper objectMapper) {
        this.turfRepository = turfRepository;
        this.subCourtRepository = subCourtRepository;
        this.turfPhotoRepository = turfPhotoRepository;
        this.reviewRepository = reviewRepository;
        this.customerProfileRepository = customerProfileRepository;
        this.bookingSlotRepository = bookingSlotRepository;
        this.objectMapper = objectMapper;
    }

    // -------------------------------------------------------------------------
    // Internal result containers
    // -------------------------------------------------------------------------

    public record TurfMeta(
            Turf turf,
            List<SubCourt> approvedSubCourts,
            String coverPhotoUrl,
            BigDecimal minHourlyPrice,
            BigDecimal maxHourlyPrice,
            List<String> unifiedSports
    ) {}

    public record TurfPage(long totalResults, int totalPages, List<TurfMeta> items) {}

    public record TurfDetail(
            Turf turf,
            List<SubCourt> approvedSubCourts,
            List<String> photoUrls,
            List<String> allSports,
            List<ReviewInfo> recentReviews
    ) {}

    public record ReviewInfo(
            Long reviewId,
            String maskedCustomerName,
            Integer rating,
            String reviewText,
            String createdAt,
            String replyText,
            String replyCreatedAt
    ) {}

    public record SubCourtAvailability(
            Long subCourtId,
            String name,
            BigDecimal hourlyPrice,
            String openingHour,
            String closingHour,
            List<SlotInfo> slots
    ) {}

    public record SlotInfo(String startTime, String endTime, boolean available) {}

    // -------------------------------------------------------------------------
    // Validation helpers (called by CustomerService and PublicService)
    // -------------------------------------------------------------------------

    public void validateSearchParams(BigDecimal minPrice, BigDecimal maxPrice,
                                     BigDecimal minRating, int page, int pageSize) {
        if (page < 1)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid query parameter");
        if (minPrice != null && minPrice.compareTo(BigDecimal.ZERO) < 0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid query parameter");
        if (maxPrice != null && maxPrice.compareTo(BigDecimal.ZERO) < 0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid query parameter");
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "min_price cannot be greater than max_price");
        if (minRating != null && (minRating.compareTo(BigDecimal.ZERO) < 0
                || minRating.compareTo(new BigDecimal("5.0")) > 0))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid query parameter");
    }

    public void validateSortBy(String sortBy) {
        if (!VALID_SORT_BY.contains(sortBy))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid query parameter");
    }

    // -------------------------------------------------------------------------
    // Turf search
    // -------------------------------------------------------------------------

    public TurfPage searchTurfs(String city, String sport,
                                BigDecimal minPrice, BigDecimal maxPrice,
                                BigDecimal minRating, String sortBy,
                                int page, int pageSize) {
        int effectivePageSize = Math.min(pageSize, MAX_PAGE_SIZE);

        // 1. Load all discoverable turfs: APPROVED + owner ACTIVE + ≥1 APPROVED sub-court.
        List<Turf> allTurfs = turfRepository.findAllDiscoverable();
        if (allTurfs.isEmpty()) {
            return new TurfPage(0, 0, List.of());
        }

        // 2. Batch-load APPROVED sub-courts for all discovered turfs (avoids N+1).
        List<Long> turfIds = allTurfs.stream().map(Turf::getId).collect(Collectors.toList());
        List<SubCourt> allApproved = subCourtRepository.findApprovedByTurfIdIn(turfIds);
        Map<Long, List<SubCourt>> subCourtsByTurf = allApproved.stream()
                .collect(Collectors.groupingBy(sc -> sc.getTurf().getId()));

        // 3. Apply filters in Java (sport filter requires JSON parsing of sub-court sports array).
        String normCity = city != null ? city.trim() : null;
        String normSport = sport != null ? sport.trim() : null;

        List<Turf> filtered = allTurfs.stream()
                .filter(t -> {
                    List<SubCourt> scs = subCourtsByTurf.getOrDefault(t.getId(), List.of());
                    if (scs.isEmpty()) return false;
                    if (normCity != null && !normCity.isEmpty()
                            && !t.getCity().equalsIgnoreCase(normCity)) return false;
                    BigDecimal rating = t.getAvgRating() != null ? t.getAvgRating() : BigDecimal.ZERO;
                    if (minRating != null && rating.compareTo(minRating) < 0) return false;
                    if (normSport != null && !normSport.isEmpty()
                            && !turfHasSport(scs, normSport)) return false;
                    if (minPrice != null && !hasSubCourtAtLeast(scs, minPrice)) return false;
                    if (maxPrice != null && !hasSubCourtAtMost(scs, maxPrice)) return false;
                    return true;
                })
                .collect(Collectors.toList());

        // 4. Build TurfMeta without cover photos (photos loaded per-page only).
        List<TurfMeta> allMeta = filtered.stream()
                .map(t -> buildMeta(t, subCourtsByTurf.getOrDefault(t.getId(), List.of()), null))
                .collect(Collectors.toList());

        // 5. Sort.
        sortMeta(allMeta, sortBy);

        // 6. Paginate.
        long total = allMeta.size();
        int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / effectivePageSize);
        int fromIdx = (page - 1) * effectivePageSize;
        int toIdx = Math.min(fromIdx + effectivePageSize, (int) total);
        List<TurfMeta> pageSlice = fromIdx >= (int) total ? List.of() : allMeta.subList(fromIdx, toIdx);

        // 7. Load cover photos only for the page items (max page_size queries, ≤50).
        List<Long> pageIds = pageSlice.stream().map(m -> m.turf().getId()).collect(Collectors.toList());
        Map<Long, String> coverPhotos = loadCoverPhotos(pageIds);

        // 8. Rebuild page items with cover photos.
        List<TurfMeta> pageWithPhotos = pageSlice.stream()
                .map(m -> buildMeta(m.turf(), m.approvedSubCourts(), coverPhotos.get(m.turf().getId())))
                .collect(Collectors.toList());

        return new TurfPage(total, totalPages, pageWithPhotos);
    }

    // -------------------------------------------------------------------------
    // Turf detail
    // -------------------------------------------------------------------------

    public TurfDetail getTurfDetail(Long id) {
        // 404 for non-existent, non-APPROVED, or SUSPENDED/BANNED-owner turfs.
        Turf turf = turfRepository.findDiscoverableById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Turf not found"));

        // 404 if no approved sub-courts (turf has nothing bookable).
        List<SubCourt> approvedSCs = subCourtRepository.findApprovedByTurfId(id);
        if (approvedSCs.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Turf not found");
        }

        List<String> photoUrls = turfPhotoRepository.findByTurfIdOrdered(id).stream()
                .map(TurfPhoto::getPhotoUrl).collect(Collectors.toList());

        List<String> allSports = computeAllSports(approvedSCs);

        Page<Review> reviewPage = reviewRepository.findRecentByTurfId(id,
                PageRequest.of(0, RECENT_REVIEWS_LIMIT));
        List<ReviewInfo> reviews = reviewPage.getContent().stream()
                .map(this::toReviewInfo).collect(Collectors.toList());

        return new TurfDetail(turf, approvedSCs, photoUrls, allSports, reviews);
    }

    // -------------------------------------------------------------------------
    // Slot availability
    // -------------------------------------------------------------------------

    public List<SubCourtAvailability> computeAvailability(Long turfId, LocalDate date) {
        List<SubCourt> approvedSCs = subCourtRepository.findApprovedByTurfId(turfId);
        boolean isToday = date.equals(LocalDate.now());
        List<BookingStatus> activeStatuses = List.of(BookingStatus.CONFIRMED, BookingStatus.COMPLETED);

        List<SubCourtAvailability> result = new ArrayList<>();
        for (SubCourt sc : approvedSCs) {
            Set<LocalTime> takenStarts = new HashSet<>(
                    bookingSlotRepository.findTakenSlotStartTimes(sc.getId(), date, activeStatuses));

            List<SlotInfo> slots = new ArrayList<>();
            LocalTime current = sc.getOpeningHour();
            LocalTime closing = sc.getClosingHour();
            LocalTime nowTime = LocalTime.now();

            while (current.isBefore(closing)) {
                LocalTime next = current.plusHours(1);
                if (next.isAfter(closing)) break;
                boolean taken = takenStarts.contains(current);
                // Past/current slots on today are unavailable — can't book a slot already started.
                boolean pastOnToday = isToday && !current.isAfter(nowTime);
                slots.add(new SlotInfo(TIME_FMT.format(current), TIME_FMT.format(next), !taken && !pastOnToday));
                current = next;
            }

            result.add(new SubCourtAvailability(
                    sc.getId(), sc.getName(), sc.getHourlyPrice(),
                    TIME_FMT.format(sc.getOpeningHour()), TIME_FMT.format(sc.getClosingHour()), slots));
        }
        return result;
    }

    // -------------------------------------------------------------------------
    // Internal helpers — accessible within the package
    // -------------------------------------------------------------------------

    List<String> parseSports(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    List<String> computeAllSports(List<SubCourt> subCourts) {
        Set<String> all = new LinkedHashSet<>();
        for (SubCourt sc : subCourts) {
            all.addAll(parseSports(sc.getSports()));
        }
        return new ArrayList<>(all);
    }

    String formatTime(LocalTime time) {
        return TIME_FMT.format(time);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private TurfMeta buildMeta(Turf turf, List<SubCourt> scs, String coverPhotoUrl) {
        BigDecimal min = null;
        BigDecimal max = null;
        for (SubCourt sc : scs) {
            BigDecimal price = sc.getHourlyPrice();
            if (min == null || price.compareTo(min) < 0) min = price;
            if (max == null || price.compareTo(max) > 0) max = price;
        }
        return new TurfMeta(turf, scs, coverPhotoUrl, min, max, computeAllSports(scs));
    }

    private Map<Long, String> loadCoverPhotos(List<Long> turfIds) {
        Map<Long, String> result = new HashMap<>();
        for (Long turfId : turfIds) {
            String url = turfPhotoRepository.findByTurfIdOrdered(turfId)
                    .stream().findFirst().map(TurfPhoto::getPhotoUrl).orElse(null);
            result.put(turfId, url);
        }
        return result;
    }

    private void sortMeta(List<TurfMeta> metas, String sortBy) {
        switch (sortBy) {
            case "price_asc" -> metas.sort((a, b) -> {
                BigDecimal ap = a.minHourlyPrice() != null ? a.minHourlyPrice() : BigDecimal.ZERO;
                BigDecimal bp = b.minHourlyPrice() != null ? b.minHourlyPrice() : BigDecimal.ZERO;
                return ap.compareTo(bp);
            });
            case "price_desc" -> metas.sort((a, b) -> {
                BigDecimal ap = a.minHourlyPrice() != null ? a.minHourlyPrice() : BigDecimal.ZERO;
                BigDecimal bp = b.minHourlyPrice() != null ? b.minHourlyPrice() : BigDecimal.ZERO;
                return bp.compareTo(ap);
            });
            case "newest" -> metas.sort((a, b) -> {
                var ac = a.turf().getCreatedAt();
                var bc = b.turf().getCreatedAt();
                if (ac == null && bc == null) return b.turf().getId().compareTo(a.turf().getId());
                if (ac == null) return 1;
                if (bc == null) return -1;
                int cmp = bc.compareTo(ac);
                return cmp != 0 ? cmp : b.turf().getId().compareTo(a.turf().getId());
            });
            default -> // "rating_desc"
                metas.sort((a, b) -> {
                    BigDecimal ar = a.turf().getAvgRating() != null ? a.turf().getAvgRating() : BigDecimal.ZERO;
                    BigDecimal br = b.turf().getAvgRating() != null ? b.turf().getAvgRating() : BigDecimal.ZERO;
                    int cmp = br.compareTo(ar);
                    if (cmp != 0) return cmp;
                    int rc = Integer.compare(
                            b.turf().getReviewCount() != null ? b.turf().getReviewCount() : 0,
                            a.turf().getReviewCount() != null ? a.turf().getReviewCount() : 0);
                    return rc != 0 ? rc : a.turf().getId().compareTo(b.turf().getId());
                });
        }
    }

    private boolean turfHasSport(List<SubCourt> scs, String sport) {
        return scs.stream().anyMatch(sc ->
                parseSports(sc.getSports()).stream().anyMatch(s -> s.equalsIgnoreCase(sport)));
    }

    private boolean hasSubCourtAtLeast(List<SubCourt> scs, BigDecimal minPrice) {
        return scs.stream().anyMatch(sc -> sc.getHourlyPrice().compareTo(minPrice) >= 0);
    }

    private boolean hasSubCourtAtMost(List<SubCourt> scs, BigDecimal maxPrice) {
        return scs.stream().anyMatch(sc -> sc.getHourlyPrice().compareTo(maxPrice) <= 0);
    }

    private ReviewInfo toReviewInfo(Review review) {
        CustomerProfile cp = customerProfileRepository.findById(review.getCustomer().getId()).orElse(null);
        String masked = maskCustomerName(cp != null ? cp.getName() : null);

        String replyText = null;
        String replyCreatedAt = null;
        ReviewReply reply = review.getReply();
        if (reply != null) {
            replyText = reply.getReplyText();
            replyCreatedAt = reply.getCreatedAt() != null ? reply.getCreatedAt().toString() : null;
        }

        return new ReviewInfo(
                review.getId(), masked, review.getRating(), review.getReviewText(),
                review.getCreatedAt() != null ? review.getCreatedAt().toString() : null,
                replyText, replyCreatedAt);
    }

    private String maskCustomerName(String fullName) {
        if (fullName == null || fullName.isBlank()) return "Anonymous";
        String trimmed = fullName.trim();
        int lastSpace = trimmed.lastIndexOf(' ');
        if (lastSpace < 0) return trimmed;
        return trimmed.substring(0, lastSpace) + " " + trimmed.charAt(lastSpace + 1) + ".";
    }
}
