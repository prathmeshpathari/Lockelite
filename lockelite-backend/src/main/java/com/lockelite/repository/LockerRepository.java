package com.lockelite.repository;

import com.lockelite.model.Locker;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface LockerRepository extends JpaRepository<Locker, Long> {

    // Use branch.id navigation — JPA derives this correctly from @ManyToOne
    List<Locker> findByBranch_Id(Long branchId);
    List<Locker> findByBranch_IdAndStatus(Long branchId, Locker.LockerStatus status);

    // Explicit JPQL for cleaner query
    @Query("SELECT l FROM Locker l WHERE l.branch.id = :branchId AND l.status = 'AVAILABLE'")
    List<Locker> findAvailableByBranch(@Param("branchId") Long branchId);

    @Query("SELECT COUNT(l) FROM Locker l WHERE l.branch.id = :branchId AND l.status = :status")
    long countByBranchIdAndStatus(@Param("branchId") Long branchId, @Param("status") Locker.LockerStatus status);

    long countByStatus(Locker.LockerStatus status);
}
