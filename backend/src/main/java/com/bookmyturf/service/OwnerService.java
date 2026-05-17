package com.bookmyturf.service;

import com.bookmyturf.dto.owner.AddPhotoRequest;
import com.bookmyturf.dto.owner.CreateTurfRequest;
import com.bookmyturf.dto.owner.OwnerProfileResponse;
import com.bookmyturf.dto.owner.PhotoResponse;
import com.bookmyturf.dto.owner.SubCourtListResponse;
import com.bookmyturf.dto.owner.SubCourtRequest;
import com.bookmyturf.dto.owner.SubCourtResponse;
import com.bookmyturf.dto.owner.TurfListResponse;
import com.bookmyturf.dto.owner.TurfResponse;
import com.bookmyturf.dto.owner.TurfSummary;
import com.bookmyturf.dto.owner.UpdateOwnerProfileRequest;
import com.bookmyturf.dto.owner.UpdateSubCourtRequest;
import com.bookmyturf.dto.owner.UpdateTurfRequest;
import com.bookmyturf.exception.SchedulingConflictException;
import com.bookmyturf.model.Booking;
import com.bookmyturf.model.BookingSlot;
import com.bookmyturf.model.BookingStatus;
import com.bookmyturf.model.ListingStatus;
import com.bookmyturf.model.OwnerProfile;
import com.bookmyturf.model.SubCourt;
import com.bookmyturf.model.Turf;
import com.bookmyturf.model.TurfPhoto;
import com.bookmyturf.model.User;
import com.bookmyturf.repository.BookingRepository;
import com.bookmyturf.repository.BookingSlotRepository;
import com.bookmyturf.repository.OwnerProfileRepository;
import com.bookmyturf.repository.SubCourtRepository;
import com.bookmyturf.repository.TurfPhotoRepository;
import com.bookmyturf.repository.TurfRepository;
import com.bookmyturf.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class OwnerService {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    private final OwnerProfileRepository ownerProfileRepository;
    private final UserRepository userRepository;
    private final TurfRepository turfRepository;
    private final TurfPhotoRepository turfPhotoRepository;
    private final SubCourtRepository subCourtRepository;
    private final BookingRepository bookingRepository;
    private final BookingSlotRepository bookingSlotRepository;
    private final ObjectMapper objectMapper;

    public OwnerService(OwnerProfileRepository ownerProfileRepository,
                        UserRepository userRepository,
                        TurfRepository turfRepository,
                        TurfPhotoRepository turfPhotoRepository,
                        SubCourtRepository subCourtRepository,
                        BookingRepository bookingRepository,
                        BookingSlotRepository bookingSlotRepository,
                        ObjectMapper objectMapper) {
        this.ownerProfileRepository = ownerProfileRepository;
        this.userRepository = userRepository;
        this.turfRepository = turfRepository;
        this.turfPhotoRepository = turfPhotoRepository;
        this.subCourtRepository = subCourtRepository;
        this.bookingRepository = bookingRepository;
        this.bookingSlotRepository = bookingSlotRepository;
        this.objectMapper = objectMapper;
    }

    // -------------------------------------------------------------------------
    // Profile
    // -------------------------------------------------------------------------

    public OwnerProfileResponse getProfile(User owner) {
        OwnerProfile profile = ownerProfileRepository.findById(owner.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Profile not found"));
        boolean complete = isBankComplete(profile);
        return new OwnerProfileResponse(
                owner.getId(),
                profile.getName(),
                owner.getEmail(),
                owner.getPhone(),
                profile.getBankAccountNumber(),
                profile.getIfscCode(),
                complete,
                owner.getCreatedAt() != null ? owner.getCreatedAt().toString() : null,
                null
        );
    }

    @Transactional
    public OwnerProfileResponse updateProfile(User owner, UpdateOwnerProfileRequest req) {
        if (req.name() == null && req.bankAccountNumber() == null && req.ifscCode() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one field must be provided");
        }

        if (req.ifscCode() != null && !req.ifscCode().isBlank()) {
            if (!req.ifscCode().matches("^[A-Z]{4}0[A-Z0-9]{6}$")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid IFSC code format");
            }
        }

        OwnerProfile profile = ownerProfileRepository.findById(owner.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Profile not found"));

        if (req.name() != null) profile.setName(req.name());
        if (req.bankAccountNumber() != null) profile.setBankAccountNumber(req.bankAccountNumber());
        if (req.ifscCode() != null) profile.setIfscCode(req.ifscCode());

        ownerProfileRepository.save(profile);

        owner.setUpdatedAt(LocalDateTime.now());
        User saved = userRepository.save(owner);

        boolean complete = isBankComplete(profile);
        return new OwnerProfileResponse(
                owner.getId(),
                profile.getName(),
                owner.getEmail(),
                owner.getPhone(),
                profile.getBankAccountNumber(),
                profile.getIfscCode(),
                complete,
                null,
                saved.getUpdatedAt() != null ? saved.getUpdatedAt().toString() : LocalDateTime.now().toString()
        );
    }

    // -------------------------------------------------------------------------
    // Turfs
    // -------------------------------------------------------------------------

    @Transactional
    public TurfResponse createTurf(User owner, CreateTurfRequest req) {
        // Check for duplicate sub-court names
        Set<String> seenNames = new HashSet<>();
        for (CreateTurfRequest.SubCourtInCreate sc : req.subCourts()) {
            if (!seenNames.add(sc.name().toLowerCase())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Sub-court names must be unique within a turf");
            }
        }

        // Validate each sub-court's hours
        for (CreateTurfRequest.SubCourtInCreate sc : req.subCourts()) {
            if (!sc.closingHour().isAfter(sc.openingHour())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Sub-court closing time must be after opening time");
            }
        }

        Turf turf = new Turf();
        turf.setOwner(owner);
        turf.setName(req.name());
        turf.setDescription(req.description());
        turf.setAddress(req.address());
        turf.setCity(req.city());
        turf.setContactPhone(req.contactPhone());
        turf = turfRepository.save(turf);

        final Turf savedTurf = turf;

        // Save photos
        for (String url : req.photos()) {
            TurfPhoto photo = new TurfPhoto();
            photo.setTurf(savedTurf);
            photo.setPhotoUrl(url);
            turfPhotoRepository.save(photo);
        }

        // Save sub-courts
        List<SubCourt> savedSubCourts = new ArrayList<>();
        for (CreateTurfRequest.SubCourtInCreate scReq : req.subCourts()) {
            List<String> normalized = normalizeSports(scReq.sports());
            SubCourt sc = new SubCourt();
            sc.setTurf(savedTurf);
            sc.setName(scReq.name());
            sc.setSports(serializeSports(normalized));
            sc.setHourlyPrice(scReq.hourlyPrice());
            sc.setOpeningHour(scReq.openingHour());
            sc.setClosingHour(scReq.closingHour());
            savedSubCourts.add(subCourtRepository.save(sc));
        }

        List<String> allSports = computeAllSports(savedSubCourts);
        List<String> photos = req.photos();

        return buildTurfResponseFull(savedTurf, owner.getId(), photos, savedSubCourts, allSports);
    }

    public TurfListResponse listTurfs(User owner, String status, String sortBy, int page, int pageSize) {
        if (pageSize > 50) pageSize = 50;
        if (page < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid query parameter", null);
        }

        Sort sort = resolveSort(sortBy);
        PageRequest pageable = PageRequest.of(page - 1, pageSize, sort);

        Page<Turf> turfPage;
        if ("all".equalsIgnoreCase(status)) {
            turfPage = turfRepository.findAllByOwnerId(owner.getId(), pageable);
        } else {
            ListingStatus ls = parseListingStatus(status);
            turfPage = turfRepository.findAllByOwnerIdAndStatus(owner.getId(), ls, pageable);
        }

        List<TurfSummary> summaries = turfPage.getContent().stream()
                .map(this::toTurfSummary)
                .collect(Collectors.toList());

        return new TurfListResponse(
                page,
                pageSize,
                turfPage.getTotalElements(),
                turfPage.getTotalPages(),
                summaries
        );
    }

    public TurfResponse getTurf(User owner, Long turfId) {
        Turf turf = resolveOwnedTurf(turfId, owner.getId());
        List<TurfPhoto> photos = turfPhotoRepository.findByTurfIdOrdered(turfId);
        List<SubCourt> subCourts = subCourtRepository.findByTurfIdOrdered(turfId);
        List<String> allSports = computeAllSports(subCourts);
        List<String> photoUrls = photos.stream().map(TurfPhoto::getPhotoUrl).collect(Collectors.toList());
        return buildTurfResponseFull(turf, owner.getId(), photoUrls, subCourts, allSports);
    }

    @Transactional
    public TurfResponse updateTurf(User owner, Long turfId, UpdateTurfRequest req) {
        if (req.name() == null && req.description() == null && req.address() == null
                && req.city() == null && req.contactPhone() == null && req.photos() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one field must be provided");
        }

        Turf turf = resolveOwnedTurf(turfId, owner.getId());
        ListingStatus previousStatus = turf.getStatus();

        if (req.name() != null) turf.setName(req.name());
        if (req.description() != null) turf.setDescription(req.description());
        if (req.address() != null) turf.setAddress(req.address());
        if (req.city() != null) turf.setCity(req.city());
        if (req.contactPhone() != null) turf.setContactPhone(req.contactPhone());
        turf.setStatus(ListingStatus.PENDING);
        turfRepository.save(turf);

        List<String> photoUrls;
        if (req.photos() != null) {
            turfPhotoRepository.deleteAllByTurfId(turfId);
            final Turf savedTurf = turf;
            for (String url : req.photos()) {
                TurfPhoto photo = new TurfPhoto();
                photo.setTurf(savedTurf);
                photo.setPhotoUrl(url);
                turfPhotoRepository.save(photo);
            }
            photoUrls = req.photos();
        } else {
            photoUrls = turfPhotoRepository.findByTurfIdOrdered(turfId)
                    .stream().map(TurfPhoto::getPhotoUrl).collect(Collectors.toList());
        }

        return new TurfResponse(
                turf.getId(),
                owner.getId(),
                turf.getName(),
                turf.getDescription(),
                turf.getAddress(),
                turf.getCity(),
                turf.getContactPhone(),
                turf.getStatus().name(),
                previousStatus.name(),
                turf.getAvgRating(),
                turf.getReviewCount(),
                null,
                photoUrls,
                null,
                null,
                LocalDateTime.now().toString()
        );
    }

    @Transactional
    public void deleteTurf(User owner, Long turfId) {
        Turf turf = resolveOwnedTurf(turfId, owner.getId());

        List<SubCourt> subCourts = subCourtRepository.findByTurfIdOrdered(turfId);
        if (!subCourts.isEmpty()) {
            List<Long> ids = subCourts.stream().map(SubCourt::getId).collect(Collectors.toList());
            // Phase 5: narrow this guard to block deletion only for CONFIRMED
            // (and possibly COMPLETED) bookings. CANCELLED/REFUNDED must NOT block
            // deletion per DECISIONS.md §3 (they are terminal/dead states).
            if (bookingRepository.countBySubCourtIdIn(ids) > 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Cannot delete turf with existing bookings");
            }
            subCourtRepository.deleteAllByTurfId(turfId);
        }

        turfPhotoRepository.deleteAllByTurfId(turfId);
        turfRepository.delete(turf);
    }

    // -------------------------------------------------------------------------
    // Sub-courts
    // -------------------------------------------------------------------------

    @Transactional
    public SubCourtResponse addSubCourt(User owner, Long turfId, SubCourtRequest req) {
        Turf turf = resolveOwnedTurf(turfId, owner.getId());

        if (!req.closingHour().isAfter(req.openingHour())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Closing time must be after opening time");
        }

        if (subCourtRepository.countByNameAndTurfId(req.name(), turfId) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Sub-court name already exists on this turf");
        }

        List<String> normalized = normalizeSports(req.sports());
        SubCourt sc = new SubCourt();
        sc.setTurf(turf);
        sc.setName(req.name());
        sc.setSports(serializeSports(normalized));
        sc.setHourlyPrice(req.hourlyPrice());
        sc.setOpeningHour(req.openingHour());
        sc.setClosingHour(req.closingHour());
        sc = subCourtRepository.save(sc);

        return toSubCourtResponse(sc, null, null);
    }

    public SubCourtListResponse listSubCourts(User owner, Long turfId) {
        Turf turf = resolveOwnedTurf(turfId, owner.getId());
        List<SubCourt> subCourts = subCourtRepository.findByTurfIdOrdered(turfId);
        List<SubCourtResponse> items = subCourts.stream()
                .map(sc -> toSubCourtResponse(sc, null, null))
                .collect(Collectors.toList());
        return new SubCourtListResponse(
                turf.getId(),
                turf.getName(),
                turf.getStatus().name(),
                items
        );
    }

    @Transactional
    public SubCourtResponse updateSubCourt(User owner, Long subCourtId, UpdateSubCourtRequest req) {
        if (req.name() == null && req.sports() == null && req.hourlyPrice() == null
                && req.openingHour() == null && req.closingHour() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one field must be provided");
        }

        SubCourt sc = resolveOwnedSubCourt(subCourtId, owner.getId());

        // Duplicate name check (only if name is changing)
        if (req.name() != null && !req.name().equals(sc.getName())) {
            if (subCourtRepository.countByNameAndTurfIdExcluding(req.name(), sc.getTurf().getId(), subCourtId) > 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Sub-court name already exists on this turf");
            }
        }

        // Determine effective hours after update
        var effectiveOpening = req.openingHour() != null ? req.openingHour() : sc.getOpeningHour();
        var effectiveClosing = req.closingHour() != null ? req.closingHour() : sc.getClosingHour();

        if (!effectiveClosing.isAfter(effectiveOpening)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Closing time must be after opening time");
        }

        // If hours are shrinking, check for booking conflicts
        boolean hoursShrinking = (req.openingHour() != null && req.openingHour().isAfter(sc.getOpeningHour()))
                || (req.closingHour() != null && req.closingHour().isBefore(sc.getClosingHour()));

        if (hoursShrinking) {
            List<Booking> upcoming = bookingRepository.findUpcomingBySubCourtIdAndStatus(
                    subCourtId, BookingStatus.CONFIRMED, LocalDate.now());
            List<Long> conflicts = new ArrayList<>();
            for (Booking booking : upcoming) {
                List<BookingSlot> slots = bookingSlotRepository.findByBookingId(booking.getId());
                boolean hasConflict = slots.stream().anyMatch(slot ->
                        slot.getStartTime().isBefore(effectiveOpening)
                                || slot.getEndTime().isAfter(effectiveClosing));
                if (hasConflict) conflicts.add(booking.getId());
            }
            if (!conflicts.isEmpty()) {
                throw new SchedulingConflictException(conflicts);
            }
        }

        ListingStatus previousStatus = sc.getStatus();

        if (req.name() != null) sc.setName(req.name());
        if (req.sports() != null) sc.setSports(serializeSports(normalizeSports(req.sports())));
        if (req.hourlyPrice() != null) sc.setHourlyPrice(req.hourlyPrice());
        if (req.openingHour() != null) sc.setOpeningHour(req.openingHour());
        if (req.closingHour() != null) sc.setClosingHour(req.closingHour());
        sc.setStatus(ListingStatus.PENDING);
        subCourtRepository.save(sc);

        return toSubCourtResponse(sc, previousStatus.name(), LocalDateTime.now().toString());
    }

    @Transactional
    public void deleteSubCourt(User owner, Long subCourtId) {
        SubCourt sc = resolveOwnedSubCourt(subCourtId, owner.getId());

        // Phase 5: narrow this guard to block deletion only for CONFIRMED
        // (and possibly COMPLETED) bookings. CANCELLED/REFUNDED must NOT block
        // deletion per DECISIONS.md §3 (they are terminal/dead states).
        if (bookingRepository.countBySubCourtId(subCourtId) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot delete sub-court with existing bookings");
        }

        subCourtRepository.delete(sc);
    }

    // -------------------------------------------------------------------------
    // Photos
    // -------------------------------------------------------------------------

    @Transactional
    public PhotoResponse addPhoto(User owner, Long turfId, AddPhotoRequest req) {
        Turf turf = resolveOwnedTurf(turfId, owner.getId());

        TurfPhoto photo = new TurfPhoto();
        photo.setTurf(turf);
        photo.setPhotoUrl(req.photoUrl());
        photo = turfPhotoRepository.save(photo);

        return new PhotoResponse(photo.getId(), turfId, photo.getPhotoUrl());
    }

    public List<PhotoResponse> listPhotos(User owner, Long turfId) {
        resolveOwnedTurf(turfId, owner.getId());
        return turfPhotoRepository.findByTurfIdOrdered(turfId).stream()
                .map(p -> new PhotoResponse(p.getId(), turfId, p.getPhotoUrl()))
                .collect(Collectors.toList());
    }

    @Transactional
    public void deletePhoto(User owner, Long turfId, Long photoId) {
        TurfPhoto photo = resolveOwnedPhoto(photoId, turfId, owner.getId());
        turfPhotoRepository.delete(photo);
    }

    // -------------------------------------------------------------------------
    // Ownership helpers — single DB query checks both existence and ownership;
    // returns the same 404 whether the resource doesn't exist or belongs to another owner.
    // -------------------------------------------------------------------------

    private Turf resolveOwnedTurf(Long turfId, Long ownerId) {
        return turfRepository.findByIdAndOwnerId(turfId, ownerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Turf not found"));
    }

    private SubCourt resolveOwnedSubCourt(Long subCourtId, Long ownerId) {
        return subCourtRepository.findByIdAndOwnerId(subCourtId, ownerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sub-court not found"));
    }

    private TurfPhoto resolveOwnedPhoto(Long photoId, Long turfId, Long ownerId) {
        return turfPhotoRepository.findByIdAndTurfIdAndOwnerId(photoId, turfId, ownerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found"));
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    private boolean isBankComplete(OwnerProfile profile) {
        return profile.getBankAccountNumber() != null && !profile.getBankAccountNumber().isBlank()
                && profile.getIfscCode() != null && !profile.getIfscCode().isBlank();
    }

    private Sort resolveSort(String sortBy) {
        return switch (sortBy) {
            case "created_asc" -> Sort.by(Sort.Direction.ASC, "createdAt");
            case "name_asc"    -> Sort.by(Sort.Direction.ASC, "name");
            case "created_desc" -> Sort.by(Sort.Direction.DESC, "createdAt");
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid sort_by value: " + sortBy);
        };
    }

    private ListingStatus parseListingStatus(String status) {
        try {
            return ListingStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid status value: " + status);
        }
    }

    private TurfSummary toTurfSummary(Turf turf) {
        List<SubCourt> subCourts = subCourtRepository.findByTurfIdOrdered(turf.getId());
        List<String> allSports = computeAllSports(subCourts);

        BigDecimal minPrice = null;
        BigDecimal maxPrice = null;
        for (SubCourt sc : subCourts) {
            if (minPrice == null || sc.getHourlyPrice().compareTo(minPrice) < 0) {
                minPrice = sc.getHourlyPrice();
            }
            if (maxPrice == null || sc.getHourlyPrice().compareTo(maxPrice) > 0) {
                maxPrice = sc.getHourlyPrice();
            }
        }

        String coverPhotoUrl = turfPhotoRepository.findByTurfIdOrdered(turf.getId())
                .stream().findFirst().map(TurfPhoto::getPhotoUrl).orElse(null);

        return new TurfSummary(
                turf.getId(),
                turf.getName(),
                turf.getCity(),
                turf.getAddress(),
                coverPhotoUrl,
                allSports,
                subCourts.size(),
                minPrice,
                maxPrice,
                turf.getStatus().name(),
                turf.getAvgRating(),
                turf.getReviewCount(),
                turf.getCreatedAt() != null ? turf.getCreatedAt().toString() : null
        );
    }

    private TurfResponse buildTurfResponseFull(Turf turf, Long ownerId,
                                                List<String> photoUrls,
                                                List<SubCourt> subCourts,
                                                List<String> allSports) {
        List<TurfResponse.SubCourtItem> scItems = subCourts.stream()
                .map(sc -> new TurfResponse.SubCourtItem(
                        sc.getId(),
                        sc.getName(),
                        parseSports(sc.getSports()),
                        sc.getHourlyPrice(),
                        TIME_FMT.format(sc.getOpeningHour()),
                        TIME_FMT.format(sc.getClosingHour()),
                        sc.getStatus().name()
                ))
                .collect(Collectors.toList());

        return new TurfResponse(
                turf.getId(),
                ownerId,
                turf.getName(),
                turf.getDescription(),
                turf.getAddress(),
                turf.getCity(),
                turf.getContactPhone(),
                turf.getStatus().name(),
                null,
                turf.getAvgRating(),
                turf.getReviewCount(),
                allSports,
                photoUrls,
                scItems,
                turf.getCreatedAt() != null ? turf.getCreatedAt().toString() : null,
                null
        );
    }

    private SubCourtResponse toSubCourtResponse(SubCourt sc, String previousStatus, String updatedAt) {
        return new SubCourtResponse(
                sc.getId(),
                sc.getTurf().getId(),
                sc.getName(),
                parseSports(sc.getSports()),
                sc.getHourlyPrice(),
                TIME_FMT.format(sc.getOpeningHour()),
                TIME_FMT.format(sc.getClosingHour()),
                sc.getStatus().name(),
                previousStatus,
                updatedAt
        );
    }

    private String normalizeSport(String sport) {
        String trimmed = sport.trim();
        if (trimmed.isEmpty()) return null;
        String[] words = trimmed.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String word : words) {
            if (sb.length() > 0) sb.append(" ");
            sb.append(Character.toUpperCase(word.charAt(0)))
              .append(word.substring(1).toLowerCase());
        }
        return sb.toString();
    }

    private List<String> normalizeSports(List<String> sports) {
        Set<String> seen = new LinkedHashSet<>();
        for (String s : sports) {
            if (s != null && !s.isBlank()) {
                String normalized = normalizeSport(s);
                if (normalized != null) seen.add(normalized);
            }
        }
        return new ArrayList<>(seen);
    }

    private String serializeSports(List<String> sports) {
        try {
            return objectMapper.writeValueAsString(sports);
        } catch (Exception e) {
            return "[]";
        }
    }

    private List<String> parseSports(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<String> computeAllSports(List<SubCourt> subCourts) {
        Set<String> all = new LinkedHashSet<>();
        for (SubCourt sc : subCourts) {
            all.addAll(parseSports(sc.getSports()));
        }
        return new ArrayList<>(all);
    }
}
