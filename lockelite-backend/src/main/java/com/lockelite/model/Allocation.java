package com.lockelite.model;

import jakarta.persistence.*;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "allocations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Allocation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "locker_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Locker locker;

    @Column(name = "tenure_months", nullable = false) private Integer tenureMonths;
    @Column(name = "rent_amount", nullable = false, precision = 10, scale = 2) private BigDecimal rentAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AllocationStatus status = AllocationStatus.PENDING;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "officer_1_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User officer1;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "officer_2_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User officer2;

    @Column(name = "requested_at") private LocalDateTime requestedAt;
    @Column(name = "approved_at") private LocalDateTime approvedAt;
    @Column(name = "rejection_reason", columnDefinition = "TEXT") private String rejectionReason;

    @PrePersist void onCreate() { this.requestedAt = LocalDateTime.now(); }

    public enum AllocationStatus { PENDING, PARTIALLY_APPROVED, APPROVED, REJECTED }
}
