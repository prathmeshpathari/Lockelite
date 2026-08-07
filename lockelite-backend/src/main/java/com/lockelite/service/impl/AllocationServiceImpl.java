package com.lockelite.service.impl;

import com.lockelite.audit.AuditLogService;
import com.lockelite.exception.BusinessException;
import com.lockelite.model.*;
import com.lockelite.repository.*;
import com.lockelite.service.AllocationService;
import com.lockelite.service.EmailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
@Transactional
public class AllocationServiceImpl implements AllocationService {

    private static final Logger log = LoggerFactory.getLogger(AllocationServiceImpl.class);

    @Autowired private AllocationRepository allocationRepository;
    @Autowired private LockerRepository lockerRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private CustomerProfileRepository customerProfileRepository;
    @Autowired private AuditLogService auditLogService;
    @Autowired private EmailService emailService;

    @Override
    public Allocation requestAllocation(Long customerId, Long lockerId, Integer tenureMonths) {
        // Validate KYC
        CustomerProfile profile = customerProfileRepository.findByUserId(customerId)
                .orElseThrow(() -> new BusinessException("KYC not submitted. Please complete KYC first."));
        if (profile.getKycStatus() != CustomerProfile.KycStatus.APPROVED)
            throw new BusinessException("KYC must be approved before booking a locker. Current status: " + profile.getKycStatus());

        Locker locker = lockerRepository.findById(lockerId)
                .orElseThrow(() -> new BusinessException("Locker not found"));
        if (locker.getStatus() != Locker.LockerStatus.AVAILABLE)
            throw new BusinessException("Locker " + locker.getLockerNumber() + " is not available");

        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new BusinessException("Customer not found"));

        Allocation allocation = Allocation.builder()
                .customer(customer)
                .locker(locker)
                .tenureMonths(tenureMonths)
                .rentAmount(locker.getPrice())
                .status(Allocation.AllocationStatus.PENDING)
                .build();

        locker.setStatus(Locker.LockerStatus.RESERVED);
        lockerRepository.save(locker);

        Allocation saved = allocationRepository.save(allocation);
        auditLogService.log(customerId, "ALLOCATION_REQUESTED", "Allocation", saved.getId(), "AVAILABLE", "RESERVED", null);
        log.info("Allocation requested by customer {} for locker {}", customerId, lockerId);
        return saved;
    }

    @Override
    public Allocation approveAllocation(Long allocationId, Long officerId) {
        Allocation allocation = allocationRepository.findById(allocationId)
                .orElseThrow(() -> new BusinessException("Allocation request not found"));

        if (allocation.getStatus() == Allocation.AllocationStatus.APPROVED)
            throw new BusinessException("This allocation is already approved");
        if (allocation.getStatus() == Allocation.AllocationStatus.REJECTED)
            throw new BusinessException("Cannot approve a rejected allocation");

        User officer = userRepository.findById(officerId)
                .orElseThrow(() -> new BusinessException("Officer not found"));

        Locker.LockerSize size = allocation.getLocker().getSize();
        boolean needsDualApproval = size == Locker.LockerSize.LARGE || size == Locker.LockerSize.XLARGE;

        if (!needsDualApproval) {
            // Single approval for SMALL and MEDIUM
            allocation.setOfficer1(officer);
            allocation.setStatus(Allocation.AllocationStatus.APPROVED);
            allocation.setApprovedAt(LocalDateTime.now());
            allocation.getLocker().setStatus(Locker.LockerStatus.OCCUPIED);
            lockerRepository.save(allocation.getLocker());
            log.info("Single approval done for allocation {} by officer {}", allocationId, officerId);
        } else {
            // Dual approval for LARGE and XLARGE
            if (allocation.getOfficer1() == null) {
                // Step 1 approval
                allocation.setOfficer1(officer);
                allocation.setStatus(Allocation.AllocationStatus.PARTIALLY_APPROVED);
                log.info("Step 1 approval done for allocation {} by officer {}", allocationId, officerId);
            } else if (allocation.getOfficer2() == null) {
                // Step 2 approval — must be different officer
                if (allocation.getOfficer1().getId().equals(officerId)) {
                    throw new BusinessException(
                        "Same officer cannot approve twice. This allocation requires approval from a second officer.",
                        HttpStatus.BAD_REQUEST
                    );
                }
                allocation.setOfficer2(officer);
                allocation.setStatus(Allocation.AllocationStatus.APPROVED);
                allocation.setApprovedAt(LocalDateTime.now());
                allocation.getLocker().setStatus(Locker.LockerStatus.OCCUPIED);
                lockerRepository.save(allocation.getLocker());
                log.info("Step 2 approval done for allocation {} by officer {}", allocationId, officerId);
            } else {
                throw new BusinessException("This allocation already has two approvals");
            }
        }

        Allocation saved = allocationRepository.save(allocation);
        auditLogService.log(officerId, "ALLOCATION_" + saved.getStatus().name(), "Allocation", allocationId,
                allocation.getStatus().name(), saved.getStatus().name(), null);

        // Notify customer on full approval
        if (saved.getStatus() == Allocation.AllocationStatus.APPROVED) {
            emailService.sendKycStatusEmail(
                saved.getCustomer().getEmail(), saved.getCustomer().getFullName(),
                "LOCKER ALLOCATED - " + saved.getLocker().getLockerNumber(), null
            );
        }

        return saved;
    }

    @Override
    public Allocation rejectAllocation(Long allocationId, Long officerId, String reason) {
        Allocation allocation = allocationRepository.findById(allocationId)
                .orElseThrow(() -> new BusinessException("Allocation not found"));
        if (allocation.getStatus() == Allocation.AllocationStatus.APPROVED)
            throw new BusinessException("Cannot reject an already approved allocation");

        allocation.setStatus(Allocation.AllocationStatus.REJECTED);
        allocation.setRejectionReason(reason);
        allocation.getLocker().setStatus(Locker.LockerStatus.AVAILABLE);
        lockerRepository.save(allocation.getLocker());

        auditLogService.log(officerId, "ALLOCATION_REJECTED", "Allocation", allocationId, null, reason, null);
        return allocationRepository.save(allocation);
    }

    @Override
    public List<Allocation> getPendingAllocations() {
        return allocationRepository.findPendingAllocations();
    }

    @Override
    public List<Allocation> getCustomerAllocations(Long customerId) {
        return allocationRepository.findByCustomerId(customerId);
    }
}
