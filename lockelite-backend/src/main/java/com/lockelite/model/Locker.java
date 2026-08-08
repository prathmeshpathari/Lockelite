package com.lockelite.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "lockers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Locker {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Keep both: object reference AND raw FK column for queries
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Branch branch;

    @Column(name = "locker_number", nullable = false, length = 20)
    private String lockerNumber;

    @Column(nullable = false, length = 10)
    private String floor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LockerSize size;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LockerStatus status = LockerStatus.AVAILABLE;

    // Convenience method — used in some repo queries as branch_id FK
    public Long getBranchId() {
        return branch != null ? branch.getId() : null;
    }

    public enum LockerSize   { SMALL, MEDIUM, LARGE, XLARGE }
    public enum LockerStatus { AVAILABLE, RESERVED, OCCUPIED, SUSPENDED }
}
