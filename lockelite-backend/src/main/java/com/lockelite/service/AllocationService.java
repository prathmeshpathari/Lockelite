package com.lockelite.service;

import com.lockelite.model.Allocation;
import java.util.List;

public interface AllocationService {
    Allocation requestAllocation(Long customerId, Long lockerId, Integer tenureMonths);
    Allocation approveAllocation(Long allocationId, Long officerId);
    Allocation rejectAllocation(Long allocationId, Long officerId, String reason);
    List<Allocation> getPendingAllocations();
    List<Allocation> getCustomerAllocations(Long customerId);
}
