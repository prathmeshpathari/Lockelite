package com.lockelite.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lockelite.audit.AuditLogService;
import com.lockelite.exception.BusinessException;
import com.lockelite.model.*;
import com.lockelite.repository.*;
import com.lockelite.service.AdminService;
import com.lockelite.service.EmailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AdminServiceImpl implements AdminService {

    private static final Logger log = LoggerFactory.getLogger(AdminServiceImpl.class);

    private final com.lockelite.repository.BankRepository bankRepository;
    private final UserRepository               userRepo;
    private final LockerRepository             lockerRepo;
    private final BranchRepository             branchRepo;
    private final CustomerProfileRepository    profileRepo;
    private final AllocationRepository         allocationRepo;
    private final PaymentRepository            paymentRepo;
    private final AuditLogService              auditLogService;
    private final AuditLogRepository           auditLogRepo;
    private final EmailService                 emailService;
    private final PasswordEncoder              passwordEncoder;

    public AdminServiceImpl(com.lockelite.repository.BankRepository bankRepository,
                            UserRepository userRepo, LockerRepository lockerRepo,
                            BranchRepository branchRepo, CustomerProfileRepository profileRepo,
                            AllocationRepository allocationRepo, PaymentRepository paymentRepo,
                            AuditLogService auditLogService, AuditLogRepository auditLogRepo,
                            EmailService emailService, PasswordEncoder passwordEncoder) {
        this.bankRepository  = bankRepository;
        this.userRepo        = userRepo;
        this.lockerRepo      = lockerRepo;
        this.branchRepo      = branchRepo;
        this.profileRepo     = profileRepo;
        this.allocationRepo  = allocationRepo;
        this.paymentRepo     = paymentRepo;
        this.auditLogService = auditLogService;
        this.auditLogRepo    = auditLogRepo;
        this.emailService    = emailService;
        this.passwordEncoder = passwordEncoder;
    }

    // ─────────────────────────────────────────────────────────────────────
    // DASHBOARD
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public Map<String, Object> getDashboardData(String auth) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("totalLockers",      lockerRepo.count());
        data.put("availableLockers",  lockerRepo.countByStatus(Locker.LockerStatus.AVAILABLE));
        data.put("occupiedLockers",   lockerRepo.countByStatus(Locker.LockerStatus.OCCUPIED));
        data.put("totalEmployees",    userRepo.findByRole(User.Role.EMPLOYEE).size());
        data.put("totalCustomers",    userRepo.findByRole(User.Role.CUSTOMER).size());
        data.put("pendingKyc",        profileRepo.findByKycStatus(CustomerProfile.KycStatus.PENDING).size());
        data.put("pendingAllocations",allocationRepo.countByStatus(Allocation.AllocationStatus.PENDING));
        data.put("chainIntegrity",    auditLogService.verifyChainIntegrity());

        List<Map<String, Object>> allPayments = fetchPaymentsFromService(auth);
        List<Map<String, Object>> allSuccess  = allPayments.stream()
                .filter(p -> "SUCCESS".equals(p.get("status")))
                .collect(Collectors.toList());

        BigDecimal totalRevenue    = sumAmounts(allSuccess);
        LocalDateTime firstOfMonth = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        BigDecimal thisMonth       = allSuccess.stream()
                .filter(p -> parseDateTime((String) p.get("createdAt")).isAfter(firstOfMonth))
                .map(p -> (BigDecimal) p.get("amount"))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Set<Long> paidIds    = extractPaidAllocationIds(allSuccess);
        BigDecimal outstanding = calcOutstanding(paidIds);

        data.put("thisMonthRevenue", thisMonth);
        data.put("outstandingDues",  outstanding);
        data.put("totalRevenue",     totalRevenue);
        data.put("rentChart",        buildMonthlyChart(allSuccess, 8).values());
        data.put("rentMonths",       buildMonthlyChart(allSuccess, 8).keySet());
        data.put("employees",        buildEmployeeList());
        data.put("activity",         buildActivityList());

        return data;
    }

    // ─────────────────────────────────────────────────────────────────────
    // EMPLOYEE OPERATIONS
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public List<User> getAllEmployees() {
        List<User> employees = userRepo.findByRole(User.Role.EMPLOYEE);
        // Enrich each employee with branchName and bankName from branch table
        employees.forEach(emp -> {
            if (emp.getBranchId() != null) {
                branchRepo.findById(emp.getBranchId()).ifPresent(branch -> {
                    emp.setBranchName(branch.getBranchName());
                    emp.setBankName(branch.getBankName());
                });
            }
        });
        return employees;
    }

    @Override
    public Map<String, Object> addEmployee(Map<String, Object> req) {
        String bankName    = (String) req.get("bankName");
        String branchName  = (String) req.get("branchName");
        String branchAddr  = (String) req.get("branchAddress");
        Number latitude    = (Number) req.get("latitude");
        Number longitude   = (Number) req.get("longitude");

        if (bankName == null || branchName == null)
            throw new BusinessException("Bank name and branch name are required");

        Branch branch = branchRepo.findByBankNameAndBranchName(bankName, branchName)
                .orElseGet(() -> createBranchWithLockers(bankName, branchName, branchAddr, latitude, longitude));

        String tempPassword = "Temp@" + (int)(Math.random() * 9000 + 1000);
        String empCode      = "EMP-" + String.format("%05d", userRepo.count() + 10);

        User emp = User.builder()
                .fullName((String) req.get("fullName"))
                .email((String) req.get("email"))
                .username(empCode.toLowerCase().replace("-", ""))
                .passwordHash(passwordEncoder.encode(tempPassword))
                .phoneNumber(req.getOrDefault("phoneNumber", "0000000000").toString())
                .dateOfBirth(java.time.LocalDate.of(1995, 1, 1))
                .role(User.Role.EMPLOYEE)
                .isActive(true)
                .emailVerified(true)
                .passwordChanged(false)
                .bankId(resolveBankId(bankName))
                .branchId(branch.getId())
                .build();

        User saved = userRepo.save(emp);
        emailService.sendEmployeeCredentials(saved.getEmail(), saved.getFullName(), empCode, tempPassword);
        auditLogService.log(null, "EMPLOYEE_CREATED", "User", saved.getId(), null, empCode, null);

        Map<String, Object> empResponse = new LinkedHashMap<>();
        empResponse.put("message", "Employee added. Credentials sent to email.");
        empResponse.put("empCode", empCode);
        empResponse.put("id", saved.getId());
        empResponse.put("tempPassword", tempPassword);
        empResponse.put("branchId", branch.getId());
        empResponse.put("bankName", bankName);
        empResponse.put("branchName", branchName);
        return empResponse;
    }

    @Override
    public Map<String, String> updateEmployee(Long id, Map<String, String> req) {
        User emp = userRepo.findById(id).orElseThrow(() -> new BusinessException("Employee not found"));

        String fullName = req.get("fullName");
        String email    = req.get("email");

        if (fullName == null || fullName.trim().isEmpty()) throw new BusinessException("Full Name cannot be empty");
        if (email    == null || email.trim().isEmpty())    throw new BusinessException("Email cannot be empty");

        userRepo.findByEmail(email).ifPresent(existing -> {
            if (!existing.getId().equals(id))
                throw new BusinessException("Email is already registered by another account");
        });

        emp.setFullName(fullName);
        emp.setEmail(email);
        userRepo.save(emp);
        auditLogService.log(null, "EMPLOYEE_UPDATED", "User", emp.getId(), null, emp.getUsername(), null);
        return Map.of("message", "Employee details updated successfully");
    }

    @Override
    public Map<String, String> updateEmployeeStatus(Long id, Map<String, Boolean> req) {
        User emp = userRepo.findById(id).orElseThrow(() -> new BusinessException("Employee not found"));
        emp.setIsActive(req.get("active"));
        userRepo.save(emp);
        return Map.of("message", "Employee status updated");
    }

    @Override
    public Map<String, String> resetEmployeePassword(Long id) {
        User emp = userRepo.findById(id).orElseThrow(() -> new BusinessException("Employee not found"));
        String tempPassword = "Temp@" + (int)(Math.random() * 9000 + 1000);
        emp.setPasswordHash(passwordEncoder.encode(tempPassword));
        emp.setPasswordChanged(false);
        userRepo.save(emp);
        emailService.sendEmployeeCredentials(emp.getEmail(), emp.getFullName(), emp.getUsername(), tempPassword);
        auditLogService.log(null, "EMPLOYEE_PASSWORD_RESET", "User", emp.getId(), null, emp.getUsername(), null);
        return Map.of("message", "Password reset successfully. New credentials sent to employee's email.",
                "tempPassword", tempPassword);
    }

    // ─────────────────────────────────────────────────────────────────────
    // BRANCH OPERATIONS
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public List<Branch> getAllBranches() {
        return branchRepo.findAll();
    }

    // ─────────────────────────────────────────────────────────────────────
    // LOCKER OPERATIONS
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public List<Locker> getAllLockers() {
        return lockerRepo.findAll();
    }

    @Override
    public Locker addLocker(Map<String, Object> req) {
        Long branchId = Long.parseLong(req.get("branchId").toString());
        Branch branch = branchRepo.findById(branchId).orElseThrow(() -> new BusinessException("Branch not found"));
        Locker locker = Locker.builder()
                .branch(branch)
                .lockerNumber((String) req.get("lockerNumber"))
                .floor((String) req.get("floor"))
                .size(Locker.LockerSize.valueOf(req.get("size").toString().toUpperCase()))
                .price(new BigDecimal(req.get("price").toString()))
                .status(Locker.LockerStatus.AVAILABLE)
                .build();
        return lockerRepo.save(locker);
    }

    @Override
    public Locker updateLocker(Long id, Map<String, Object> req) {
        Locker locker = lockerRepo.findById(id).orElseThrow(() -> new BusinessException("Locker not found"));
        locker.setLockerNumber((String) req.get("lockerNumber"));
        locker.setFloor((String) req.get("floor"));
        locker.setSize(Locker.LockerSize.valueOf(req.get("size").toString().toUpperCase()));
        locker.setPrice(new BigDecimal(req.get("price").toString()));
        Locker saved = lockerRepo.save(locker);
        auditLogService.log(null, "LOCKER_UPDATED", "Locker", saved.getId(), null, saved.getLockerNumber(), null);
        return saved;
    }

    @Override
    public Locker updateLockerStatus(Long id, Map<String, String> req) {
        Locker locker = lockerRepo.findById(id).orElseThrow(() -> new BusinessException("Locker not found"));
        String status = req.get("status");
        locker.setStatus(Locker.LockerStatus.valueOf(status.toUpperCase()));
        Locker saved = lockerRepo.save(locker);
        auditLogService.log(null, "LOCKER_STATUS_UPDATED", "Locker", saved.getId(),
                null, saved.getLockerNumber() + " -> " + status, null);
        return saved;
    }

    // ─────────────────────────────────────────────────────────────────────
    // AUDIT LOGS
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public List<com.lockelite.model.AuditLog> getAuditLogs() {
        return auditLogService.getAllLogs();
    }

    @Override
    public Map<String, Object> verifyChain() {
        boolean valid = auditLogService.verifyChainIntegrity();
        return Map.of("chainValid", valid,
                "message", valid ? "Chain integrity verified" : "Chain violation detected!");
    }

    @Override
    public Map<String, Object> runAiScan() {
        List<com.lockelite.model.AuditLog> logs = auditLogService.getAllLogs();
        List<Map<String, Object>> flagged = new ArrayList<>();

        // 1. Chain integrity check
        if (!auditLogService.verifyChainIntegrity()) {
            flagged.add(Map.of("action", "CHAIN_INTEGRITY", "risk", "High",
                    "detail", "Chain hash mismatch detected — possible database tampering."));
        }

        // 2. Quick KYC approvals
        Map<Long, LocalDateTime> kycSubs = new HashMap<>();
        for (com.lockelite.model.AuditLog l : logs) {
            if ("KYC_SUBMITTED".equals(l.getAction()) && l.getEntityId() != null)
                kycSubs.put(l.getEntityId(), l.getTimestamp());
        }
        for (com.lockelite.model.AuditLog l : logs) {
            if ("KYC_APPROVED".equals(l.getAction()) && l.getEntityId() != null) {
                LocalDateTime sub = kycSubs.get(l.getEntityId());
                if (sub != null) {
                    long mins = Duration.between(sub, l.getTimestamp()).toMinutes();
                    if (mins < 25) flagged.add(Map.of("action", "KYC_APPROVED", "risk", "Medium",
                            "detail", "KYC approved within " + mins + " mins of submission — verify reviewer identity."));
                }
            }
        }

        // 3. Unusual hour logins
        for (com.lockelite.model.AuditLog l : logs) {
            if ("USER_LOGIN".equals(l.getAction()) && l.getTimestamp() != null) {
                int hour = l.getTimestamp().getHour();
                if (hour >= 23 || hour <= 5) flagged.add(Map.of("action", "USER_LOGIN", "risk", "Low",
                        "detail", "Login at unusual hour (" + l.getTimestamp().toLocalTime().toString().substring(0, 5) + ") for user #" + l.getUserId()));
            }
        }

        if (flagged.isEmpty()) flagged.add(Map.of("action", "SYSTEM_HEALTH", "risk", "Low",
                "detail", "All audit records scanned. No anomalies detected."));

        return Map.of("flagged", flagged);
    }

    // ─────────────────────────────────────────────────────────────────────
    // REPORTS
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public Map<String, Object> getReports(String auth) {
        List<Map<String, Object>> allPayments = fetchPaymentsFromService(auth);
        List<Map<String, Object>> allSuccess  = allPayments.stream()
                .filter(p -> "SUCCESS".equals(p.get("status")))
                .collect(Collectors.toList());

        BigDecimal totalRevenue   = sumAmounts(allSuccess);
        long totalLockers         = lockerRepo.count();
        long occupiedLockers      = lockerRepo.countByStatus(Locker.LockerStatus.OCCUPIED);
        double avgOccupancy       = totalLockers == 0 ? 0.0 : (double) occupiedLockers * 100.0 / totalLockers;

        Set<Long> paidIds         = extractPaidAllocationIds(allSuccess);
        BigDecimal outstanding    = calcOutstanding(paidIds);

        // Penalties
        BigDecimal totalPenalties = BigDecimal.ZERO;
        long penaltyCount         = 0;
        LocalDateTime now         = LocalDateTime.now();
        List<Allocation> approved = allocationRepo.findAll().stream()
                .filter(a -> a.getStatus() == Allocation.AllocationStatus.APPROVED).toList();
        for (Allocation a : approved) {
            if (a.getApprovedAt() != null) {
                LocalDateTime expiry = a.getApprovedAt().plusMonths(a.getTenureMonths());
                if (now.isAfter(expiry)) {
                    long days = ChronoUnit.DAYS.between(expiry, now);
                    if (days > 0) { totalPenalties = totalPenalties.add(BigDecimal.valueOf(days * 50.0)); penaltyCount++; }
                }
            }
        }

        // Monthly rent (12 months, in K)
        Map<String, BigDecimal> monthly = buildMonthlyChart(allSuccess, 12);
        List<String>     months   = new ArrayList<>(monthly.keySet());
        List<BigDecimal> rentList = monthly.values().stream()
                .map(v -> v.divide(BigDecimal.valueOf(1000), 2, RoundingMode.HALF_UP))
                .collect(Collectors.toList());

        // Occupancy by size
        List<Map<String, Object>> occBySize = new ArrayList<>();
        for (Locker.LockerSize sz : Locker.LockerSize.values()) {
            List<Locker> szList  = lockerRepo.findAll().stream().filter(l -> l.getSize() == sz).toList();
            long total   = szList.size();
            long occupied = szList.stream().filter(l -> l.getStatus() == Locker.LockerStatus.OCCUPIED).count();
            double pct   = total == 0 ? 0.0 : (double) occupied * 100.0 / total;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("size", sz.name().equals("XLARGE") ? "Extra Lg" : sz.name().charAt(0) + sz.name().substring(1).toLowerCase());
            m.put("occupied", occupied); m.put("total", total); m.put("percentage", Math.round(pct));
            occBySize.add(m);
        }

        // KYC funnel
        long registered    = userRepo.findByRole(User.Role.CUSTOMER).size();
        long kycSubmitted  = profileRepo.count();
        long kycApproved   = profileRepo.findByKycStatus(CustomerProfile.KycStatus.APPROVED).size();
        long lockerAllocated = approved.size();
        List<Map<String, Object>> funnel = List.of(
                Map.of("label", "Registered",      "count", registered,    "percentage", 100),
                Map.of("label", "KYC submitted",   "count", kycSubmitted,  "percentage", registered == 0 ? 0 : Math.round(kycSubmitted  * 100.0 / registered)),
                Map.of("label", "KYC approved",    "count", kycApproved,   "percentage", registered == 0 ? 0 : Math.round(kycApproved   * 100.0 / registered)),
                Map.of("label", "Locker allocated","count", lockerAllocated,"percentage", registered == 0 ? 0 : Math.round(lockerAllocated * 100.0 / registered))
        );

        // Recent payments
        List<Map<String, Object>> sorted = new ArrayList<>(allPayments);
        sorted.sort((a, b) -> String.valueOf(b.get("createdAt")).compareTo(String.valueOf(a.get("createdAt"))));
        List<Map<String, Object>> recent = new ArrayList<>();
        for (int i = 0; i < Math.min(sorted.size(), 5); i++) {
            Map<String, Object> p = sorted.get(i);
            Long cid = p.get("customerId") != null ? ((Number) p.get("customerId")).longValue() : null;
            String cname = cid != null ? userRepo.findById(cid).map(User::getFullName).orElse("Customer") : "Customer";
            Map<String, Object> pm = new LinkedHashMap<>();
            pm.put("customer", cname);
            pm.put("locker",   p.getOrDefault("lockerNumber", "—"));
            pm.put("amount",   p.get("amount"));
            pm.put("status",   "SUCCESS".equals(p.get("status")) ? "Paid" : "PENDING".equals(p.get("status")) ? "Pending" : "Overdue");
            recent.add(pm);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("totalRevenue",    totalRevenue);
        response.put("avgOccupancy",    Math.round(avgOccupancy * 10.0) / 10.0);
        response.put("outstandingDues", outstanding);
        response.put("penalties",       totalPenalties);
        response.put("penaltyCount",    penaltyCount);
        response.put("months",          months);
        response.put("monthlyRent",     rentList);
        response.put("occupancyBySize", occBySize);
        response.put("kycFunnel",       funnel);
        response.put("recentPayments",  recent);
        response.put("totalOccupied",   occupiedLockers);
        response.put("totalLockersCount", totalLockers);
        return response;
    }

    // ─────────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ─────────────────────────────────────────────────────────────────────

    private List<Map<String, Object>> fetchPaymentsFromService(String auth) {
        try {
            HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
            HttpRequest req   = HttpRequest.newBuilder()
                    .uri(URI.create("http://localhost:8081/api/payments/admin/all"))
                    .header("Authorization", auth)
                    .GET().timeout(Duration.ofSeconds(3)).build();
            HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200) {
                ObjectMapper mapper = new ObjectMapper();
                JsonNode arr = mapper.readTree(resp.body());
                List<Map<String, Object>> list = new ArrayList<>();
                if (arr.isArray()) {
                    for (JsonNode node : arr) {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("id",           node.path("id").asText());
                        m.put("allocationId", node.path("allocationId").asLong());
                        m.put("customerId",   node.path("customerId").asLong());
                        m.put("amount",       new BigDecimal(node.path("amount").asText("0")));
                        m.put("status",       node.path("status").asText());
                        m.put("lockerNumber", node.path("lockerNumber").asText());
                        m.put("createdAt",    node.path("createdAt").asText());
                        list.add(m);
                    }
                }
                return list;
            }
        } catch (Exception e) {
            log.warn("payment-service unreachable, using monolith fallback: {}", e.getMessage());
        }
        return paymentRepo.findAll().stream().map(p -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id",           p.getId());
            m.put("allocationId", p.getAllocation() != null ? p.getAllocation().getId() : null);
            m.put("customerId",   p.getCustomer()   != null ? p.getCustomer().getId()   : null);
            m.put("amount",       p.getAmount() != null ? p.getAmount() : BigDecimal.ZERO);
            m.put("status",       p.getStatus().name());
            m.put("lockerNumber", p.getAllocation() != null && p.getAllocation().getLocker() != null
                    ? p.getAllocation().getLocker().getLockerNumber() : "");
            m.put("createdAt",    p.getCreatedAt() != null ? p.getCreatedAt().toString() : "");
            return m;
        }).collect(Collectors.toList());
    }

    private BigDecimal sumAmounts(List<Map<String, Object>> payments) {
        return payments.stream().map(p -> (BigDecimal) p.get("amount")).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private Set<Long> extractPaidAllocationIds(List<Map<String, Object>> successPayments) {
        return successPayments.stream()
                .map(p -> ((Number) p.get("allocationId")).longValue())
                .collect(Collectors.toSet());
    }

    private BigDecimal calcOutstanding(Set<Long> paidIds) {
        return allocationRepo.findAll().stream()
                .filter(a -> a.getStatus() == Allocation.AllocationStatus.APPROVED && !paidIds.contains(a.getId()))
                .map(Allocation::getRentAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private Map<String, BigDecimal> buildMonthlyChart(List<Map<String, Object>> payments, int months) {
        String[] mNames = {"Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"};
        Map<String, BigDecimal> map = new LinkedHashMap<>();
        LocalDate today = LocalDate.now();
        for (int i = months - 1; i >= 0; i--) {
            map.put(mNames[today.minusMonths(i).getMonthValue() - 1], BigDecimal.ZERO);
        }
        for (Map<String, Object> p : payments) {
            String cat = (String) p.get("createdAt");
            if (cat != null && !cat.isEmpty()) {
                try {
                    String mName = mNames[LocalDateTime.parse(cat.substring(0, 19)).getMonthValue() - 1];
                    if (map.containsKey(mName)) map.merge(mName, (BigDecimal) p.get("amount"), BigDecimal::add);
                } catch (Exception ignored) {}
            }
        }
        return map;
    }

    private LocalDateTime parseDateTime(String s) {
        if (s == null || s.isEmpty()) return LocalDateTime.MIN;
        try { return LocalDateTime.parse(s.substring(0, 19)); } catch (Exception e) { return LocalDateTime.MIN; }
    }

    private List<Map<String, Object>> buildEmployeeList() {
        String[] colors = {"var(--color-primary)", "#185FA5", "#10b981", "#ef4444", "#97144D"};
        List<User> emps = userRepo.findByRole(User.Role.EMPLOYEE);
        List<Map<String, Object>> list = new ArrayList<>();
        for (int i = 0; i < emps.size(); i++) {
            User u = emps.get(i);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name",   u.getFullName());
            m.put("role",   u.getBranchId() != null ? "Branch Manager" : "Locker Officer");
            m.put("online", u.getIsActive());
            m.put("color",  colors[i % colors.length]);
            list.add(m);
        }
        return list;
    }

    private List<Map<String, Object>> buildActivityList() {
        List<com.lockelite.model.AuditLog> logs = auditLogService.getAllLogs();
        logs.sort((a, b) -> Long.compare(b.getId(), a.getId()));
        List<Map<String, Object>> list = new ArrayList<>();
        DateTimeFormatter tf = DateTimeFormatter.ofPattern("h:mm a");
        for (int i = 0; i < Math.min(logs.size(), 4); i++) {
            com.lockelite.model.AuditLog l = logs.get(i);
            String text = l.getAction().replace("_", " ").toLowerCase();
            if (!text.isEmpty()) text = text.substring(0, 1).toUpperCase() + text.substring(1);
            if (l.getNewState() != null && !l.getNewState().isBlank()) text += " · " + l.getNewState();
            String timeStr = "Recently";
            if (l.getTimestamp() != null) {
                LocalDate ld = l.getTimestamp().toLocalDate(), today = LocalDate.now();
                timeStr = ld.equals(today) ? "Today " + l.getTimestamp().format(tf)
                        : ld.equals(today.minusDays(1)) ? "Yesterday " + l.getTimestamp().format(tf)
                        : ld + " " + l.getTimestamp().format(tf);
            }
            String actionUp = l.getAction().toUpperCase();
            String color = actionUp.contains("ERROR") || actionUp.contains("FAIL") ? "#ef4444"
                    : actionUp.contains("APPROVED") || actionUp.contains("SUCCESS") ? "#10b981"
                    : "var(--color-primary)";
            list.add(Map.of("text", text, "time", timeStr, "color", color));
        }
        if (list.isEmpty()) list.add(Map.of("text", "System Initialized", "time", "Recently", "color", "#10b981"));
        return list;
    }

    private Branch createBranchWithLockers(String bankName, String branchName, String addr,
                                            Number lat, Number lng) {
        if ("State Bank of India".equalsIgnoreCase(bankName)) bankName = "SBI";
        else if ("HDFC Bank".equalsIgnoreCase(bankName))      bankName = "HDFC";
        else if ("ICICI Bank".equalsIgnoreCase(bankName))     bankName = "ICICI";
        else if ("Axis Bank".equalsIgnoreCase(bankName))      bankName = "AXIS";
        else if ("Kotak Mahindra Bank".equalsIgnoreCase(bankName)) bankName = "KOTAK";
        else if ("LockElite".equalsIgnoreCase(bankName))      bankName = "LOCKELITE";

        bankName = bankName.toUpperCase().trim();

        BigDecimal latVal = lat != null ? BigDecimal.valueOf(lat.doubleValue()) : BigDecimal.valueOf(19.2183);
        BigDecimal lngVal = lng != null ? BigDecimal.valueOf(lng.doubleValue()) : BigDecimal.valueOf(72.9781);
        Branch b = Branch.builder()
                .bankName(bankName).branchName(branchName)
                .bankId(resolveBankId(bankName))
                .address(addr != null ? addr : "Address not available")
                .latitude(latVal).longitude(lngVal).isActive(true).build();
        Branch saved = branchRepo.save(b);
        lockerRepo.saveAll(List.of(
                Locker.builder().branch(saved).lockerNumber("L-101").floor("G").size(Locker.LockerSize.SMALL)  .price(BigDecimal.valueOf(1500)).status(Locker.LockerStatus.AVAILABLE).build(),
                Locker.builder().branch(saved).lockerNumber("L-102").floor("G").size(Locker.LockerSize.MEDIUM) .price(BigDecimal.valueOf(2800)).status(Locker.LockerStatus.AVAILABLE).build(),
                Locker.builder().branch(saved).lockerNumber("L-103").floor("F").size(Locker.LockerSize.LARGE)  .price(BigDecimal.valueOf(4500)).status(Locker.LockerStatus.AVAILABLE).build(),
                Locker.builder().branch(saved).lockerNumber("L-104").floor("F").size(Locker.LockerSize.XLARGE) .price(BigDecimal.valueOf(7000)).status(Locker.LockerStatus.AVAILABLE).build()
        ));
        return saved;
    }

    private Long resolveBankId(String bankName) {
        if (bankName == null) return 1L;
        // Lookup from DB by code first (most reliable)
        Optional<com.lockelite.model.Bank> byCode = bankRepository.findByCode(bankName.toUpperCase().trim());
        if (byCode.isPresent()) return byCode.get().getId();
        // Fallback: hardcoded mapping for both codes and full names
        String n = bankName.toUpperCase().trim();
        if (n.equals("SBI")    || n.contains("STATE BANK"))   return 2L;
        if (n.equals("HDFC")   || n.contains("HDFC"))         return 3L;
        if (n.equals("ICICI")  || n.contains("ICICI"))        return 4L;
        if (n.equals("AXIS")   || n.contains("AXIS"))         return 5L;
        if (n.equals("KOTAK")  || n.contains("KOTAK"))        return 6L;
        if (n.equals("LOCKELITE"))                             return 1L;
        return 1L; // default to LockElite
    }
}