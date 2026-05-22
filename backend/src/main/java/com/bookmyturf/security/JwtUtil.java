package com.bookmyturf.security;

import com.bookmyturf.model.Role;
import com.bookmyturf.model.UserStatus;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

@Component
public class JwtUtil {

    private final SecretKey key;
    private final long expirationMs;

    public JwtUtil(@Value("${app.jwt.secret}") String secret,
                   @Value("${app.jwt.expiration}") long expirationMs) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
        this.expirationMs = expirationMs;
    }

    public String generateToken(Long userId, Role role, UserStatus status) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("role", role.name())
                .claim("status", status.name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusMillis(expirationMs)))
                .signWith(key)
                .compact();
    }

    public Instant getExpiresAt(String token) {
        return parseClaims(token).getExpiration().toInstant().truncatedTo(ChronoUnit.SECONDS);
    }

    public Long getUserId(String token) {
        return Long.parseLong(parseClaims(token).getSubject());
    }

    /**
     * Generates a 15-minute signed reschedule token.
     * Same key as auth tokens; distinguished by type="RESCHEDULE" claim.
     * All money fields stored as plain strings to avoid floating-point precision loss.
     * new_slots_json: pipe-delimited "HH:mm-HH:mm" — same format as 5B Razorpay notes.
     * razorpayOrderId: null for NONE and REFUND scenarios.
     */
    public String generateRescheduleToken(Long bookingId, Long customerId,
                                          String newBookingDate, String newSlotsJson,
                                          BigDecimal newRate, BigDecimal oldTotal,
                                          BigDecimal newTotal, BigDecimal priceDiff,
                                          String razorpayOrderId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .claim("type", "RESCHEDULE")
                .claim("booking_id", bookingId)
                .claim("customer_id", customerId)
                .claim("new_booking_date", newBookingDate)
                .claim("new_slots_json", newSlotsJson)
                .claim("new_rate", newRate.toPlainString())
                .claim("old_total", oldTotal.toPlainString())
                .claim("new_total", newTotal.toPlainString())
                .claim("price_diff", priceDiff.toPlainString())
                .claim("razorpay_order_id", razorpayOrderId)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(900)))
                .signWith(key)
                .compact();
    }

    // Throws JwtException (expired, tampered, wrong key) if token is invalid.
    public Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
