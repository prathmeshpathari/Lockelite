package com.lockelite.controller;

import com.lockelite.dto.request.*;
import com.lockelite.security.JwtUtil;
import com.lockelite.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.LinkedHashMap;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Authentication", description = "Register, login, OTP verification, password management")
public class AuthController {

    @Autowired private AuthService authService;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private com.lockelite.repository.UserRepository userRepository;

    @PostMapping("/register")
    @Operation(summary = "Register new customer account")
    public ResponseEntity<Map<String, String>> register(@Valid @RequestBody RegisterRequest req) {
        authService.register(req);
        return ResponseEntity.ok(Map.of("message", "Registration successful. OTP sent to " + req.getEmail()));
    }

    @PostMapping("/verify-otp")
    @Operation(summary = "Verify email OTP")
    public ResponseEntity<Map<String, Object>> verifyOtp(@RequestBody Map<String, String> req) {
        authService.verifyOtp(req.get("email"), req.get("otp"));
        com.lockelite.model.User user = userRepository.findByEmail(req.get("email")).orElseThrow();
        String token = jwtUtil.generateToken(user);
        
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Email verified successfully");
        response.put("token", token);
        response.put("role", user.getRole().name());
        response.put("passwordChanged", user.getPasswordChanged());
        response.put("branchId", user.getBranchId());
        response.put("userId", user.getId());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/resend-otp")
    @Operation(summary = "Resend verification OTP")
    public ResponseEntity<Map<String, String>> resendOtp(@RequestBody Map<String, String> req) {
        authService.resendOtp(req.get("email"));
        return ResponseEntity.ok(Map.of("message", "OTP resent successfully"));
    }

    @PostMapping("/login")
    @Operation(summary = "Login — role detected automatically")
    public ResponseEntity<Map<String, Object>> login(@Valid @RequestBody LoginRequest req) {
        Map<String, Object> result = authService.login(req);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/forgot-password")
    @Operation(summary = "Send password reset link")
    public ResponseEntity<Map<String, String>> forgotPassword(@RequestBody Map<String, String> req) {
        authService.forgotPassword(req.get("email"));
        return ResponseEntity.ok(Map.of("message", "Password reset link sent to your email"));
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Reset password using token")
    public ResponseEntity<Map<String, String>> resetPassword(@RequestBody Map<String, String> req) {
        authService.resetPassword(req.get("token"), req.get("newPassword"));
        return ResponseEntity.ok(Map.of("message", "Password reset successfully"));
    }

    @PostMapping("/change-password")
    @Operation(summary = "Change password (required on employee first login)")
    public ResponseEntity<Map<String, String>> changePassword(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, String> req) {
        String token = authHeader.substring(7);
        Long userId = jwtUtil.extractUserId(token);
        authService.changePassword(userId, req.get("currentPassword"), req.get("newPassword"));
        com.lockelite.model.User user = userRepository.findById(userId).orElseThrow();
        String newToken = jwtUtil.generateToken(user);
        return ResponseEntity.ok(Map.of("message", "Password changed successfully", "token", newToken));
    }
}
