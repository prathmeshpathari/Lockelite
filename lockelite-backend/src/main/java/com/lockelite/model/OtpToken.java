package com.lockelite.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "otp_tokens")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OtpToken {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false) private Long userId;
    @Column(nullable = false) private String otp;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OtpType type;

    @Column(name = "expires_at", nullable = false) private LocalDateTime expiresAt;
    @Column(nullable = false) private Boolean used = false;
    @Column(name = "created_at") private LocalDateTime createdAt;

    @PrePersist void onCreate() { this.createdAt = LocalDateTime.now(); if (this.used == null) this.used = false; }

    public enum OtpType { EMAIL, SMS, PASSWORD_RESET }
}
