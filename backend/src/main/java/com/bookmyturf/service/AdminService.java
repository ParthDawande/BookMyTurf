package com.bookmyturf.service;

import com.bookmyturf.dto.admin.AdminItem;
import com.bookmyturf.dto.admin.AdminListResponse;
import com.bookmyturf.dto.admin.CreateAccountRequest;
import com.bookmyturf.dto.admin.CreateAdminResponse;
import com.bookmyturf.dto.admin.CreateStaffResponse;
import com.bookmyturf.dto.admin.PendingSubCourtItem;
import com.bookmyturf.dto.admin.PendingSubCourtListResponse;
import com.bookmyturf.dto.admin.PendingTurfItem;
import com.bookmyturf.dto.admin.PendingTurfListResponse;
import com.bookmyturf.dto.admin.ReasonRequest;
import com.bookmyturf.dto.admin.RemoveAdminResponse;
import com.bookmyturf.dto.admin.SubCourtApprovalResponse;
import com.bookmyturf.dto.admin.TurfApprovalResponse;
import com.bookmyturf.dto.admin.UserStatusChangeResponse;
import com.bookmyturf.model.AdminProfile;
import com.bookmyturf.model.ListingStatus;
import com.bookmyturf.model.Notification;
import com.bookmyturf.model.OwnerProfile;
import com.bookmyturf.model.Role;
import com.bookmyturf.model.StaffProfile;
import com.bookmyturf.model.SubCourt;
import com.bookmyturf.model.Turf;
import com.bookmyturf.model.TurfPhoto;
import com.bookmyturf.model.User;
import com.bookmyturf.model.UserStatus;
import com.bookmyturf.repository.AdminProfileRepository;
import com.bookmyturf.repository.NotificationRepository;
import com.bookmyturf.repository.OwnerProfileRepository;
import com.bookmyturf.repository.StaffProfileRepository;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class AdminService {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    private final UserRepository userRepository;
    private final AdminProfileRepository adminProfileRepository;
    private final StaffProfileRepository staffProfileRepository;
    private final OwnerProfileRepository ownerProfileRepository;
    private final TurfRepository turfRepository;
    private final TurfPhotoRepository turfPhotoRepository;
    private final SubCourtRepository subCourtRepository;
    private final NotificationRepository notificationRepository;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;

    public AdminService(UserRepository userRepository,
                        AdminProfileRepository adminProfileRepository,
                        StaffProfileRepository staffProfileRepository,
                        OwnerProfileRepository ownerProfileRepository,
                        TurfRepository turfRepository,
                        TurfPhotoRepository turfPhotoRepository,
                        SubCourtRepository subCourtRepository,
                        NotificationRepository notificationRepository,
                        PasswordEncoder passwordEncoder,
                        ObjectMapper objectMapper) {
        this.userRepository = userRepository;
        this.adminProfileRepository = adminProfileRepository;
        this.staffProfileRepository = staffProfileRepository;
        this.ownerProfileRepository = ownerProfileRepository;
        this.turfRepository = turfRepository;
        this.turfPhotoRepository = turfPhotoRepository;
        this.subCourtRepository = subCourtRepository;
        this.notificationRepository = notificationRepository;
        this.passwordEncoder = passwordEncoder;
        this.objectMapper = objectMapper;
    }

    // -------------------------------------------------------------------------
    // Account creation
    // -------------------------------------------------------------------------

    @Transactional
    public CreateAdminResponse createAdmin(CreateAccountRequest req) {
        checkEmailUnique(req.email());
        checkPhoneUnique(req.phone());

        User user = new User();
        user.setEmail(req.email());
        user.setPhone(req.phone());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setRole(Role.ADMIN);
        user.setStatus(UserStatus.ACTIVE);
        user = userRepository.save(user);

        AdminProfile profile = new AdminProfile();
        profile.setUser(user);
        profile.setName(req.name());
        adminProfileRepository.save(profile);

        return new CreateAdminResponse(
                user.getId(),
                profile.getName(),
                user.getEmail(),
                user.getPhone(),
                user.getRole().name(),
                user.getStatus().name(),
                user.getCreatedAt() != null ? user.getCreatedAt().toString() : null
        );
    }

    @Transactional
    public CreateStaffResponse createStaff(User callerAdmin, CreateAccountRequest req) {
        checkEmailUnique(req.email());
        checkPhoneUnique(req.phone());

        User user = new User();
        user.setEmail(req.email());
        user.setPhone(req.phone());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setRole(Role.STAFF);
        user.setStatus(UserStatus.ACTIVE);
        user = userRepository.save(user);

        StaffProfile profile = new StaffProfile();
        profile.setUser(user);
        profile.setName(req.name());
        profile.setCreatedByAdmin(callerAdmin);
        staffProfileRepository.save(profile);

        AdminProfile callerProfile = adminProfileRepository.findById(callerAdmin.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Admin profile not found"));

        return new CreateStaffResponse(
                user.getId(),
                profile.getName(),
                user.getEmail(),
                user.getPhone(),
                user.getRole().name(),
                user.getStatus().name(),
                new CreateStaffResponse.CreatedByAdmin(callerAdmin.getId(), callerProfile.getName()),
                user.getCreatedAt() != null ? user.getCreatedAt().toString() : null
        );
    }

    // -------------------------------------------------------------------------
    // Admin list and removal
    // -------------------------------------------------------------------------

    public AdminListResponse listAdmins(User caller, String search, String sortBy, int page, int pageSize) {
        if (pageSize > 100) pageSize = 100;
        if (page < 1) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid query parameter");

        List<User> activeAdmins = userRepository.findByRoleAndStatus(Role.ADMIN, UserStatus.ACTIVE);

        // Hydrate with names from admin_profiles, apply search
        List<AdminItem> items = new ArrayList<>();
        for (User u : activeAdmins) {
            AdminProfile ap = adminProfileRepository.findById(u.getId()).orElse(null);
            String name = ap != null ? ap.getName() : "";

            if (search != null && !search.isBlank()) {
                String term = search.trim().toLowerCase();
                boolean matchName = name.toLowerCase().contains(term);
                boolean matchEmail = u.getEmail().toLowerCase().contains(term);
                boolean matchPhone = u.getPhone().contains(term);
                if (!matchName && !matchEmail && !matchPhone) continue;
            }

            items.add(new AdminItem(
                    u.getId(),
                    name,
                    u.getEmail(),
                    u.getPhone(),
                    u.getCreatedAt() != null ? u.getCreatedAt().toString() : null,
                    u.getId().equals(caller.getId())
            ));
        }

        // Sort
        Comparator<AdminItem> comparator = switch (sortBy) {
            case "created_asc"  -> Comparator.comparing(AdminItem::createdAt, Comparator.nullsLast(Comparator.naturalOrder()));
            case "name_asc"     -> Comparator.comparing(AdminItem::name, String.CASE_INSENSITIVE_ORDER);
            default             -> Comparator.comparing(AdminItem::createdAt, Comparator.nullsLast(Comparator.reverseOrder()));
        };
        items.sort(comparator);

        long totalResults = items.size();
        int totalPages = (int) Math.ceil((double) totalResults / pageSize);
        int fromIndex = (page - 1) * pageSize;
        int toIndex = Math.min(fromIndex + pageSize, items.size());
        List<AdminItem> pageItems = fromIndex >= items.size() ? List.of() : items.subList(fromIndex, toIndex);

        return new AdminListResponse(page, pageSize, totalResults, Math.max(totalPages, 1), pageItems);
    }

    @Transactional
    public RemoveAdminResponse removeAdmin(User caller, Long targetId) {
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (target.getRole() != Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Target user is not an admin");
        }
        if (target.getStatus() == UserStatus.BANNED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Admin already removed");
        }
        if (target.getId().equals(caller.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot remove your own admin account");
        }

        long activeAdminCount = userRepository.countByRoleAndStatus(Role.ADMIN, UserStatus.ACTIVE);
        if (activeAdminCount <= 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot remove the last admin account");
        }

        target.setStatus(UserStatus.BANNED);
        userRepository.save(target);

        return new RemoveAdminResponse(targetId, true);
    }

    // -------------------------------------------------------------------------
    // User status management
    // -------------------------------------------------------------------------

    @Transactional
    public UserStatusChangeResponse suspendUser(Long targetId, ReasonRequest req) {
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (target.getRole() == Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Admins cannot be suspended");
        }
        if (target.getStatus() == UserStatus.SUSPENDED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User already suspended");
        }
        if (target.getStatus() == UserStatus.BANNED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot suspend a banned user");
        }

        UserStatus previous = target.getStatus();
        target.setStatus(UserStatus.SUSPENDED);
        userRepository.save(target);
        // reason accepted but not persisted (no audit table in v1)
        return new UserStatusChangeResponse(targetId, "SUSPENDED", previous.name());
    }

    @Transactional
    public UserStatusChangeResponse banUser(Long targetId, ReasonRequest req) {
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (target.getRole() == Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Admins cannot be banned");
        }
        if (target.getStatus() == UserStatus.BANNED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User already banned");
        }

        UserStatus previous = target.getStatus();
        target.setStatus(UserStatus.BANNED);
        userRepository.save(target);
        // reason accepted but not persisted (no audit table in v1)
        return new UserStatusChangeResponse(targetId, "BANNED", previous.name());
    }

    @Transactional
    public UserStatusChangeResponse activateUser(Long targetId, ReasonRequest req) {
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (target.getStatus() == UserStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User already active");
        }
        if (target.getStatus() == UserStatus.BANNED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Banned users cannot be reactivated");
        }

        UserStatus previous = target.getStatus();
        target.setStatus(UserStatus.ACTIVE);
        userRepository.save(target);
        // reason accepted but not persisted (no audit table in v1)
        return new UserStatusChangeResponse(targetId, "ACTIVE", previous.name());
    }

    // -------------------------------------------------------------------------
    // Turf moderation
    // -------------------------------------------------------------------------

    public PendingTurfListResponse listPendingTurfs(String city, String sortBy, int page, int pageSize) {
        if (pageSize > 100) pageSize = 100;
        if (page < 1) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid query parameter");

        Sort sort = "created_desc".equals(sortBy)
                ? Sort.by(Sort.Direction.DESC, "createdAt")
                : Sort.by(Sort.Direction.ASC, "createdAt");

        PageRequest pageable = PageRequest.of(page - 1, pageSize, sort);
        Page<Turf> turfPage = (city != null && !city.isBlank())
                ? turfRepository.findAllPendingByCity(city.trim(), pageable)
                : turfRepository.findAllPending(pageable);

        List<PendingTurfItem> items = turfPage.getContent().stream()
                .map(this::toPendingTurfItem)
                .collect(Collectors.toList());

        return new PendingTurfListResponse(page, pageSize, turfPage.getTotalElements(),
                turfPage.getTotalPages(), items);
    }

    @Transactional
    public TurfApprovalResponse approveTurf(Long turfId) {
        Turf turf = turfRepository.findById(turfId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Turf not found"));

        if (turf.getStatus() == ListingStatus.APPROVED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Turf already approved");
        }
        if (turf.getStatus() == ListingStatus.REJECTED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot approve a rejected turf");
        }

        ListingStatus previous = turf.getStatus();
        turf.setStatus(ListingStatus.APPROVED);
        turfRepository.save(turf);

        insertNotification(turf.getOwner(), "TURF_APPROVED",
                "Your turf \"" + turf.getName() + "\" has been approved.");

        return new TurfApprovalResponse(turfId, "APPROVED", previous.name());
    }

    @Transactional
    public TurfApprovalResponse rejectTurf(Long turfId, ReasonRequest req) {
        Turf turf = turfRepository.findById(turfId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Turf not found"));

        if (turf.getStatus() == ListingStatus.REJECTED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Turf already rejected");
        }
        if (turf.getStatus() == ListingStatus.APPROVED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot reject an approved turf");
        }

        ListingStatus previous = turf.getStatus();
        turf.setStatus(ListingStatus.REJECTED);
        turfRepository.save(turf);

        String reason = (req != null && req.reason() != null && !req.reason().isBlank())
                ? req.reason().trim() : null;
        String message = "Your turf \"" + turf.getName() + "\" has been rejected."
                + (reason != null ? " Reason: " + reason : "");
        insertNotification(turf.getOwner(), "TURF_REJECTED", message);

        return new TurfApprovalResponse(turfId, "REJECTED", previous.name());
    }

    // -------------------------------------------------------------------------
    // Sub-court moderation
    // -------------------------------------------------------------------------

    public PendingSubCourtListResponse listPendingSubCourts(Long turfId, String city, String sortBy,
                                                             int page, int pageSize) {
        if (pageSize > 100) pageSize = 100;
        if (page < 1) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid query parameter");

        if (turfId != null && !turfRepository.existsById(turfId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Turf not found");
        }

        Sort sort = "turf_name_asc".equals(sortBy)
                ? Sort.by(Sort.Direction.ASC, "turf.name")
                : Sort.by(Sort.Direction.ASC, "id");

        PageRequest pageable = PageRequest.of(page - 1, pageSize, sort);
        Page<SubCourt> scPage;
        boolean hasCity = city != null && !city.isBlank();

        if (turfId != null && hasCity) {
            scPage = subCourtRepository.findAllPendingByTurfIdAndCity(turfId, city.trim(), pageable);
        } else if (turfId != null) {
            scPage = subCourtRepository.findAllPendingByTurfId(turfId, pageable);
        } else if (hasCity) {
            scPage = subCourtRepository.findAllPendingByCity(city.trim(), pageable);
        } else {
            scPage = subCourtRepository.findAllPending(pageable);
        }

        List<PendingSubCourtItem> items = scPage.getContent().stream()
                .map(this::toPendingSubCourtItem)
                .collect(Collectors.toList());

        return new PendingSubCourtListResponse(page, pageSize, scPage.getTotalElements(),
                scPage.getTotalPages(), items);
    }

    @Transactional
    public SubCourtApprovalResponse approveSubCourt(Long subCourtId) {
        SubCourt sc = subCourtRepository.findById(subCourtId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sub-court not found"));

        if (sc.getStatus() == ListingStatus.APPROVED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sub-court already approved");
        }
        if (sc.getStatus() == ListingStatus.REJECTED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot approve a rejected sub-court");
        }

        ListingStatus previous = sc.getStatus();
        sc.setStatus(ListingStatus.APPROVED);
        subCourtRepository.save(sc);

        Turf turf = sc.getTurf();
        boolean publiclyVisible = turf.getStatus() == ListingStatus.APPROVED;

        insertNotification(turf.getOwner(), "SUBCOURT_APPROVED",
                "Your sub-court \"" + sc.getName() + "\" at \"" + turf.getName() + "\" has been approved.");

        return new SubCourtApprovalResponse(subCourtId, "APPROVED", previous.name(),
                turf.getId(), turf.getStatus().name(), publiclyVisible);
    }

    @Transactional
    public SubCourtApprovalResponse rejectSubCourt(Long subCourtId, ReasonRequest req) {
        SubCourt sc = subCourtRepository.findById(subCourtId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sub-court not found"));

        if (sc.getStatus() == ListingStatus.REJECTED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sub-court already rejected");
        }
        if (sc.getStatus() == ListingStatus.APPROVED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot reject an approved sub-court");
        }

        ListingStatus previous = sc.getStatus();
        sc.setStatus(ListingStatus.REJECTED);
        subCourtRepository.save(sc);

        Turf turf = sc.getTurf();
        String reason = (req != null && req.reason() != null && !req.reason().isBlank())
                ? req.reason().trim() : null;
        String message = "Your sub-court \"" + sc.getName() + "\" at \"" + turf.getName() + "\" has been rejected."
                + (reason != null ? " Reason: " + reason : "");
        insertNotification(turf.getOwner(), "SUBCOURT_REJECTED", message);

        return new SubCourtApprovalResponse(subCourtId, "REJECTED", previous.name(),
                turf.getId(), null, null);
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    private void checkEmailUnique(String email) {
        if (userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }
    }

    private void checkPhoneUnique(String phone) {
        if (userRepository.existsByPhone(phone)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Phone number already registered");
        }
    }

    private void insertNotification(User recipient, String type, String message) {
        Notification n = new Notification();
        n.setUser(recipient);
        n.setType(type);
        n.setMessage(message);
        n.setIsRead(false);
        notificationRepository.save(n);
    }

    private PendingTurfItem toPendingTurfItem(Turf turf) {
        User owner = turf.getOwner();
        OwnerProfile ownerProfile = ownerProfileRepository.findById(owner.getId()).orElse(null);
        String ownerName = ownerProfile != null ? ownerProfile.getName() : "";

        List<String> photoUrls = turfPhotoRepository.findByTurfIdOrdered(turf.getId())
                .stream().map(TurfPhoto::getPhotoUrl).collect(Collectors.toList());

        long total = subCourtRepository.countByTurfId(turf.getId());
        long pending = subCourtRepository.countByTurfIdAndStatus(turf.getId(), ListingStatus.PENDING);
        long approved = subCourtRepository.countByTurfIdAndStatus(turf.getId(), ListingStatus.APPROVED);
        long rejected = subCourtRepository.countByTurfIdAndStatus(turf.getId(), ListingStatus.REJECTED);

        return new PendingTurfItem(
                turf.getId(),
                turf.getName(),
                turf.getDescription(),
                turf.getAddress(),
                turf.getCity(),
                turf.getContactPhone(),
                turf.getStatus().name(),
                turf.getCreatedAt() != null ? turf.getCreatedAt().toString() : null,
                new PendingTurfItem.OwnerInfo(owner.getId(), ownerName, owner.getEmail(), owner.getPhone()),
                photoUrls,
                new PendingTurfItem.SubCourtsSummary(total, pending, approved, rejected)
        );
    }

    private PendingSubCourtItem toPendingSubCourtItem(SubCourt sc) {
        Turf turf = sc.getTurf();
        User owner = turf.getOwner();
        OwnerProfile ownerProfile = ownerProfileRepository.findById(owner.getId()).orElse(null);
        String ownerName = ownerProfile != null ? ownerProfile.getName() : "";

        List<String> sports = parseSports(sc.getSports());

        return new PendingSubCourtItem(
                sc.getId(),
                sc.getName(),
                sports,
                sc.getHourlyPrice(),
                TIME_FMT.format(sc.getOpeningHour()),
                TIME_FMT.format(sc.getClosingHour()),
                sc.getStatus().name(),
                new PendingSubCourtItem.TurfInfo(turf.getId(), turf.getName(), turf.getCity(), turf.getStatus().name()),
                new PendingSubCourtItem.OwnerInfo(owner.getId(), ownerName, owner.getPhone())
        );
    }

    private List<String> parseSports(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }
}
