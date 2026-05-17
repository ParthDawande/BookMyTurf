package com.bookmyturf.controller;

import com.bookmyturf.dto.auth.CustomerRegisterRequest;
import com.bookmyturf.dto.auth.CustomerRegisterResponse;
import com.bookmyturf.dto.auth.LoginRequest;
import com.bookmyturf.dto.auth.LoginResponse;
import com.bookmyturf.dto.auth.OwnerRegisterRequest;
import com.bookmyturf.dto.auth.OwnerRegisterResponse;
import com.bookmyturf.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register/customer")
    @ResponseStatus(HttpStatus.CREATED)
    public CustomerRegisterResponse registerCustomer(@Valid @RequestBody CustomerRegisterRequest req) {
        return authService.registerCustomer(req);
    }

    @PostMapping("/register/owner")
    @ResponseStatus(HttpStatus.CREATED)
    public OwnerRegisterResponse registerOwner(@Valid @RequestBody OwnerRegisterRequest req) {
        return authService.registerOwner(req);
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest req) {
        return authService.login(req);
    }
}
