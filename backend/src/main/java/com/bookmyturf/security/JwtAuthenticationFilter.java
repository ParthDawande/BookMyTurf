package com.bookmyturf.security;

import com.bookmyturf.model.User;
import com.bookmyturf.model.UserStatus;
import com.bookmyturf.repository.UserRepository;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;

    public JwtAuthenticationFilter(JwtUtil jwtUtil, UserRepository userRepository) {
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            // No token present — proceed; Spring Security enforces auth for protected routes.
            chain.doFilter(request, response);
            return;
        }

        String token = header.substring(7);
        Long userId;
        try {
            userId = jwtUtil.getUserId(token);
        } catch (JwtException | IllegalArgumentException e) {
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized");
            return;
        }

        // DB lookup — authoritative source for user existence and status.
        // The token's status claim is not trusted for the access decision (DECISIONS.md):
        // a user banned after token issuance must lose access immediately, not at token expiry.
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized");
            return;
        }

        if (user.getStatus() == UserStatus.SUSPENDED || user.getStatus() == UserStatus.BANNED) {
            writeError(response, HttpServletResponse.SC_FORBIDDEN, "Forbidden");
            return;
        }

        var auth = new UsernamePasswordAuthenticationToken(
                user,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
        );
        SecurityContextHolder.getContext().setAuthentication(auth);
        chain.doFilter(request, response);
    }

    private void writeError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"" + message + "\"}");
    }
}
