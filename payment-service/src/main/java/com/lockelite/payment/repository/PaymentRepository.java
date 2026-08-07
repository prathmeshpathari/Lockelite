package com.lockelite.payment.repository;

import com.lockelite.payment.model.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    List<Payment> findByCustomerId(Long customerId);

    Optional<Payment> findByRazorpayOrderId(String razorpayOrderId);

    List<Payment> findByAllocationIdAndStatus(Long allocationId, Payment.PaymentStatus status);
}
