package com.lockelite.payment.service;

import java.util.List;
import java.util.Map;

public interface PaymentService {
    Map<String, Object> createOrder(Long userId, Map<String, Object> req, String bearerToken);
    Map<String, Object> verifyPayment(Long userId, Map<String, Object> req);
    List<Map<String, Object>> listPayments(Long userId);
}
