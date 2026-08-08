package com.lockelite.service;

import com.lockelite.model.AuditLog;
import com.lockelite.model.Branch;
import com.lockelite.model.Locker;
import com.lockelite.model.User;

import java.util.List;
import java.util.Map;

public interface AdminService {

    // Dashboard
    Map<String, Object> getDashboardData(String auth);

    // Employee operations
    List<User> getAllEmployees();
    Map<String, Object> addEmployee(Map<String, Object> req);
    Map<String, String> updateEmployee(Long id, Map<String, String> req);
    Map<String, String> updateEmployeeStatus(Long id, Map<String, Boolean> req);
    Map<String, String> resetEmployeePassword(Long id);

    // Branch operations
    List<Branch> getAllBranches();

    // Locker operations
    List<Locker> getAllLockers();
    Locker addLocker(Map<String, Object> req);
    Locker updateLocker(Long id, Map<String, Object> req);
    Locker updateLockerStatus(Long id, Map<String, String> req);

    // Audit logs
    List<AuditLog> getAuditLogs();
    Map<String, Object> verifyChain();
    Map<String, Object> runAiScan();

    // Reports
    Map<String, Object> getReports(String auth);
}
