package com.lockelite.controller;

import com.lockelite.dto.request.AllocationRequest;
import com.lockelite.dto.request.AppointmentRequest;
import com.lockelite.model.Allocation;
import com.lockelite.model.Appointment;
import com.lockelite.model.Branch;
import com.lockelite.model.Locker;
import com.lockelite.security.JwtUtil;
import com.lockelite.service.CustomerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/customer")
@PreAuthorize("hasRole('CUSTOMER')")
@Tag(name = "Customer", description = "Customer operations — dashboard, KYC, lockers, bookings")
public class CustomerController {

    private final CustomerService customerService;
    private final JwtUtil         jwtUtil;

    public CustomerController(CustomerService customerService, JwtUtil jwtUtil) {
        this.customerService = customerService;
        this.jwtUtil         = jwtUtil;
    }

    @GetMapping("/dashboard")
    @Operation(summary = "Customer dashboard summary data")
    public ResponseEntity<Map<String, Object>> dashboard(@RequestHeader("Authorization") String auth) {
        return ResponseEntity.ok(customerService.getDashboardData(jwtUtil.extractUserId(auth.substring(7))));
    }

    @PostMapping("/select-branch")
    @Operation(summary = "Set customer's bank and branch after registration")
    public ResponseEntity<Map<String, String>> selectBranch(@RequestBody Map<String, Object> req,
                                                             @RequestHeader("Authorization") String auth) {
        return ResponseEntity.ok(customerService.selectBranch(jwtUtil.extractUserId(auth.substring(7)), req));
    }

    @GetMapping("/branch/details")
    @Operation(summary = "Get customer's selected branch details")
    public ResponseEntity<Branch> getCustomerBranch(@RequestHeader("Authorization") String auth) {
        return ResponseEntity.ok(customerService.getCustomerBranch(jwtUtil.extractUserId(auth.substring(7))));
    }

    @PostMapping("/kyc/submit")
    @Operation(summary = "Submit KYC — Aadhaar PDF + PAN verification")
    public ResponseEntity<Map<String, Object>> submitKyc(
            @RequestHeader("Authorization") String auth,
            @RequestParam("fullName")                          String fullName,
            @RequestParam("fatherName")                        String fatherName,
            @RequestParam("address")                           String address,
            @RequestParam("phoneNumber")                       String phoneNumber,
            @RequestParam("panNumber")                         String panNumber,
            @RequestParam("bankAccount")                       String bankAccount,
            @RequestParam("shareCode")                         String shareCode,
            @RequestParam(value = "aadhaarPdf",  required = false) MultipartFile aadhaarPdf,
            @RequestParam(value = "nomineeName", required = false) String nomineeName,
            @RequestParam(value = "nomineeEmail",required = false) String nomineeEmail,
            @RequestParam(value = "nomineePhone",required = false) String nomineePhone,
            @RequestParam(value = "nomineeAddress",required = false) String nomineeAddress
    ) throws IOException {
        Long userId = jwtUtil.extractUserId(auth.substring(7));
        return ResponseEntity.ok(customerService.submitKyc(userId, fullName, fatherName, address,
                phoneNumber, panNumber, bankAccount, shareCode, aadhaarPdf,
                nomineeName, nomineeEmail, nomineePhone, nomineeAddress));
    }

    @GetMapping("/kyc/status")
    @Operation(summary = "Get current KYC status")
    public ResponseEntity<Map<String, Object>> kycStatus(@RequestHeader("Authorization") String auth) {
        return ResponseEntity.ok(customerService.getKycStatus(jwtUtil.extractUserId(auth.substring(7))));
    }

    @GetMapping("/lockers/available")
    @Operation(summary = "Browse available lockers for customer's branch")
    public ResponseEntity<List<Locker>> getAvailableLockers(@RequestHeader("Authorization") String auth) {
        return ResponseEntity.ok(customerService.getAvailableLockers(jwtUtil.extractUserId(auth.substring(7))));
    }

    @PostMapping("/bookings/request")
    @Operation(summary = "Request a locker allocation (KYC must be approved)")
    public ResponseEntity<Map<String, Object>> requestAllocation(@RequestHeader("Authorization") String auth,
                                                                  @Valid @RequestBody AllocationRequest req) {
        return ResponseEntity.ok(customerService.requestAllocation(jwtUtil.extractUserId(auth.substring(7)), req));
    }

    @GetMapping("/bookings/my-allocations")
    @Operation(summary = "Get all locker allocations for this customer")
    public ResponseEntity<List<Allocation>> myAllocations(@RequestHeader("Authorization") String auth) {
        return ResponseEntity.ok(customerService.getMyAllocations(jwtUtil.extractUserId(auth.substring(7))));
    }

    @PostMapping("/bookings/schedule-visit")
    @Operation(summary = "Schedule a branch visit — Mon-Fri, 9AM-5PM only")
    public ResponseEntity<Map<String, String>> scheduleVisit(@RequestHeader("Authorization") String auth,
                                                              @Valid @RequestBody AppointmentRequest req) {
        return ResponseEntity.ok(customerService.scheduleVisit(jwtUtil.extractUserId(auth.substring(7)), req));
    }

    @GetMapping("/bookings/my-visits")
    @Operation(summary = "Get all branch visit history for this customer")
    public ResponseEntity<List<Appointment>> myVisits(@RequestHeader("Authorization") String auth) {
        return ResponseEntity.ok(customerService.getMyVisits(jwtUtil.extractUserId(auth.substring(7))));
    }
}
