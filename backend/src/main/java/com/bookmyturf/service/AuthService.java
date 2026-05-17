package com.bookmyturf.service;

import com.bookmyturf.dto.auth.CustomerRegisterRequest;
import com.bookmyturf.dto.auth.CustomerRegisterResponse;
import com.bookmyturf.dto.auth.LoginRequest;
import com.bookmyturf.dto.auth.LoginResponse;
import com.bookmyturf.dto.auth.OwnerRegisterRequest;
import com.bookmyturf.dto.auth.OwnerRegisterResponse;
import com.bookmyturf.model.AdminProfile;
import com.bookmyturf.model.CustomerProfile;
import com.bookmyturf.model.OwnerProfile;
import com.bookmyturf.model.Role;
import com.bookmyturf.model.StaffProfile;
import com.bookmyturf.model.User;
import com.bookmyturf.model.UserStatus;
import com.bookmyturf.repository.AdminProfileRepository;
import com.bookmyturf.repository.CustomerProfileRepository;
import com.bookmyturf.repository.OwnerProfileRepository;
import com.bookmyturf.repository.StaffProfileRepository;
import com.bookmyturf.repository.UserRepository;
import com.bookmyturf.security.JwtUtil;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private static final String OWNER_BANK_NOTE =
            "Bank details are required before payouts can be processed. Update them via PUT /api/owner/profile.";

    private final UserRepository userRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final OwnerProfileRepository ownerProfileRepository;
    private final StaffProfileRepository staffProfileRepository;
    private final AdminProfileRepository adminProfileRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthService(UserRepository userRepository,
                       CustomerProfileRepository customerProfileRepository,
                       OwnerProfileRepository ownerProfileRepository,
                       StaffProfileRepository staffProfileRepository,
                       AdminProfileRepository adminProfileRepository,
                       PasswordEncoder passwordEncoder,
                       JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.customerProfileRepository = customerProfileRepository;
        this.ownerProfileRepository = ownerProfileRepository;
        this.staffProfileRepository = staffProfileRepository;
        this.adminProfileRepository = adminProfileRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    @Transactional
    public CustomerRegisterResponse registerCustomer(CustomerRegisterRequest req) {
        checkEmailUnique(req.email());
        checkPhoneUnique(req.phone());

        User user = new User();
        user.setEmail(req.email());
        user.setPhone(req.phone());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setRole(Role.CUSTOMER);
        user.setStatus(UserStatus.ACTIVE);
        userRepository.save(user);

        CustomerProfile profile = new CustomerProfile();
        profile.setUser(user);
        profile.setName(req.name());
        profile.setCity(req.city());
        if (req.preferredSports() != null && !req.preferredSports().isEmpty()) {
            profile.setPreferredSports(String.join(",", req.preferredSports()));
        }
        customerProfileRepository.save(profile);

        String token = jwtUtil.generateToken(user.getId(), user.getRole(), user.getStatus());
        return new CustomerRegisterResponse(
                user.getId(),
                profile.getName(),
                user.getEmail(),
                user.getPhone(),
                profile.getCity(),
                user.getRole().name(),
                token,
                jwtUtil.getExpiresAt(token).toString()
        );
    }

    @Transactional
    public OwnerRegisterResponse registerOwner(OwnerRegisterRequest req) {
        checkEmailUnique(req.email());
        checkPhoneUnique(req.phone());

        // IFSC has its own distinct error message per API_DOC — validated here, not via @Pattern.
        if (req.ifscCode() != null && !req.ifscCode().isBlank()) {
            if (!req.ifscCode().matches("^[A-Z]{4}0[A-Z0-9]{6}$")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid IFSC code format");
            }
        }

        User user = new User();
        user.setEmail(req.email());
        user.setPhone(req.phone());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setRole(Role.OWNER);
        user.setStatus(UserStatus.ACTIVE);
        userRepository.save(user);

        OwnerProfile profile = new OwnerProfile();
        profile.setUser(user);
        profile.setName(req.name());
        profile.setBankAccountNumber(req.bankAccountNumber());
        profile.setIfscCode(req.ifscCode());
        ownerProfileRepository.save(profile);

        boolean bankDetailsComplete =
                req.bankAccountNumber() != null && !req.bankAccountNumber().isBlank()
                && req.ifscCode() != null && !req.ifscCode().isBlank();

        String token = jwtUtil.generateToken(user.getId(), user.getRole(), user.getStatus());
        return new OwnerRegisterResponse(
                user.getId(),
                profile.getName(),
                user.getEmail(),
                user.getPhone(),
                user.getRole().name(),
                bankDetailsComplete,
                token,
                jwtUtil.getExpiresAt(token).toString(),
                OWNER_BANK_NOTE
        );
    }

    public LoginResponse login(LoginRequest req) {
        User user = userRepository.findByEmail(req.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));

        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        if (user.getStatus() == UserStatus.SUSPENDED) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account suspended. Contact support.");
        }
        if (user.getStatus() == UserStatus.BANNED) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account banned.");
        }

        String name = fetchName(user);
        String token = jwtUtil.generateToken(user.getId(), user.getRole(), user.getStatus());
        return new LoginResponse(
                user.getId(),
                name,
                user.getEmail(),
                user.getRole().name(),
                token,
                jwtUtil.getExpiresAt(token).toString()
        );
    }

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

    private String fetchName(User user) {
        return switch (user.getRole()) {
            case CUSTOMER -> customerProfileRepository.findById(user.getId())
                    .map(CustomerProfile::getName).orElse("");
            case OWNER -> ownerProfileRepository.findById(user.getId())
                    .map(OwnerProfile::getName).orElse("");
            case STAFF -> staffProfileRepository.findById(user.getId())
                    .map(StaffProfile::getName).orElse("");
            case ADMIN -> adminProfileRepository.findById(user.getId())
                    .map(AdminProfile::getName).orElse("");
        };
    }
}
