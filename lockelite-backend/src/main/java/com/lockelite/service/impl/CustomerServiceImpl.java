package com.lockelite.service.impl;

import com.lockelite.audit.AuditLogService;
import com.lockelite.dto.request.AllocationRequest;
import com.lockelite.dto.request.AppointmentRequest;
import com.lockelite.exception.BusinessException;
import com.lockelite.model.*;
import com.lockelite.repository.*;
import com.lockelite.service.AllocationService;
import com.lockelite.service.CustomerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

@Service
public class CustomerServiceImpl implements CustomerService {

    private static final Logger log = LoggerFactory.getLogger(CustomerServiceImpl.class);

    private final UserRepository            userRepo;
    private final CustomerProfileRepository profileRepo;
    private final LockerRepository          lockerRepo;
    private final AllocationService         allocationService;
    private final AppointmentRepository     appointmentRepo;
    private final BranchRepository          branchRepo;
    private final AuditLogService           auditLogService;
    private final PaymentRepository         paymentRepo;

    public CustomerServiceImpl(UserRepository userRepo, CustomerProfileRepository profileRepo,
                                LockerRepository lockerRepo, AllocationService allocationService,
                                AppointmentRepository appointmentRepo, BranchRepository branchRepo,
                                AuditLogService auditLogService, PaymentRepository paymentRepo) {
        this.userRepo         = userRepo;
        this.profileRepo      = profileRepo;
        this.lockerRepo       = lockerRepo;
        this.allocationService = allocationService;
        this.appointmentRepo  = appointmentRepo;
        this.branchRepo       = branchRepo;
        this.auditLogService  = auditLogService;
        this.paymentRepo      = paymentRepo;
    }

    // ─────────────────────────────────────────────────────────────────────
    // DASHBOARD
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public Map<String, Object> getDashboardData(Long userId) {
        User user = userRepo.findById(userId).orElseThrow(() -> new BusinessException("User not found"));
        Optional<CustomerProfile> profile = profileRepo.findByUserId(userId);
        List<Allocation> customerAllocs   = allocationService.getCustomerAllocations(userId);

        long activeLockers = customerAllocs.stream()
                .filter(a -> a.getStatus() == Allocation.AllocationStatus.APPROVED).count();

        String nextVisit = appointmentRepo.findByCustomerId(userId).stream()
                .filter(a -> a.getStatus() == Appointment.AppointmentStatus.UPCOMING
                          || a.getStatus() == Appointment.AppointmentStatus.CONFIRMED)
                .findFirst()
                .map(a -> a.getVisitDate() + " at " + a.getVisitTime())
                .orElse("None");

        // Rent Due
        BigDecimal rentDue = BigDecimal.ZERO;
        List<Allocation> approved = customerAllocs.stream()
                .filter(a -> a.getStatus() == Allocation.AllocationStatus.APPROVED).toList();
        for (Allocation a : approved) {
            if (paymentRepo.findByAllocationIdAndStatus(a.getId(), Payment.PaymentStatus.SUCCESS).isEmpty())
                rentDue = rentDue.add(a.getRentAmount());
        }

        // Active locker info
        Map<String, Object> lockerMap = null;
        if (!approved.isEmpty()) {
            Allocation active = approved.get(0);
            lockerMap = new LinkedHashMap<>();
            lockerMap.put("lockerId", active.getLocker().getLockerNumber());
            lockerMap.put("size",     active.getLocker().getSize().name());
            lockerMap.put("branch",   active.getLocker().getBranch().getBranchName());
            lockerMap.put("rent",     active.getRentAmount());
            lockerMap.put("since",    active.getApprovedAt() != null ? active.getApprovedAt().toLocalDate().toString() : "—");
            lockerMap.put("renewal",  active.getApprovedAt() != null ? active.getApprovedAt().plusMonths(active.getTenureMonths()).toLocalDate().toString() : "—");
        }

        // Recent activity
        List<AuditLog> logs = auditLogService.getAllLogs().stream()
                .filter(l -> l.getUserId() != null && l.getUserId().equals(userId)).toList();
        List<AuditLog> sorted = new ArrayList<>(logs);
        sorted.sort((a, b) -> { if (a.getTimestamp()==null||b.getTimestamp()==null) return 0; return b.getTimestamp().compareTo(a.getTimestamp()); });
        List<Map<String, Object>> activity = new ArrayList<>();
        for (int i = 0; i < Math.min(sorted.size(), 3); i++) {
            AuditLog l = sorted.get(i);
            String type = l.getAction().replace("_", " ").toLowerCase();
            if (!type.isEmpty()) type = type.substring(0, 1).toUpperCase() + type.substring(1);
            activity.add(Map.of("type", type, "timestamp", l.getTimestamp() != null ? l.getTimestamp().toLocalDate().toString() : "Recently"));
        }

        // Notifications
        List<Map<String, Object>> notifications = new ArrayList<>();
        if (rentDue.compareTo(BigDecimal.ZERO) > 0)
            notifications.add(Map.of("message", "Rent payment of ₹" + rentDue + " is outstanding.", "urgent", true));
        if (profile.isPresent() && profile.get().getKycStatus() == CustomerProfile.KycStatus.PENDING)
            notifications.add(Map.of("message", "Your KYC profile is under review by branch officers.", "urgent", false));

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("customerName",   user.getFullName());
        data.put("kycStatus",      profile.map(p -> p.getKycStatus().name()).orElse("NOT_SUBMITTED"));
        data.put("activeLockers",  activeLockers);
        data.put("rentDue",        rentDue);
        data.put("nextVisit",      nextVisit.equals("None") ? null : nextVisit);
        data.put("locker",         lockerMap);
        data.put("recentActivity", activity);
        data.put("notifications",  notifications);
        return data;
    }

