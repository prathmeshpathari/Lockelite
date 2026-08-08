package com.lockelite.controller;

import com.lockelite.model.AuditLog;
import com.lockelite.model.Branch;
import com.lockelite.model.Locker;
import com.lockelite.model.User;
import com.lockelite.security.JwtUtil;
import com.lockelite.service.AdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin", description = "Admin operations - employees, lockers, audit logs")
public class AdminController {

    private final AdminService adminService;
    private final JwtUtil      jwtUtil;

    public AdminController(AdminService adminService, JwtUtil jwtUtil) {
        this.adminService = adminService;
        this.jwtUtil      = jwtUtil;
    }

    @GetMapping("/dashboard")
    @Operation(summary = "Admin global dashboard stats")
    public ResponseEntity<Map<String, Object>> dashboard(@RequestHeader("Authorization") String auth) {
        return ResponseEntity.ok(adminService.getDashboardData(auth));
    }

    @GetMapping("/employees")
    @Operation(summary = "Get all employees")
    public ResponseEntity<List<User>> getEmployees() {
        return ResponseEntity.ok(adminService.getAllEmployees());
    }

    @GetMapping("/branches")
    @Operation(summary = "Get all branches")
    public ResponseEntity<List<Branch>> getBranches() {
        return ResponseEntity.ok(adminService.getAllBranches());
    }

    @PostMapping("/employees")
    @Operation(summary = "Add new employee")
    public ResponseEntity<Map<String, Object>> addEmployee(@RequestBody Map<String, Object> req) {
        return ResponseEntity.ok(adminService.addEmployee(req));
    }

    @PutMapping("/employees/{id}/status")
    @Operation(summary = "Activate/Deactivate employee")
    public ResponseEntity<Map<String, String>> updateEmployeeStatus(@PathVariable Long id, @RequestBody Map<String, Boolean> req) {
        return ResponseEntity.ok(adminService.updateEmployeeStatus(id, req));
    }

    @PutMapping("/employees/{id}")
    @Operation(summary = "Update employee details")
    public ResponseEntity<Map<String, String>> updateEmployee(@PathVariable Long id, @RequestBody Map<String, String> req) {
        return ResponseEntity.ok(adminService.updateEmployee(id, req));
    }

    @PostMapping("/employees/{id}/reset-password")
    @Operation(summary = "Reset employee password")
    public ResponseEntity<Map<String, String>> resetEmployeePassword(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.resetEmployeePassword(id));
    }

    @GetMapping("/lockers")
    @Operation(summary = "Get all lockers")
    public ResponseEntity<List<Locker>> getLockers() {
        return ResponseEntity.ok(adminService.getAllLockers());
    }

    @PostMapping("/lockers")
    @Operation(summary = "Add new locker")
    public ResponseEntity<Locker> addLocker(@RequestBody Map<String, Object> req) {
        return ResponseEntity.ok(adminService.addLocker(req));
    }

    @PutMapping("/lockers/{id}")
    @Operation(summary = "Update locker details")
    public ResponseEntity<Locker> updateLocker(@PathVariable Long id, @RequestBody Map<String, Object> req) {
        return ResponseEntity.ok(adminService.updateLocker(id, req));
    }

    @PutMapping("/lockers/{id}/status")
    @Operation(summary = "Update locker status")
    public ResponseEntity<Locker> updateLockerStatus(@PathVariable Long id, @RequestBody Map<String, String> req) {
        return ResponseEntity.ok(adminService.updateLockerStatus(id, req));
    }

    @GetMapping("/audit-logs")
    @Operation(summary = "Get all audit logs")
    public ResponseEntity<List<AuditLog>> getAuditLogs() {
        return ResponseEntity.ok(adminService.getAuditLogs());
    }

    @GetMapping("/audit-logs/verify-chain")
    @Operation(summary = "Verify SHA-256 hash chain integrity")
    public ResponseEntity<Map<String, Object>> verifyChain() {
        return ResponseEntity.ok(adminService.verifyChain());
    }

    @GetMapping("/audit-logs/ai-scan")
    @Operation(summary = "Perform AI risk scan on audit logs")
    public ResponseEntity<Map<String, Object>> runAiScan() {
        return ResponseEntity.ok(adminService.runAiScan());
    }

    @GetMapping("/reports")
    @Operation(summary = "Get dynamic reporting dashboard statistics")
    public ResponseEntity<Map<String, Object>> getReports(@RequestHeader("Authorization") String auth) {
        return ResponseEntity.ok(adminService.getReports(auth));
    }
}
