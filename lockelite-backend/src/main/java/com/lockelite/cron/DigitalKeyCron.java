package com.lockelite.cron;

import com.lockelite.audit.AuditLogService;
import com.lockelite.model.Appointment;
import com.lockelite.repository.AppointmentRepository;
import com.lockelite.service.EmailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Cron job: runs every minute, finds appointments starting in ~30 min,
 * generates a digital access key, and emails it to the customer.
 */
@Component
public class DigitalKeyCron {

    private static final Logger log = LoggerFactory.getLogger(DigitalKeyCron.class);

    // Charset for key generation — uppercase + digits, no ambiguous chars (0,O,I,1)
    private static final String KEY_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    @Autowired private AppointmentRepository appointmentRepo;
    @Autowired private EmailService          emailService;
    @Autowired private AuditLogService       auditLogService;

    /**
     * Runs every minute.
     * Finds CONFIRMED appointments scheduled within 60 minutes from now
     * whose digital key has not been sent yet → generates key → sends email.
     * Window is extended to 60 min to handle edge cases and timezone drift.
     */
    @Scheduled(cron = "0 * * * * *")   // every minute
    public void sendDigitalKeysBeforeVisit() {
        LocalDate today   = LocalDate.now();
        LocalTime nowTime = LocalTime.now();

        // Extended window: send key if visit is within next 60 minutes
        // This ensures key is sent even if cron was slightly delayed
        LocalTime windowStart = nowTime;
        LocalTime windowEnd   = nowTime.plusMinutes(60);

        // Fetch today's CONFIRMED appointments where key not yet sent
        List<Appointment> pending = appointmentRepo
                .findConfirmedTodayKeyNotSent(today);

        log.info("[DIGITAL KEY CRON] Running at {} | Checking {} pending appointments | Window: {} - {}",
                nowTime, pending.size(), windowStart, windowEnd);

        for (Appointment appt : pending) {
            LocalTime visitTime = appt.getVisitTime();

            // Send key if visit is coming up within the window
            boolean inWindow = !visitTime.isBefore(windowStart) && !visitTime.isAfter(windowEnd);
            if (!inWindow) continue;

            try {
                // ── Generate unique 8-char key with prefix "LK-" ──────
                String key = "LK-" + generateKey(6);   // e.g. LK-A3F9B2

                // ── Set expiry = visit time + 2 hours ─────────────────
                LocalDateTime expiresAt = LocalDateTime.of(today, visitTime).plusHours(2);

                // ── Save key to appointment ────────────────────────────
                appt.setDigitalKey(key);
                appt.setDigitalKeySent(true);
                appt.setDigitalKeyExpiresAt(expiresAt);
                appointmentRepo.save(appt);

                // ── Prepare email data ────────────────────────────────
                String customerName  = appt.getCustomer().getFullName();
                String customerEmail = appt.getCustomer().getEmail();
                String lockerNumber  = appt.getLocker() != null ? appt.getLocker().getLockerNumber() : "Your Locker";
                String branchName    = appt.getBranch().getBranchName();
                String branchAddress = appt.getBranch().getAddress();
                String bankName      = appt.getBranch().getBankName();
                String purpose       = appt.getPurpose();

                String formattedDate = today.format(DateTimeFormatter.ofPattern("EEEE, dd MMMM yyyy"));
                String formattedTime = visitTime.format(DateTimeFormatter.ofPattern("hh:mm a"));

                // ── Send HTML email ───────────────────────────────────
                emailService.sendDigitalAccessKey(
                    customerEmail, customerName, key,
                    lockerNumber, formattedDate, formattedTime,
                    branchName, branchAddress, bankName, purpose
                );

                // ── Audit log ─────────────────────────────────────────
                auditLogService.log(
                    appt.getCustomer().getId(),
                    "DIGITAL_KEY_SENT",
                    "Appointment", appt.getId(),
                    null, "KEY=" + key + " | LOCKER=" + lockerNumber,
                    null
                );

                log.info("[DIGITAL KEY] Sent to {} | Appt #{} | Locker {} | Key {}",
                    customerEmail, appt.getId(), lockerNumber, key);

            } catch (Exception e) {
                log.error("[DIGITAL KEY] Failed for appointment #{}: {}", appt.getId(), e.getMessage());
            }
        }
    }

    /**
     * Generates a secure random alphanumeric key of given length.
     */
    private String generateKey(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(KEY_CHARS.charAt(RANDOM.nextInt(KEY_CHARS.length())));
        }
        return sb.toString();
    }
}