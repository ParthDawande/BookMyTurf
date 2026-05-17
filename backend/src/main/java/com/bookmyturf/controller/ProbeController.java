package com.bookmyturf.controller;

// TEMPORARY — Phase 0/2 probe only. Delete this file before production.

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/probe")
public class ProbeController {

    @GetMapping("/500")
    public void trigger500() {
        throw new RuntimeException("Simulated internal error");
    }

    @PostMapping("/validate")
    public void triggerValidation(@Valid @RequestBody ProbeRequest body) {
    }

    // PHASE-2-ONLY: Proves that a valid JWT grants access to a protected route.
    // This endpoint requires authentication (falls under the "anyRequest().authenticated()" rule).
    // DELETE before production or when Phase 2 testing is complete.
    @GetMapping("/auth-check")
    public Map<String, String> authCheck() {
        return Map.of("status", "authenticated");
    }

    record ProbeRequest(@NotBlank String name, @NotNull Integer count) {}
}
