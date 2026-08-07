package com.lockelite.repository;

import com.lockelite.model.CustomerProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerProfileRepository extends JpaRepository<CustomerProfile, Long> {
    Optional<CustomerProfile> findByUserId(Long userId);
    List<CustomerProfile> findByKycStatus(CustomerProfile.KycStatus status);
    boolean existsByUserId(Long userId);
}