    // ─────────────────────────────────────────────────────────────────────
    // BRANCH
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public Map<String, String> selectBranch(Long userId, Map<String, Object> req) {
        User user = userRepo.findById(userId).orElseThrow(() -> new BusinessException("User not found"));

        Object branchIdObj = req.get("branchId");
        if (branchIdObj == null) throw new BusinessException("branchId is required");
        String branchIdStr = String.valueOf(branchIdObj);

        Long branchIdLong;
        if (branchIdStr.startsWith("node_mock_vasind")   || branchIdStr.startsWith("mock_lockelite_vasind")   || "1".equals(branchIdStr)) branchIdLong = 1L;
        else if (branchIdStr.startsWith("node_mock_thane")|| branchIdStr.startsWith("mock_lockelite_thane")   || "2".equals(branchIdStr)) branchIdLong = 2L;
        else if (branchIdStr.startsWith("node_mock_navimumbai")||branchIdStr.startsWith("mock_lockelite_navimumbai")||"3".equals(branchIdStr)) branchIdLong = 3L;
        else {
            String num = branchIdStr.replaceAll("\\D+", "");
            if (num.isEmpty()) throw new BusinessException("Invalid branchId format: " + branchIdStr);
            branchIdLong = Long.parseLong(num);
        }

        String branchName = (String) req.getOrDefault("branchName", "OSM Branch " + branchIdStr);
        String bankName = (String) req.get("bankId");
        if (bankName == null) {
            bankName = (String) req.getOrDefault("bankName", "SBI");
        }
        if ("State Bank of India".equalsIgnoreCase(bankName)) bankName = "SBI";
        else if ("HDFC Bank".equalsIgnoreCase(bankName))      bankName = "HDFC";
        else if ("ICICI Bank".equalsIgnoreCase(bankName))     bankName = "ICICI";
        else if ("Axis Bank".equalsIgnoreCase(bankName))      bankName = "AXIS";
        else if ("Kotak Mahindra Bank".equalsIgnoreCase(bankName)) bankName = "KOTAK";
        else if ("LockElite".equalsIgnoreCase(bankName))      bankName = "LOCKELITE";

        bankName = bankName.toUpperCase().trim();

        final String finalBankName = bankName;

        Long finalBranchId = branchRepo.findByBankNameAndBranchName(bankName, branchName)
                .map(Branch::getId)
                .orElseGet(() -> {
                    String  address = (String) req.getOrDefault("address", "Address not available");
                    Number  lat     = (Number) req.get("latitude");
                    Number  lng     = (Number) req.get("longitude");
                    BigDecimal latV = lat != null ? BigDecimal.valueOf(lat.doubleValue()) : BigDecimal.valueOf(19.2183);
                    BigDecimal lngV = lng != null ? BigDecimal.valueOf(lng.doubleValue()) : BigDecimal.valueOf(72.9781);
                    Branch saved = branchRepo.save(Branch.builder()
                            .bankName(finalBankName).branchName(branchName)
                            .bankId(resolveBankId(finalBankName))
                            .address(address).latitude(latV).longitude(lngV).isActive(true).build());
                    lockerRepo.saveAll(List.of(
                            Locker.builder().branch(saved).lockerNumber("L-101").floor("G").size(Locker.LockerSize.SMALL) .price(BigDecimal.valueOf(1500)).status(Locker.LockerStatus.AVAILABLE).build(),
                            Locker.builder().branch(saved).lockerNumber("L-102").floor("G").size(Locker.LockerSize.MEDIUM).price(BigDecimal.valueOf(2800)).status(Locker.LockerStatus.AVAILABLE).build(),
                            Locker.builder().branch(saved).lockerNumber("L-103").floor("F").size(Locker.LockerSize.LARGE) .price(BigDecimal.valueOf(4500)).status(Locker.LockerStatus.AVAILABLE).build(),
                            Locker.builder().branch(saved).lockerNumber("L-104").floor("F").size(Locker.LockerSize.XLARGE).price(BigDecimal.valueOf(7000)).status(Locker.LockerStatus.AVAILABLE).build()
                    ));
                    return saved.getId();
                });

        user.setBranchId(finalBranchId);
        user.setBankId(resolveBankId(bankName));
        userRepo.save(user);
        log.info("Branch selected for userId={}: branchId={}", userId, finalBranchId);
        return Map.of("message", "Branch selected successfully");
    }

