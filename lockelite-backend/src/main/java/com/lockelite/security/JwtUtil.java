package com.lockelite.security;

import com.lockelite.model.Bank;
import com.lockelite.model.User;
import com.lockelite.repository.BankRepository;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.*;

@Component
public class JwtUtil {

    private static final Logger log = LoggerFactory.getLogger(JwtUtil.class);

    @Autowired
    private BankRepository bankRepository;

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration-ms}")
    private long expirationMs;

    private SecretKey getKey() {
        return Keys.hmacShaKeyFor(secret.getBytes());
    }

    /**
     * Generate JWT token embedding full bank theme so frontend can
     * apply the correct colors/layout immediately on login — no extra API call.
     */
    public String generateToken(User user) {
        Map<String, Object> claims = new HashMap<>();

        // ── Core user claims ──────────────────────────────────────────
        claims.put("userId",          user.getId());
        claims.put("role",            user.getRole().name());
        claims.put("fullName",        user.getFullName());
        claims.put("email",           user.getEmail());
        claims.put("bankId",          user.getBankId());
        claims.put("branchId",        user.getBranchId());
        claims.put("passwordChanged", user.getPasswordChanged());
        claims.put("emailVerified",   user.getEmailVerified());

        // ── Bank theme claims (embedded in JWT for instant theming) ───
        if (user.getBankId() != null) {
            bankRepository.findById(user.getBankId()).ifPresent(bank -> {
                claims.put("bankCode",     bank.getCode());
                claims.put("bankName",     bank.getName());
                claims.put("primaryColor", bank.getPrimaryColor());
                claims.put("sidebarColor", bank.getSidebarColor());
                claims.put("bgColor",      bank.getBgColor());
                claims.put("accentColor",  bank.getAccentColor());
                claims.put("layout",       bank.getLayout());
                claims.put("logoText",     bank.getLogoText());
            });
        } else {
            // Default LockElite theme
            claims.put("bankCode",     "LOCKELITE");
            claims.put("bankName",     "LockElite");
            claims.put("primaryColor", "#F68222");
            claims.put("sidebarColor", "#0f172a");
            claims.put("bgColor",      "#F5F0E8");
            claims.put("accentColor",  "#FFF0E0");
            claims.put("layout",       "sidebar");
            claims.put("logoText",     "LE");
        }

        return Jwts.builder()
                .claims(claims)
                .subject(user.getEmail())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(getKey())
                .compact();
    }

    public Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String extractEmail(String token) {
        return extractAllClaims(token).getSubject();
    }

    public String extractRole(String token) {
        return (String) extractAllClaims(token).get("role");
    }

    public Long extractUserId(String token) {
        Object val = extractAllClaims(token).get("userId");
        if (val instanceof Integer) return ((Integer) val).longValue();
        if (val instanceof Long)    return (Long) val;
        return Long.parseLong(val.toString());
    }

    public boolean isTokenValid(String token) {
        try {
            extractAllClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Invalid JWT token: {}", e.getMessage());
            return false;
        }
    }
}
