package com.lockelite.config;

import com.lockelite.model.Bank;
import com.lockelite.model.User;
import com.lockelite.repository.*;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Seeds only:
 *   1. Banks (6 banks with theme colours)
 *   2. Admin user (1 super-admin)
 *
 * Branches → fetched live from OpenStreetMap Overpass API (BranchController)
 * Employees → created by Admin through the platform UI
 * Lockers   → added by Admin through the platform UI
 *
 * Safe to run on every restart — all checks are idempotent.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer {

    private final BankRepository        bankRepo;
    private final UserRepository        userRepo;
    private final PasswordEncoder       passwordEncoder;
    private final BranchRepository      branchRepo;
    private final LockerRepository      lockerRepo;
    private final AppointmentRepository appointmentRepo;

    private static final String ADMIN_PASSWORD = "Admin@2026";

    @PostConstruct
    @Transactional
    public void init() {
        seedBanks();
        seedAdmin();
        migrateAndMergeDuplicateBranches();
        log.info("[DataInitializer] Startup seed complete — banks & admin only.");
    }

    // ─────────────────────────────────────────────────────────────
    // 1. BANKS — 6 banks with full theme data
    // ─────────────────────────────────────────────────────────────
    private void seedBanks() {
        if (bankRepo.count() > 0) {
            log.info("[DataInitializer] Banks already exist — skipping.");
            return;
        }
        log.info("[DataInitializer] Seeding banks...");

        bankRepo.saveAll(List.of(
            //        code          name                    primary    sidebar    bg         accent     layout    logo
            bank("LOCKELITE", "LockElite",           "#F68222", "#0f172a", "#F5F0E8", "#FFF0E0", "sidebar", "LE"  ),
            bank("SBI",       "State Bank of India", "#2D6BB5", "#1A3A6B", "#F0F4F8", "#E6EEF8", "sidebar", "SBI" ),
            bank("HDFC",      "HDFC Bank",           "#004C8F", "#002D5A", "#EEF4FA", "#E0EBF5", "sidebar", "HDFC"),
            bank("ICICI",     "ICICI Bank",          "#F58220", "#002D72", "#F5F5F5", "#FFF0E0", "sidebar", "ICICI"),
            bank("AXIS",      "Axis Bank",           "#97144D", "#5C0D30", "#FDF5F8", "#F9E8EF", "sidebar", "AXIS"),
            bank("KOTAK",     "Kotak Mahindra Bank", "#EF3E23", "#8B0000", "#FFF5F5", "#FFE8E8", "sidebar", "KMB" )
        ));
        log.info("[DataInitializer] ✅ 6 banks seeded.");
    }

    // ─────────────────────────────────────────────────────────────
    // 2. ADMIN — single super-admin for LockElite
    // ─────────────────────────────────────────────────────────────
    private void seedAdmin() {
        String adminEmail = "admin@lockelite.com";
        if (userRepo.existsByEmail(adminEmail)) {
            log.info("[DataInitializer] Admin already exists — skipping.");
            return;
        }

        Bank le = bankRepo.findByCode("LOCKELITE")
                .orElseThrow(() -> new IllegalStateException("LOCKELITE bank not found — banks must be seeded first"));

        User admin = User.builder()
                .fullName("LockElite Admin")
                .email(adminEmail)
                .username("leadmin")
                .passwordHash(passwordEncoder.encode(ADMIN_PASSWORD))
                .phoneNumber("9999999999")
                .dateOfBirth(LocalDate.of(1990, 1, 1))
                .role(User.Role.ADMIN)
                .isActive(true)
                .emailVerified(true)
                .passwordChanged(true)
                .bankId(le.getId())
                .branchId(null)   // admin is not tied to a branch
                .build();

        userRepo.save(admin);
        log.info("[DataInitializer] ✅ Admin seeded → {} / {}", adminEmail, ADMIN_PASSWORD);
    }

    // ─────────────────────────────────────────────────────────────
    // HELPER — builds a Bank entity
    // ─────────────────────────────────────────────────────────────
    private Bank bank(String code, String name,
                      String primary, String sidebar,
                      String bg,      String accent,
                      String layout,  String logoText) {
        return Bank.builder()
                .code(code)
                .name(name)
                .primaryColor(primary)
                .sidebarColor(sidebar)
                .bgColor(bg)
                .accentColor(accent)
                .layout(layout)
                .logoText(logoText)
                .isActive(true)
                .build();
    }

    private void migrateAndMergeDuplicateBranches() {
        try {
            // 1. Standardise existing branches
            List<com.lockelite.model.Branch> allBranches = branchRepo.findAll();
            for (com.lockelite.model.Branch b : allBranches) {
                String origBankName = b.getBankName();
                String stdBankName = origBankName;
                if ("State Bank of India".equalsIgnoreCase(stdBankName)) stdBankName = "SBI";
                else if ("HDFC Bank".equalsIgnoreCase(stdBankName))      stdBankName = "HDFC";
                else if ("ICICI Bank".equalsIgnoreCase(stdBankName))     stdBankName = "ICICI";
                else if ("Axis Bank".equalsIgnoreCase(stdBankName))      stdBankName = "AXIS";
                else if ("Kotak Mahindra Bank".equalsIgnoreCase(stdBankName)) stdBankName = "KOTAK";
                else if ("LockElite".equalsIgnoreCase(stdBankName))      stdBankName = "LOCKELITE";

                stdBankName = stdBankName.toUpperCase().trim();
                b.setBankName(stdBankName);
                b.setBankId(resolveBankId(stdBankName));
                branchRepo.save(b);
            }

            // 2. Standardise existing users
            List<User> allUsers = userRepo.findAll();
            for (User u : allUsers) {
                if (u.getBranchId() != null) {
                    com.lockelite.model.Branch br = branchRepo.findById(u.getBranchId()).orElse(null);
                    if (br != null) {
                        u.setBankId(br.getBankId());
                        userRepo.save(u);
                    }
                }
            }

            // 3. Find and merge duplicates
            allBranches = branchRepo.findAll();
            java.util.Map<String, com.lockelite.model.Branch> uniqueBranches = new java.util.HashMap<>();
            for (com.lockelite.model.Branch b : allBranches) {
                String key = (b.getBankName() + "|" + b.getBranchName()).toUpperCase().trim();
                if (!uniqueBranches.containsKey(key)) {
                    uniqueBranches.put(key, b);
                } else {
                    com.lockelite.model.Branch primary = uniqueBranches.get(key);
                    Long dupId = b.getId();
                    Long primId = primary.getId();

                    log.info("[Migration] Merging duplicate branch ID {} into branch ID {}", dupId, primId);

                    // Move users
                    for (User u : userRepo.findAll()) {
                        if (dupId.equals(u.getBranchId())) {
                            u.setBranchId(primId);
                            userRepo.save(u);
                        }
                    }

                    // Move lockers
                    for (com.lockelite.model.Locker l : lockerRepo.findAll()) {
                        if (l.getBranch() != null && dupId.equals(l.getBranch().getId())) {
                            l.setBranch(primary);
                            lockerRepo.save(l);
                        }
                    }

                    // Move appointments
                    for (com.lockelite.model.Appointment a : appointmentRepo.findAll()) {
                        if (a.getBranch() != null && dupId.equals(a.getBranch().getId())) {
                            a.setBranch(primary);
                            appointmentRepo.save(a);
                        }
                    }

                    // Delete duplicate branch
                    branchRepo.delete(b);
                }
            }
        } catch (Exception ex) {
            log.error("[Migration] Error running branch standardisation migration", ex);
        }
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
