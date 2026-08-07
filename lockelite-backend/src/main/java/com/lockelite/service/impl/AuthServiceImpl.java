package com.lockelite.service.impl;

import com.lockelite.audit.AuditLogService;
import com.lockelite.dto.request.LoginRequest;
import com.lockelite.dto.request.RegisterRequest;
import com.lockelite.exception.BusinessException;
import com.lockelite.model.*;
import com.lockelite.repository.*;
import com.lockelite.security.JwtUtil;
import com.lockelite.service.AuthService;
import com.lockelite.service.EmailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
@Transactional
public class AuthServiceImpl implements AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthServiceImpl.class);

    @Autowired private UserRepository userRepository;
    @Autowired private OtpTokenRepository otpTokenRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private EmailService emailService;
    @Autowired private AuditLogService auditLogService;

    @Override
    public void register(RegisterRequest req) {
        if (!req.isTermsAccepted()) throw new BusinessException("You must accept the terms and conditions");
        if (userRepository.existsByEmail(req.getEmail())) throw new BusinessException("Email already registered");
        if (userRepository.existsByUsername(req.getUsername())) throw new BusinessException("Username already taken");

        User user = User.builder()
                .fullName(req.getFullName())
                .email(req.getEmail())
                .username(req.getUsername())
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .phoneNumber(req.getPhoneNumber())
                .dateOfBirth(req.getDateOfBirth())
                .role(User.Role.CUSTOMER)
                .isActive(true)
                .emailVerified(false)
                .passwordChanged(true)
                .build();

        User saved = userRepository.save(user);
        log.info("New customer registered: {}", saved.getEmail());

        // Send OTP
        String otp = generateAndSaveOtp(saved.getId(), OtpToken.OtpType.EMAIL);
        emailService.sendOtpEmail(saved.getEmail(), saved.getFullName(), otp);
        auditLogService.log(saved.getId(), "USER_REGISTERED", "User", saved.getId(), null, "PENDING_VERIFICATION", null);
    }

    @Override
    public void verifyOtp(String email, String otp) {
        User user = userRepository.findByEmail(email).orElseThrow(() -> new BusinessException("User not found"));
        OtpToken token = otpTokenRepository.findTopByUserIdAndTypeAndUsedFalseOrderByCreatedAtDesc(user.getId(), OtpToken.OtpType.EMAIL)
                .orElseThrow(() -> new BusinessException("OTP not found or already used"));

        if (token.getExpiresAt().isBefore(LocalDateTime.now())) throw new BusinessException("OTP has expired. Please request a new one.");
        if (!token.getOtp().equals(otp)) throw new BusinessException("Invalid OTP");

        token.setUsed(true);
        otpTokenRepository.save(token);
        user.setEmailVerified(true);
        user.setIsActive(true);
        userRepository.save(user);
        auditLogService.log(user.getId(), "EMAIL_VERIFIED", "User", user.getId(), "UNVERIFIED", "VERIFIED", null);
    }

    @Override
    public void resendOtp(String email) {
        User user = userRepository.findByEmail(email).orElseThrow(() -> new BusinessException("User not found"));
        String otp = generateAndSaveOtp(user.getId(), OtpToken.OtpType.EMAIL);
        emailService.sendOtpEmail(user.getEmail(), user.getFullName(), otp);
    }

    @Override
    public Map<String, Object> login(LoginRequest req) {
        User user = userRepository.findByEmailOrUsername(req.getEmailOrUsername(), req.getEmailOrUsername())
                .orElseThrow(() -> new BusinessException("Invalid credentials"));

        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash()))
            throw new BusinessException("Invalid credentials");

        if (!user.getEmailVerified())
            throw new BusinessException("Please verify your email before signing in");

        if (!user.getIsActive())
            throw new BusinessException("Your account has been deactivated. Contact support.");

        String token = jwtUtil.generateToken(user);
        auditLogService.log(user.getId(), "USER_LOGIN", "User", user.getId(), null, user.getRole().name(), null);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("token", token);
        response.put("role", user.getRole().name());
        response.put("passwordChanged", user.getPasswordChanged());
        response.put("branchId", user.getBranchId());
        response.put("userId", user.getId());
        return response;
    }

    @Override
    public void forgotPassword(String email) {
        User user = userRepository.findByEmail(email).orElseThrow(() -> new BusinessException("No account found with this email"));
        String resetToken = UUID.randomUUID().toString();
        OtpToken token = OtpToken.builder()
                .userId(user.getId()).otp(resetToken)
                .type(OtpToken.OtpType.PASSWORD_RESET)
                .expiresAt(LocalDateTime.now().plusHours(1))
                .used(false).build();
        otpTokenRepository.save(token);
        emailService.sendPasswordResetEmail(email, user.getFullName(), resetToken);
    }

    private void validatePasswordStrength(String password) {
        if (password == null || password.trim().isEmpty()) {
            throw new BusinessException("Password is required");
        }
        if (password.length() < 8) {
            throw new BusinessException("Password must be at least 8 characters long");
        }
        if (!password.matches("^(?=.*[a-zA-Z])(?=.*\\d)(?=.*[@$!%*?&#])[A-Za-z\\d@$!%*?&#]{8,}$")) {
            throw new BusinessException("Password must contain at least one letter, one number, and one special character");
        }
    }

    @Override
    public void resetPassword(String resetToken, String newPassword) {
        validatePasswordStrength(newPassword);
        OtpToken token = otpTokenRepository.findByOtpAndUsedFalse(resetToken)
                .orElseThrow(() -> new BusinessException("Invalid or expired reset link"));
        if (token.getExpiresAt().isBefore(LocalDateTime.now())) throw new BusinessException("Reset link has expired");
        User user = userRepository.findById(token.getUserId()).orElseThrow(() -> new BusinessException("User not found"));
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setPasswordChanged(true);
        userRepository.save(user);
        token.setUsed(true);
        otpTokenRepository.save(token);
        auditLogService.log(user.getId(), "PASSWORD_RESET", "User", user.getId(), null, null, null);
    }

    @Override
    public void changePassword(Long userId, String currentPassword, String newPassword) {
        validatePasswordStrength(newPassword);
        User user = userRepository.findById(userId).orElseThrow(() -> new BusinessException("User not found"));
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash()))
            throw new BusinessException("Current password is incorrect");
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setPasswordChanged(true);
        userRepository.save(user);
        auditLogService.log(userId, "PASSWORD_CHANGED", "User", userId, null, null, null);
    }

    private String generateAndSaveOtp(Long userId, OtpToken.OtpType type) {
        String otp = String.format("%06d", new Random().nextInt(999999));
        OtpToken token = OtpToken.builder()
                .userId(userId).otp(otp).type(type)
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .used(false).build();
        otpTokenRepository.save(token);
        return otp;
    }
}
