package com.lockelite.repository;

import com.lockelite.model.Branch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface BranchRepository extends JpaRepository<Branch, Long> {
    List<Branch> findByIsActiveTrue();
    List<Branch> findByBankNameAndIsActiveTrue(String bankName);
    Optional<Branch> findByBankNameAndBranchName(String bankName, String branchName);
}