    @Override
    public Branch getCustomerBranch(Long userId) {
        User user = userRepo.findById(userId).orElseThrow(() -> new BusinessException("User not found"));
        if (user.getBranchId() == null) throw new BusinessException("No branch selected");
        return branchRepo.findById(user.getBranchId()).orElseThrow(() -> new BusinessException("Branch not found"));
    }

    // ─────────────────────────────────────────────────────────────────────
    // KYC
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public Map<String, Object> submitKyc(Long userId, String fullName, String fatherName, String address,
                                          String phoneNumber, String panNumber, String bankAccount,
                                          String shareCode, MultipartFile aadhaarPdf,
                                          String nomineeName, String nomineeEmail,
                                          String nomineePhone, String nomineeAddress) throws IOException {
        User user = userRepo.findById(userId).orElseThrow(() -> new BusinessException("User not found"));

        // Validation
        fullName = validate(fullName, "Full Name", 2, 100, "^[a-zA-Z\\s]+$", "can only contain alphabets and spaces");
        fatherName = validate(fatherName, "Father's Name", 2, 100, "^[a-zA-Z\\s]+$", "can only contain alphabets and spaces");
        address = validateLength(address, "Address", 10, 500);
        phoneNumber = validatePattern(phoneNumber.trim(), "Phone number", "^[6-9]\\d{9}$", "must be a valid 10-digit mobile number starting with 6-9");
        bankAccount = validatePattern(bankAccount.trim(), "Bank Account", "^\\d{9,18}$", "must be 9-18 digits");
        panNumber   = validatePattern(panNumber.trim().toUpperCase(), "PAN number", "^[A-Z]{5}[0-9]{4}[A-Z]{1}$", "must be in format ABCDE1234F");

        if (nomineeName != null && !nomineeName.trim().isEmpty()) {
            nomineeName   = validate(nomineeName, "Nominee Name", 2, 100, "^[a-zA-Z\\s]+$", "can only contain alphabets and spaces");
            nomineeEmail  = validatePattern(nomineeEmail  != null ? nomineeEmail.trim()  : "", "Nominee Email",  "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,6}$", "is invalid");
            nomineePhone  = validatePattern(nomineePhone  != null ? nomineePhone.trim()  : "", "Nominee Phone",  "^[6-9]\\d{9}$", "must be a valid 10-digit mobile number");
            nomineeAddress = validateLength(nomineeAddress != null ? nomineeAddress : "", "Nominee Address", 10, 500);
        }

        // Save Aadhaar PDF
        String aadhaarPath = null;
        if (aadhaarPdf != null && !aadhaarPdf.isEmpty()) {
            java.nio.file.Path dir = Paths.get("uploads/kyc/" + userId).toAbsolutePath();
            Files.createDirectories(dir);
            java.nio.file.Path target = dir.resolve("aadhaar_" + System.currentTimeMillis() + ".pdf");
            aadhaarPdf.transferTo(target.toFile());
            aadhaarPath = target.toString();
            log.info("Aadhaar PDF saved at: {}", aadhaarPath);
        }

        boolean aadhaarVerified = "1234".equals(shareCode) || (aadhaarPdf != null && !aadhaarPdf.isEmpty());
        boolean panVerified     = panNumber.matches("^[A-Z]{5}[0-9]{4}[A-Z]{1}$");

        CustomerProfile profile = profileRepo.findByUserId(userId)
                .orElseGet(() -> CustomerProfile.builder().user(user).build());
        profile.setFullName(fullName); profile.setFatherName(fatherName);
        profile.setAddress(address);   profile.setPhoneNumber(phoneNumber); profile.setBankAccount(bankAccount);
        profile.setAadhaarMasked("XXXX-XXXX-" + (1000 + new Random().nextInt(9000)));
        profile.setAadhaarVerified(aadhaarVerified); profile.setAadhaarPdfPath(aadhaarPath);
        profile.setPanNumber(panNumber); profile.setPanVerified(panVerified);
        profile.setNameMatch(aadhaarVerified && panVerified);
        profile.setNomineeName(nomineeName); profile.setNomineeEmail(nomineeEmail);
        profile.setNomineePhone(nomineePhone); profile.setNomineeAddress(nomineeAddress);
        profile.setKycStatus(CustomerProfile.KycStatus.PENDING);
        profileRepo.save(profile);

        log.info("KYC submitted for userId={}", userId);
        auditLogService.log(userId, "KYC_SUBMITTED", "CustomerProfile", profile.getId(), null, "PENDING", null);

        return Map.of("message", "KYC submitted successfully. Awaiting officer review.",
                "aadhaarVerified", aadhaarVerified, "panVerified", panVerified);
    }

