package com.lockelite.repository;

import com.lockelite.model.Allocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface AllocationRepository extends JpaRepository<Allocation, Long> {

    List<Allocation> findByStatus(Allocation.AllocationStatus status);

    @Query("SELECT a FROM Allocation a WHERE a.customer.id = :customerId ORDER BY a.requestedAt DESC")
    List<Allocation> findByCustomerId(@Param("customerId") Long customerId);

    @Query("SELECT a FROM Allocation a WHERE a.customer.id = :customerId AND a.status = :status")
    Optional<Allocation> findByCustomerIdAndStatus(@Param("customerId") Long customerId,
                                                    @Param("status") Allocation.AllocationStatus status);

    @Query("SELECT COUNT(a) FROM Allocation a WHERE a.status = :status")
    long countByStatus(@Param("status") Allocation.AllocationStatus status);

    @Query("SELECT a FROM Allocation a WHERE a.status IN ('PENDING','PARTIALLY_APPROVED') ORDER BY a.requestedAt DESC")
    List<Allocation> findPendingAllocations();
}
