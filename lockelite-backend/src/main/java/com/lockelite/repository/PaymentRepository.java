package com.lockelite.repository;

import com.lockelite.model.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findByCustomerId(Long customerId);
    Optional<Payment> findByRazorpayOrderId(String razorpayOrderId);
    List<Payment> findByAllocationIdAndStatus(Long allocationId, Payment.PaymentStatus status);
}
