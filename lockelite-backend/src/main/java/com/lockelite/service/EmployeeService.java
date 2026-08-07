package com.lockelite.service;

import com.lockelite.model.Allocation;
import com.lockelite.model.Appointment;
import com.lockelite.model.CustomerProfile;

import java.util.List;
import java.util.Map;

public interface EmployeeService {

    // Dashboard
    Map<String, Object> getDashboardData(Long officerId, String auth);

    // KYC
    List<CustomerProfile> getPendingKyc(Long officerId);
    Map<String, String> approveKyc(Long id, Long officerId);
    Map<String, String> rejectKyc(Long id, String reason, Long officerId);

    // Allocations
    List<Allocation> getPendingAllocations(Long officerId);
    Map<String, Object> approveAllocation(Long id, Long officerId);
    Map<String, String> rejectAllocation(Long id, String reason, Long officerId);

    // Appointments
    List<Appointment> getAppointments(Long officerId);
    Map<String, String> confirmAppointment(Long id);
    Map<String, String> completeAppointment(Long id);
    Map<String, String> cancelAppointment(Long id);
    Map<String, Object> verifyDigitalKey(String key);
    Map<String, Object> sendDigitalKey(Long id);
}
