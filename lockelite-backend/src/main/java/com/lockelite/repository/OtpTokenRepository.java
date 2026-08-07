package com.lockelite.repository;

import com.lockelite.model.OtpToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface OtpTokenRepository extends JpaRepository<OtpToken, Long> {
    Optional<OtpToken> findTopByUserIdAndTypeAndUsedFalseOrderByCreatedAtDesc(Long userId, OtpToken.OtpType type);
    Optional<OtpToken> findByOtpAndUsedFalse(String otp);
}
