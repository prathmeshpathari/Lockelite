package com.lockelite.service;

import com.lockelite.dto.request.LoginRequest;
import com.lockelite.dto.request.RegisterRequest;
import java.util.Map;

public interface AuthService {
    void register(RegisterRequest req);
    void verifyOtp(String email, String otp);
    void resendOtp(String email);
    Map<String, Object> login(LoginRequest req);
    void forgotPassword(String email);
    void resetPassword(String resetToken, String newPassword);
    void changePassword(Long userId, String currentPassword, String newPassword);
}
