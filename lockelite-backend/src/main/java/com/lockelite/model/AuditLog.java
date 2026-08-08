package com.lockelite.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AuditLog {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id") private Long userId;
    @Column(nullable = false) private String action;
    @Column(name = "entity_type") private String entityType;
    @Column(name = "entity_id") private Long entityId;
    @Column(name = "ip_address", length = 50) private String ipAddress;
    @Column(name = "previous_state", columnDefinition = "TEXT") private String previousState;
    @Column(name = "new_state", columnDefinition = "TEXT") private String newState;
    @Column(name = "previous_hash", length = 64) private String previousHash;
    @Column(name = "current_hash", nullable = false, length = 64) private String currentHash;
    @Column(nullable = false) private LocalDateTime timestamp;

    @PrePersist void onCreate() { if (this.timestamp == null) this.timestamp = LocalDateTime.now(); }
}
