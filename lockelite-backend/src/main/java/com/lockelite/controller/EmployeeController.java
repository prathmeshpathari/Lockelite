package com.lockelite.controller;

import com.lockelite.model.Allocation;
import com.lockelite.model.Appointment;
import com.lockelite.model.CustomerProfile;
import com.lockelite.security.JwtUtil;
import com.lockelite.service.EmployeeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
@RestController
@RequestMapping("/api/employee")
@PreAuthorize("hasRole('EMPLOYEE')")
@Tag(name = "Employee", description = "Employee operations - KYC review, allocations, appointments")
public class EmployeeController {

    private final EmployeeService employeeService;
    private final JwtUtil         jwtUtil;

    public EmployeeController(EmployeeService employeeService, JwtUtil jwtUtil) {
        this.employeeService = employeeService;
        this.jwtUtil         = jwtUtil;
    }

    @GetMapping("/dashboard")
    @Operation(summary = "Employee dashboard stats")
    public ResponseEntity<Map<String, Object>> dashboard(@RequestHeader("Authorization") String auth) {
        Long officerId = jwtUtil.extractUserId(auth.substring(7));
        return ResponseEntity.ok(employeeService.getDashboardData(officerId, auth));
    }

    @GetMapping("/kyc/pending")
    @Operation(summary = "Get all pending KYC requests")
    public ResponseEntity<List<CustomerProfile>> getPendingKyc(@RequestHeader("Authorization") String auth) {
        Long officerId = jwtUtil.extractUserId(auth.substring(7));
        return ResponseEntity.ok(employeeService.getPendingKyc(officerId));
    }

    @PostMapping("/kyc/{id}/approve")
    @Operation(summary = "Approve KYC")
    public ResponseEntity<Map<String, String>> approveKyc(@PathVariable Long id,
                                                           @RequestHeader("Authorization") String auth) {
        return ResponseEntity.ok(employeeService.approveKyc(id, jwtUtil.extractUserId(auth.substring(7))));
    }

    @PostMapping("/kyc/{id}/reject")
    @Operation(summary = "Reject KYC")
    public ResponseEntity<Map<String, String>> rejectKyc(@PathVariable Long id,
                                                          @RequestBody Map<String, String> req,
                                                          @RequestHeader("Authorization") String auth) {
        return ResponseEntity.ok(employeeService.rejectKyc(id, req.get("reason"), jwtUtil.extractUserId(auth.substring(7))));
    }

    @GetMapping("/allocations/pending")
    @Operation(summary = "Get pending allocation requests")
    public ResponseEntity<List<Allocation>> getPendingAllocations(@RequestHeader("Authorization") String auth) {
        Long officerId = jwtUtil.extractUserId(auth.substring(7));
        return ResponseEntity.ok(employeeService.getPendingAllocations(officerId));
    }

    @PostMapping("/allocations/{id}/approve")
    @Operation(summary = "Approve allocation (dual sign-off enforced)")
    public ResponseEntity<Map<String, Object>> approveAllocation(@PathVariable Long id,
                                                                   @RequestHeader("Authorization") String auth) {
        return ResponseEntity.ok(employeeService.approveAllocation(id, jwtUtil.extractUserId(auth.substring(7))));
    }

    @PostMapping("/allocations/{id}/reject")
    @Operation(summary = "Reject allocation")
    public ResponseEntity<Map<String, String>> rejectAllocation(@PathVariable Long id,
                                                                 @RequestBody Map<String, String> req,
                                                                 @RequestHeader("Authorization") String auth) {
        return ResponseEntity.ok(employeeService.rejectAllocation(id, req.get("reason"), jwtUtil.extractUserId(auth.substring(7))));
    }

    @GetMapping("/appointments")
    @Operation(summary = "Get appointments for branch")
    public ResponseEntity<List<Appointment>> getAppointments(@RequestHeader("Authorization") String auth) {
        return ResponseEntity.ok(employeeService.getAppointments(jwtUtil.extractUserId(auth.substring(7))));
    }

    @PostMapping("/appointments/{id}/confirm")
    @Operation(summary = "Confirm appointment")
    public ResponseEntity<Map<String, String>> confirmAppointment(@PathVariable Long id) {
        return ResponseEntity.ok(employeeService.confirmAppointment(id));
    }

    @PostMapping("/appointments/{id}/complete")
    @Operation(summary = "Mark appointment as completed")
    public ResponseEntity<Map<String, String>> completeAppointment(@PathVariable Long id) {
        return ResponseEntity.ok(employeeService.completeAppointment(id));
    }

    @PostMapping("/appointments/{id}/cancel")
    @Operation(summary = "Cancel appointment")
    public ResponseEntity<Map<String, String>> cancelAppointment(@PathVariable Long id) {
        return ResponseEntity.ok(employeeService.cancelAppointment(id));
    }

    @PostMapping("/appointments/verify-key")
    @Operation(summary = "Verify customer's digital access key at branch entry")
    public ResponseEntity<Map<String, Object>> verifyDigitalKey(@RequestBody Map<String, String> req) {
        return ResponseEntity.ok(employeeService.verifyDigitalKey(req.get("digitalKey")));
    }

    @PostMapping("/appointments/{id}/send-key")
    @Operation(summary = "Manually send digital key email to customer")
    public ResponseEntity<Map<String, Object>> sendDigitalKey(@PathVariable Long id) {
        return ResponseEntity.ok(employeeService.sendDigitalKey(id));
    }
}
