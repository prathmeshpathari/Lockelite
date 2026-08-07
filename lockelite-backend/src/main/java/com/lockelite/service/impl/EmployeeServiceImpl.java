package com.lockelite.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lockelite.audit.AuditLogService;
import com.lockelite.exception.BusinessException;
import com.lockelite.model.*;
import com.lockelite.repository.*;
import com.lockelite.service.AllocationService;
import com.lockelite.service.EmailService;
import com.lockelite.service.EmployeeService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.SecureRandom;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class EmployeeServiceImpl implements EmployeeService {

    private static final Logger log = LoggerFactory.getLogger(EmployeeServiceImpl.class);

    private final CustomerProfileRepository profileRepo;
    private final AllocationService         allocationService;
    private final AllocationRepository      allocationRepo;
    private final AppointmentRepository     appointmentRepo;
    private final LockerRepository          lockerRepo;
    private final UserRepository            userRepo;
    private final AuditLogService           auditLogService;
    private final AuditLogRepository        auditLogRepo;
    private final EmailService              emailService;
    private final PaymentRepository         paymentRepo;
    private final BranchRepository          branchRepo;

    public EmployeeServiceImpl(CustomerProfileRepository profileRepo, AllocationService allocationService,
                                AllocationRepository allocationRepo, AppointmentRepository appointmentRepo,
                                LockerRepository lockerRepo, UserRepository userRepo,
                                AuditLogService auditLogService, AuditLogRepository auditLogRepo,
                                EmailService emailService, PaymentRepository paymentRepo,
                                BranchRepository branchRepo) {
        this.profileRepo       = profileRepo;
        this.allocationService = allocationService;
        this.allocationRepo    = allocationRepo;
        this.appointmentRepo   = appointmentRepo;
        this.lockerRepo        = lockerRepo;
        this.userRepo          = userRepo;
        this.auditLogService   = auditLogService;
        this.auditLogRepo      = auditLogRepo;
        this.emailService      = emailService;
        this.paymentRepo       = paymentRepo;
        this.branchRepo        = branchRepo;
    }

    // ─────────────────────────────────────────────────────────────────────
    // DASHBOARD
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public Map<String, Object> getDashboardData(Long officerId, String auth) {
        User officer  = userRepo.findById(officerId).orElseThrow(() -> new BusinessException("Officer not found"));
        Long branchId = officer.getBranchId() != null ? officer.getBranchId() : 1L;

        Map<String, Object> data = new LinkedHashMap<>();

        // Pending KYC
        List<CustomerProfile> pendingKycs = profileRepo.findByKycStatus(CustomerProfile.KycStatus.PENDING).stream()
                .filter(p -> p.getUser() != null && branchId.equals(p.getUser().getBranchId()))
                .collect(Collectors.toList());
        data.put("pendingKyc", pendingKycs.size());

        // Pending allocations
        List<Allocation> pendingAllocs = allocationRepo.findPendingAllocations().stream()
                .filter(a -> a.getLocker() != null && a.getLocker().getBranch() != null
                        && branchId.equals(a.getLocker().getBranch().getId()))
                .collect(Collectors.toList());
        data.put("pendingAllocations", pendingAllocs.size());

        // Appointments
        List<Appointment> branchAppts = appointmentRepo.findByBranchId(branchId);
        List<Appointment> activeVisits = branchAppts.stream()
                .filter(a -> a.getStatus() == Appointment.AppointmentStatus.UPCOMING
                          || a.getStatus() == Appointment.AppointmentStatus.CONFIRMED)
                .collect(Collectors.toList());
        data.put("upcomingAppointments", activeVisits.size());

        // Rent collected from payment-service
        BigDecimal rentSum = fetchRentFromPaymentService(auth, branchId);
        data.put("rentCollected", rentSum.doubleValue());

        // Pending KYC list
        data.put("pendingKycList", pendingKycs.stream().limit(5).map(p -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.getId());
            m.put("customerName", p.getFullName() != null ? p.getFullName() : (p.getUser() != null ? p.getUser().getFullName() : "Customer"));
            m.put("locker", "Pending KYC"); m.put("size", "N/A");
            m.put("time", "Today"); m.put("color", "#F68222");
            return m;
        }).collect(Collectors.toList()));

        // Appointments list
        data.put("appointments", branchAppts.stream()
                .filter(a -> a.getStatus() == Appointment.AppointmentStatus.UPCOMING
                          || a.getStatus() == Appointment.AppointmentStatus.CONFIRMED)
                .sorted(Comparator.comparing(Appointment::getVisitDate))
                .limit(5).map(a -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", a.getId());
                    m.put("customerName", a.getCustomer() != null ? a.getCustomer().getFullName() : "Customer");
                    LocalDate d = a.getVisitDate();
                    m.put("date",  String.format("%02d", d.getDayOfMonth()));
                    m.put("month", d.getMonth().name().substring(0, 3).toUpperCase());
                    LocalTime t = a.getVisitTime();
                    int hr = t.getHour(), hr12 = hr > 12 ? hr - 12 : (hr == 0 ? 12 : hr);
                    m.put("time", String.format("%02d:%02d %s", hr12, t.getMinute(), hr >= 12 ? "PM" : "AM"));
                    m.put("purpose", a.getPurpose() != null ? a.getPurpose() : "Visit");
                    return m;
                }).collect(Collectors.toList()));

        // Occupancy
        List<Locker> branchLockers = lockerRepo.findByBranch_Id(branchId);
        long total    = branchLockers.size();
        long occupied = branchLockers.stream().filter(l -> l.getStatus() == Locker.LockerStatus.OCCUPIED).count();
        long avail    = branchLockers.stream().filter(l -> l.getStatus() == Locker.LockerStatus.AVAILABLE).count();
        data.put("occupancy", Map.of("total", total, "occupied", occupied, "available", avail));

        data.put("bySize", Arrays.stream(Locker.LockerSize.values()).map(sz -> {
            long t2 = branchLockers.stream().filter(l -> l.getSize() == sz).count();
            long o2 = branchLockers.stream().filter(l -> l.getSize() == sz && l.getStatus() == Locker.LockerStatus.OCCUPIED).count();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("size",     sz.name().charAt(0) + sz.name().substring(1).toLowerCase().replace("_", " "));
            m.put("occupied", o2); m.put("total", t2);
            return m;
        }).collect(Collectors.toList()));

        // Activity
        List<AuditLog> allLogs = auditLogRepo.findAllOrderByTimestampDesc();
        List<Map<String, Object>> filteredActivity = allLogs.stream()
                .filter(l -> l.getUserId() != null)
                .filter(l -> {
                    return userRepo.findById(l.getUserId())
                            .map(u -> branchId.equals(u.getBranchId()))
                            .orElse(false);
                })
                .limit(5)
                .map(l -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("text", l.getAction().replace("_", " ") + " - " + l.getEntityType());
                    m.put("time", l.getTimestamp().toLocalDate() + " " + String.format("%02d:%02d", l.getTimestamp().getHour(), l.getTimestamp().getMinute()));
                    m.put("color", l.getAction().contains("REJECT") ? "#ef4444" : l.getAction().contains("APPROV") ? "#10b981" : "#F68222");
                    return m;
                })
                .collect(Collectors.toList());
        data.put("activity", filteredActivity);

        Branch branch = branchRepo.findById(branchId).orElse(null);
        data.put("branchName", branch != null ? branch.getBranchName() : "Vasind Branch");
        return data;
    }

    // ─────────────────────────────────────────────────────────────────────
    // KYC
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public List<CustomerProfile> getPendingKyc(Long officerId) {
        User officer = userRepo.findById(officerId).orElseThrow(() -> new BusinessException("Officer not found"));
        Long branchId = officer.getBranchId() != null ? officer.getBranchId() : 1L;
        return profileRepo.findByKycStatus(CustomerProfile.KycStatus.PENDING).stream()
                .filter(p -> p.getUser() != null && branchId.equals(p.getUser().getBranchId()))
                .collect(Collectors.toList());
    }

    @Override
    public Map<String, String> approveKyc(Long id, Long officerId) {
        CustomerProfile profile = profileRepo.findById(id).orElseThrow(() -> new BusinessException("KYC not found"));
        profile.setKycStatus(CustomerProfile.KycStatus.APPROVED);
        profile.setReviewedBy(officerId);
        profileRepo.save(profile);
        auditLogService.log(officerId, "KYC_APPROVED", "CustomerProfile", id, "PENDING", "APPROVED", null);
        return Map.of("message", "KYC approved successfully");
    }

    @Override
    public Map<String, String> rejectKyc(Long id, String reason, Long officerId) {
        CustomerProfile profile = profileRepo.findById(id).orElseThrow(() -> new BusinessException("KYC not found"));
        profile.setKycStatus(CustomerProfile.KycStatus.REJECTED);
        profile.setReviewedBy(officerId);
        profile.setRejectionReason(reason);
        profileRepo.save(profile);
        auditLogService.log(officerId, "KYC_REJECTED", "CustomerProfile", id, "PENDING", "REJECTED", null);
        return Map.of("message", "KYC rejected");
    }

    // ─────────────────────────────────────────────────────────────────────
    // ALLOCATIONS
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public List<Allocation> getPendingAllocations(Long officerId) {
        User officer = userRepo.findById(officerId).orElseThrow(() -> new BusinessException("Officer not found"));
        Long branchId = officer.getBranchId() != null ? officer.getBranchId() : 1L;
        return allocationService.getPendingAllocations().stream()
                .filter(a -> a.getLocker() != null && a.getLocker().getBranch() != null
                        && branchId.equals(a.getLocker().getBranch().getId()))
                .collect(Collectors.toList());
    }

    @Override
    public Map<String, Object> approveAllocation(Long id, Long officerId) {
        Allocation allocation = allocationService.approveAllocation(id, officerId);
        return Map.of("message", "Allocation " + allocation.getStatus().name().toLowerCase(),
                "status", allocation.getStatus());
    }

    @Override
    public Map<String, String> rejectAllocation(Long id, String reason, Long officerId) {
        allocationService.rejectAllocation(id, officerId, reason);
        return Map.of("message", "Allocation rejected");
    }

    // ─────────────────────────────────────────────────────────────────────
    // APPOINTMENTS
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public List<Appointment> getAppointments(Long officerId) {
        User officer = userRepo.findById(officerId).orElseThrow(() -> new BusinessException("Officer not found"));
        Long empBranchId = officer.getBranchId();
        if (empBranchId != null) {
            List<Appointment> branchAppts = appointmentRepo.findByBranchId(empBranchId);
            branchAppts.sort((a1, a2) -> {
                int d = a2.getVisitDate().compareTo(a1.getVisitDate());
                return d != 0 ? d : a2.getVisitTime().compareTo(a1.getVisitTime());
            });
            return branchAppts;
        }
        return new ArrayList<>();
    }

    @Override
    public Map<String, String> confirmAppointment(Long id) {
        Appointment appt = appointmentRepo.findById(id).orElseThrow(() -> new BusinessException("Appointment not found"));
        appt.setStatus(Appointment.AppointmentStatus.CONFIRMED);
        appointmentRepo.save(appt);
        return Map.of("message", "Appointment confirmed");
    }

    @Override
    public Map<String, String> completeAppointment(Long id) {
        Appointment appt = appointmentRepo.findById(id).orElseThrow(() -> new BusinessException("Appointment not found"));
        appt.setStatus(Appointment.AppointmentStatus.COMPLETED);
        appointmentRepo.save(appt);
        return Map.of("message", "Appointment marked as completed");
    }

    @Override
    public Map<String, String> cancelAppointment(Long id) {
        Appointment appt = appointmentRepo.findById(id).orElseThrow(() -> new BusinessException("Appointment not found"));
        appt.setStatus(Appointment.AppointmentStatus.CANCELLED);
        appointmentRepo.save(appt);
        return Map.of("message", "Appointment cancelled");
    }

    @Override
    public Map<String, Object> verifyDigitalKey(String key) {
        if (key == null || key.isBlank()) throw new BusinessException("Digital key is required");
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();

        Appointment appt = appointmentRepo.findByDigitalKeyAndToday(key.toUpperCase().trim(), today)
                .orElseThrow(() -> new BusinessException("Invalid or expired digital key"));
        if (appt.getDigitalKeyExpiresAt() != null && now.isAfter(appt.getDigitalKeyExpiresAt()))
            throw new BusinessException("This digital key has expired");

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("valid",         true);
        data.put("customerName",  appt.getCustomer().getFullName());
        data.put("customerEmail", appt.getCustomer().getEmail());
        data.put("lockerNumber",  appt.getLocker() != null ? appt.getLocker().getLockerNumber() : "N/A");
        data.put("visitDate",     appt.getVisitDate().toString());
        data.put("visitTime",     appt.getVisitTime().toString());
        data.put("purpose",       appt.getPurpose());
        data.put("expiresAt",     appt.getDigitalKeyExpiresAt() != null ? appt.getDigitalKeyExpiresAt().toString() : "N/A");
        data.put("message",       "✅ Digital key verified — access granted to " + appt.getCustomer().getFullName());

        auditLogService.log(null, "DIGITAL_KEY_VERIFIED", "Appointment", appt.getId(), null, "KEY=" + key, null);
        return data;
    }

    @Override
    public Map<String, Object> sendDigitalKey(Long id) {
        Appointment appt = appointmentRepo.findById(id).orElseThrow(() -> new BusinessException("Appointment not found"));
        if (appt.getStatus() != Appointment.AppointmentStatus.CONFIRMED)
            throw new BusinessException("Appointment must be CONFIRMED before sending a digital key");

        String key = appt.getDigitalKey();
        if (key == null) {
            String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
            SecureRandom rng = new SecureRandom();
            StringBuilder sb = new StringBuilder("LK-");
            for (int i = 0; i < 6; i++) sb.append(chars.charAt(rng.nextInt(chars.length())));
            key = sb.toString();
            appt.setDigitalKey(key);
            appt.setDigitalKeyExpiresAt(LocalDateTime.of(appt.getVisitDate(), appt.getVisitTime()).plusHours(2));
        }
        appt.setDigitalKeySent(true);
        appointmentRepo.save(appt);

        DateTimeFormatter df = DateTimeFormatter.ofPattern("EEEE, dd MMMM yyyy");
        DateTimeFormatter tf = DateTimeFormatter.ofPattern("hh:mm a");
        emailService.sendDigitalAccessKey(
                appt.getCustomer().getEmail(), appt.getCustomer().getFullName(), key,
                appt.getLocker() != null ? appt.getLocker().getLockerNumber() : "Your Locker",
                appt.getVisitDate().format(df), appt.getVisitTime().format(tf),
                appt.getBranch().getBranchName(), appt.getBranch().getAddress(),
                appt.getBranch().getBankName(), appt.getPurpose());

        auditLogService.log(null, "DIGITAL_KEY_MANUALLY_SENT", "Appointment", appt.getId(), null, "KEY=" + key, null);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("message",    "Digital key sent to " + appt.getCustomer().getEmail());
        resp.put("digitalKey", key);
        return resp;
    }

    // ─────────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ─────────────────────────────────────────────────────────────────────

    private BigDecimal fetchRentFromPaymentService(String auth, Long branchId) {
        BigDecimal sum = BigDecimal.ZERO;
        try {
            HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
            HttpRequest req   = HttpRequest.newBuilder()
                    .uri(URI.create("http://localhost:8081/api/payments/admin/all"))
                    .header("Authorization", auth).GET().timeout(Duration.ofSeconds(3)).build();
            HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200) {
                JsonNode array = new ObjectMapper().readTree(resp.body());
                if (array.isArray()) {
                    for (JsonNode node : array) {
                        String status = node.get("status").asText();
                        if ("SUCCESS".equals(status)) {
                            long allocId = node.get("allocationId").asLong();
                            BigDecimal amt = node.get("amount").decimalValue();
                            Optional<Allocation> allocOpt = allocationRepo.findById(allocId);
                            if (allocOpt.isPresent()) {
                                Allocation a = allocOpt.get();
                                if (a.getLocker() != null && a.getLocker().getBranch() != null
                                        && branchId.equals(a.getLocker().getBranch().getId())) {
                                    sum = sum.add(amt);
                                }
                            }
                        }
                    }
                    return sum;
                }
            }
        } catch (Exception e) {
            log.warn("Could not fetch rent from payment-service: {}", e.getMessage());
        }
        return paymentRepo.findAll().stream()
                .filter(p -> p.getStatus() == Payment.PaymentStatus.SUCCESS)
                .filter(p -> p.getAllocation() != null && p.getAllocation().getLocker() != null
                        && p.getAllocation().getLocker().getBranch() != null
                        && branchId.equals(p.getAllocation().getLocker().getBranch().getId()))
                .map(p -> p.getAmount() != null ? p.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