    @Override
    public Map<String, Object> getKycStatus(Long userId) {
        Optional<CustomerProfile> profile = profileRepo.findByUserId(userId);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("kycStatus",       profile.map(p -> p.getKycStatus().name()).orElse("NOT_SUBMITTED"));
        data.put("aadhaarVerified", profile.map(CustomerProfile::getAadhaarVerified).orElse(false));
        data.put("panVerified",     profile.map(CustomerProfile::getPanVerified).orElse(false));
        data.put("rejectionReason", profile.map(CustomerProfile::getRejectionReason).orElse(null));
        return data;
    }

    // ─────────────────────────────────────────────────────────────────────
    // LOCKERS
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public List<Locker> getAvailableLockers(Long userId) {
        User user = userRepo.findById(userId).orElseThrow(() -> new BusinessException("User not found"));
        return user.getBranchId() != null
                ? lockerRepo.findAvailableByBranch(user.getBranchId())
                : lockerRepo.findAll();
    }

    // ─────────────────────────────────────────────────────────────────────
    // ALLOCATIONS
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public Map<String, Object> requestAllocation(Long userId, AllocationRequest req) {
        Allocation alloc = allocationService.requestAllocation(userId, req.getLockerId(), req.getTenureMonths());
        return Map.of("message", "Locker booking request submitted. Awaiting officer approval.",
                "allocationId", alloc.getId(), "status", alloc.getStatus());
    }

    @Override
    public List<Allocation> getMyAllocations(Long userId) {
        return allocationService.getCustomerAllocations(userId);
    }

