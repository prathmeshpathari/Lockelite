package com.lockelite.model;

import jakarta.persistence.*;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "customer_profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomerProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User user;

    // ─── Personal Details ───────────────────────────────────────────
    @Column(name = "full_name", length = 100)
    private String fullName;                   // ← ADDED (was missing, caused the error)

    @Column(name = "father_name", length = 100)
    private String fatherName;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(name = "phone_number", length = 15)
    private String phoneNumber;

    @Column(name = "bank_account", length = 20)
    private String bankAccount;

    // ─── Aadhaar ────────────────────────────────────────────────────
    @Column(name = "aadhaar_masked", length = 20)
    private String aadhaarMasked;              // nullable = true (set after verification)

    @Column(name = "aadhaar_pdf_path")
    private String aadhaarPdfPath;

    @Column(name = "aadhaar_verified")
    private Boolean aadhaarVerified = false;

    // ─── PAN ────────────────────────────────────────────────────────
    @Column(name = "pan_number", length = 10)
    private String panNumber;

    @Column(name = "pan_pdf_path")
    private String panPdfPath;

    @Column(name = "pan_verified")
    private Boolean panVerified = false;

    // ─── Verification result ────────────────────────────────────────
    @Column(name = "name_match")
    private Boolean nameMatch = false;

    // ─── KYC Status ─────────────────────────────────────────────────
    @Enumerated(EnumType.STRING)
    @Column(name = "kyc_status")
    private KycStatus kycStatus = KycStatus.PENDING;

    @Column(name = "reviewed_by")
    private Long reviewedBy;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    // ─── Nominee (optional) ─────────────────────────────────────────
    @Column(name = "nominee_name", length = 100)
    private String nomineeName;

    @Column(name = "nominee_email", length = 150)
    private String nomineeEmail;

    @Column(name = "nominee_phone", length = 15)
    private String nomineePhone;

    @Column(name = "nominee_address", columnDefinition = "TEXT")
    private String nomineeAddress;

    public enum KycStatus { PENDING, APPROVED, REJECTED }
}
