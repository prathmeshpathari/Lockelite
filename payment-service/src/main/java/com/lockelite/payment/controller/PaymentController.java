package com.lockelite.payment.controller;

import com.lockelite.payment.security.JwtUtil;
import com.lockelite.payment.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
@Tag(name = "Payments", description = "Payment microservice — Razorpay rent payments")
public class PaymentController {

    private final PaymentService paymentService;
    private final JwtUtil jwtUtil;
    private final com.lockelite.payment.repository.PaymentRepository paymentRepo;

    public PaymentController(PaymentService paymentService, JwtUtil jwtUtil,
                             com.lockelite.payment.repository.PaymentRepository paymentRepo) {
        this.paymentService = paymentService;
        this.jwtUtil = jwtUtil;
        this.paymentRepo = paymentRepo;
    }

    @PostMapping("/create-order")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Create Razorpay order for locker rent")
    public ResponseEntity<Map<String, Object>> createOrder(
            @RequestHeader("Authorization") String auth,
            @RequestBody Map<String, Object> req) {

        Long userId = jwtUtil.extractUserId(auth.substring(7));
        return ResponseEntity.ok(paymentService.createOrder(userId, req, auth));
    }

    @PostMapping("/verify-payment")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Verify Razorpay signature and mark payment SUCCESS")
    public ResponseEntity<Map<String, Object>> verifyPayment(
            @RequestHeader("Authorization") String auth,
            @RequestBody Map<String, Object> req) {

        Long userId = jwtUtil.extractUserId(auth.substring(7));
        return ResponseEntity.ok(paymentService.verifyPayment(userId, req));
    }

    @GetMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "List all rent payments for the logged-in customer")
    public ResponseEntity<List<Map<String, Object>>> myPayments(
            @RequestHeader("Authorization") String auth) {

        Long userId = jwtUtil.extractUserId(auth.substring(7));
        return ResponseEntity.ok(paymentService.listPayments(userId));
    }

    @GetMapping("/admin/total")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Total rent collected — called by monolith employee dashboard")
    public ResponseEntity<Map<String, Object>> totalRentCollected() {
        java.math.BigDecimal total = paymentRepo.findAll().stream()
                .filter(p -> p.getStatus() == com.lockelite.payment.model.Payment.PaymentStatus.SUCCESS)
                .map(p -> p.getAmount() != null ? p.getAmount() : java.math.BigDecimal.ZERO)
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
        return ResponseEntity.ok(Map.of("total", total, "currency", "INR"));
    }

    @GetMapping("/admin/all")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "All payments — called by monolith admin reports")
    public ResponseEntity<List<Map<String, Object>>> allPayments() {
        List<Map<String, Object>> list = new java.util.ArrayList<>();
        for (com.lockelite.payment.model.Payment p : paymentRepo.findAll()) {
            Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("id",           p.getId());
            m.put("allocationId", p.getAllocationId());
            m.put("customerId",   p.getCustomerId());
            m.put("amount",       p.getAmount());
            m.put("status",       p.getStatus().name());
            m.put("lockerNumber", p.getLockerNumber());
            m.put("createdAt",    p.getCreatedAt() != null ? p.getCreatedAt().toString() : "");
            list.add(m);
        }
        return ResponseEntity.ok(list);
    }
}