package com.lockelite.audit;

import com.lockelite.model.AuditLog;
import com.lockelite.repository.AuditLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;

@Service
public class AuditLogService {

    private static final Logger log = LoggerFactory.getLogger(AuditLogService.class);

    @Autowired private AuditLogRepository auditLogRepository;

    @Async
    public void log(Long userId, String action, String entityType, Long entityId,
                    String previousState, String newState, String ipAddress) {
        try {
            String previousHash = auditLogRepository.findTopByOrderByTimestampDesc()
                    .map(AuditLog::getCurrentHash)
                    .orElse("GENESIS_BLOCK_LOCKELITE_2026");

            String dataToHash = action + userId + entityType + entityId + LocalDateTime.now() + previousHash;
            String currentHash = sha256(dataToHash);

            AuditLog entry = AuditLog.builder()
                    .userId(userId)
                    .action(action)
                    .entityType(entityType)
                    .entityId(entityId)
                    .previousState(previousState)
                    .newState(newState)
                    .ipAddress(ipAddress)
                    .previousHash(previousHash)
                    .currentHash(currentHash)
                    .timestamp(LocalDateTime.now())
                    .build();

            auditLogRepository.save(entry);
        } catch (Exception e) {
            log.error("Audit log failed for action {}: {}", action, e.getMessage());
        }
    }

    public List<AuditLog> getAllLogs() {
        return auditLogRepository.findAllOrderByTimestampDesc();
    }

    public boolean verifyChainIntegrity() {
        List<AuditLog> logs = auditLogRepository.findAll();
        if (logs.size() < 2) return true;
        logs.sort((a, b) -> a.getTimestamp().compareTo(b.getTimestamp()));
        for (int i = 1; i < logs.size(); i++) {
            if (!logs.get(i).getPreviousHash().equals(logs.get(i - 1).getCurrentHash())) {
                return false;
            }
        }
        return true;
    }

    private String sha256(String input) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(hash);
    }
}
