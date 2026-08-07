package com.lockelite.service;

import com.lockelite.dto.request.AllocationRequest;
import com.lockelite.dto.request.AppointmentRequest;
import com.lockelite.model.Allocation;
import com.lockelite.model.Appointment;
import com.lockelite.model.Branch;
import com.lockelite.model.Locker;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

public interface CustomerService {

    // Dashboard
    Map<String, Object> getDashboardData(Long userId);

    // Branch
    Map<String, String> selectBranch(Long userId, Map<String, Object> req);
    Branch getCustomerBranch(Long userId);

    // KYC
    Map<String, Object> submitKyc(Long userId, String fullName, String fatherName, String address,
                                   String phoneNumber, String panNumber, String bankAccount,
                                   String shareCode, MultipartFile aadhaarPdf,
                                   String nomineeName, String nomineeEmail,
                                   String nomineePhone, String nomineeAddress) throws IOException;
    Map<String, Object> getKycStatus(Long userId);

    // Lockers
    List<Locker> getAvailableLockers(Long userId);

    // Allocations
    Map<String, Object> requestAllocation(Long userId, AllocationRequest req);
    List<Allocation> getMyAllocations(Long userId);

    // Appointments
    Map<String, String> scheduleVisit(Long userId, AppointmentRequest req);
    List<Appointment> getMyVisits(Long userId);
}
