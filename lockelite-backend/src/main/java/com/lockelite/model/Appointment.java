package com.lockelite.model;

import jakarta.persistence.*;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.LocalDateTime;

@Entity
@Table(name = "appointments")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Appointment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer","handler"})
    private User customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer","handler"})
    private Branch branch;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "locker_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer","handler"})
    private Locker locker;

    @Column(name = "visit_date",  nullable = false) private LocalDate  visitDate;
    @Column(name = "visit_time",  nullable = false) private LocalTime  visitTime;
    @Column(nullable = false, length = 100)          private String     purpose;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AppointmentStatus status = AppointmentStatus.UPCOMING;

    @Column(columnDefinition = "TEXT")  private String  notes;

    // ── Digital Access Key ──────────────────────────────────────────
    @Column(name = "digital_key", length = 12)
    private String digitalKey;                    // e.g. LK-A3F9B2

    @Column(name = "digital_key_sent")
    private Boolean digitalKeySent = false;       // has the email been dispatched?

    @Column(name = "digital_key_expires_at")
    private LocalDateTime digitalKeyExpiresAt;    // valid only during the visit window

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.digitalKeySent == null) this.digitalKeySent = false;
    }

    public enum AppointmentStatus { UPCOMING, CONFIRMED, COMPLETED, CANCELLED }
}