    // ─────────────────────────────────────────────────────────────────────
    // APPOINTMENTS
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public Map<String, String> scheduleVisit(Long userId, AppointmentRequest req) {
        User user = userRepo.findById(userId).orElseThrow(() -> new BusinessException("User not found"));

        List<Allocation> allocs = allocationService.getCustomerAllocations(userId);
        if (allocs.isEmpty()) throw new BusinessException("You must request and get approval for a locker before scheduling a visit.");
        Allocation approved = allocs.stream()
                .filter(a -> a.getStatus() == Allocation.AllocationStatus.APPROVED)
                .findFirst()
                .orElseThrow(() -> new BusinessException("Locker approval is pending. You cannot schedule a branch visit yet."));

        int dow = req.getVisitDate().getDayOfWeek().getValue();
        if (dow == 6 || dow == 7) throw new BusinessException("Branch is closed on weekends (Mon-Fri only)");
        if (req.getVisitDate().isBefore(LocalDate.now())) throw new BusinessException("Cannot schedule a visit in the past");
        if (req.getVisitDate().equals(LocalDate.now()) && req.getVisitTime().isBefore(LocalTime.now()))
            throw new BusinessException("Cannot schedule a visit in the past time of today");
        int hour = req.getVisitTime().getHour();
        if (hour < 9 || hour >= 17) throw new BusinessException("Appointments allowed only between 9:00 AM and 5:00 PM");

        boolean conflict = appointmentRepo.findByCustomerId(userId).stream().anyMatch(a ->
                a.getVisitDate().equals(req.getVisitDate()) && a.getVisitTime().equals(req.getVisitTime())
                && a.getStatus() != Appointment.AppointmentStatus.CANCELLED);
        if (conflict) throw new BusinessException("You already have a scheduled visit at this date and time.");

        Branch branch = branchRepo.findById(user.getBranchId() != null ? user.getBranchId() : 1L)
                .orElseThrow(() -> new BusinessException("Branch not found. Please select a branch first."));

        Appointment appt = appointmentRepo.save(Appointment.builder()
                .customer(user).branch(branch).locker(approved.getLocker())
                .visitDate(req.getVisitDate()).visitTime(req.getVisitTime())
                .purpose(req.getPurpose()).notes(req.getNotes())
                .status(Appointment.AppointmentStatus.UPCOMING).build());

        log.info("Visit scheduled for userId={} on {} at {}", userId, req.getVisitDate(), req.getVisitTime());
        auditLogService.log(userId, "VISIT_SCHEDULED", "Appointment", appt.getId(), null,
                req.getVisitDate() + "T" + req.getVisitTime(), null);

        return Map.of("message", "Visit scheduled successfully");
    }

    @Override
    public List<Appointment> getMyVisits(Long userId) {
        return appointmentRepo.findByCustomerId(userId);
    }

    // ─────────────────────────────────────────────────────────────────────
    // VALIDATION HELPERS
    // ─────────────────────────────────────────────────────────────────────

    private String validate(String val, String field, int min, int max, String regex, String regexMsg) {
        if (val == null || val.trim().isEmpty()) throw new BusinessException(field + " is required");
        val = val.trim();
        if (val.length() < min || val.length() > max) throw new BusinessException(field + " must be " + min + "-" + max + " characters");
        if (!val.matches(regex)) throw new BusinessException(field + " " + regexMsg);
        return val;
    }

    private String validateLength(String val, String field, int min, int max) {
        if (val == null || val.trim().isEmpty()) throw new BusinessException(field + " is required");
        val = val.trim();
        if (val.length() < min || val.length() > max) throw new BusinessException(field + " must be " + min + "-" + max + " characters");
        return val;
    }

    private String validatePattern(String val, String field, String regex, String msg) {
        if (val == null || val.isEmpty()) throw new BusinessException(field + " is required");
        if (!val.matches(regex)) throw new BusinessException(field + " " + msg);
        return val;
    }

    private Long resolveBankId(String bankName) {
        if ("State Bank of India".equalsIgnoreCase(bankName) || "SBI".equalsIgnoreCase(bankName))   return 2L;
        if ("HDFC Bank".equalsIgnoreCase(bankName)           || "HDFC".equalsIgnoreCase(bankName))  return 3L;
        if ("ICICI Bank".equalsIgnoreCase(bankName)          || "ICICI".equalsIgnoreCase(bankName)) return 4L;
        if ("Axis Bank".equalsIgnoreCase(bankName)           || "Axis".equalsIgnoreCase(bankName))  return 5L;
        if ("Kotak Mahindra Bank".equalsIgnoreCase(bankName) || "KOTAK".equalsIgnoreCase(bankName)) return 6L;
        if ("LockElite".equalsIgnoreCase(bankName))                                                  return 1L;
        return null;
    }
}
