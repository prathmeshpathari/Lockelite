package com.lockelite.controller;

import com.lockelite.exception.BusinessException;
import com.lockelite.model.Allocation;
import com.lockelite.repository.AllocationRepository;
import com.lockelite.security.JwtUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Internal endpoint — called ONLY by payment-service to validate an allocation
 * before creating a Razorpay order. The JWT forwarded by the frontend is
 * re-used, so we still enforce customer ownership here.
 *
 * URL: GET /api/internal/allocations/{id}
 */
@RestController
@RequestMapping("/api/internal")
@Tag(name = "Internal", description = "Service-to-service endpoints (not for direct client use)")
public class InternalController {

    private final AllocationRepository allocationRepo;
    private final JwtUtil jwtUtil;

    public InternalController(AllocationRepository allocationRepo, JwtUtil jwtUtil) {
        this.allocationRepo = allocationRepo;
        this.jwtUtil = jwtUtil;
    }

    @GetMapping("/allocations/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Validate allocation ownership and status (called by payment-service)")
    public ResponseEntity<Map<String, Object>> getAllocation(
            @PathVariable Long id,
            @RequestHeader("Authorization") String auth) {

        Long userId = jwtUtil.extractUserId(auth.substring(7));

        Allocation allocation = allocationRepo.findById(id)
                .orElseThrow(() -> new BusinessException("Allocation not found"));

        if (!allocation.getCustomer().getId().equals(userId)) {
            throw new BusinessException("Unauthorized: this allocation belongs to a different customer");
        }

        if (allocation.getStatus() != Allocation.AllocationStatus.APPROVED) {
            throw new BusinessException("Rent can only be paid for APPROVED allocations. Current status: "
                    + allocation.getStatus());
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("allocationId",  allocation.getId());
        resp.put("customerId",    userId);
        resp.put("lockerNumber",  allocation.getLocker().getLockerNumber());
        resp.put("rentAmount",    allocation.getRentAmount());
        resp.put("status",        allocation.getStatus().name());
        return ResponseEntity.ok(resp);
    }
}
