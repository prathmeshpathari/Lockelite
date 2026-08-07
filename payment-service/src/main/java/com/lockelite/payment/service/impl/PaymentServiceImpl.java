package com.lockelite.payment.service.impl;

import com.lockelite.payment.exception.BusinessException;
import com.lockelite.payment.model.Payment;
import com.lockelite.payment.repository.PaymentRepository;
import com.lockelite.payment.service.PaymentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

@Service
public class PaymentServiceImpl implements PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentServiceImpl.class);

    @Value("${razorpay.key-id}")
    private String keyId;

    @Value("${razorpay.key-secret}")
    private String keySecret;

    @Value("${lockelite.backend-url}")
    private String backendUrl;

    private final PaymentRepository paymentRepo;

    public PaymentServiceImpl(PaymentRepository paymentRepo) {
        this.paymentRepo = paymentRepo;
    }

    // ─────────────────────────────────────────────────────────────────────
    // CREATE ORDER
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public Map<String, Object> createOrder(Long userId, Map<String, Object> req, String bearerToken) {
        Object allocIdObj = req.get("allocationId");
        if (allocIdObj == null) throw new BusinessException("allocationId is required");

        Long allocationId = Long.parseLong(String.valueOf(allocIdObj));

        Map<String, Object> allocation = fetchAllocationFromMonolith(allocationId, bearerToken);

        List<Payment> existing = paymentRepo.findByAllocationIdAndStatus(allocationId, Payment.PaymentStatus.SUCCESS);
        if (!existing.isEmpty()) {
            throw new BusinessException("Rent for this locker allocation has already been successfully paid");
        }

        // Rent amount from monolith
        BigDecimal rentAmount = new BigDecimal(String.valueOf(allocation.get("rentAmount")));

        // Insurance amount from frontend request (0 if no insurance selected)
        BigDecimal insuranceAmount = BigDecimal.ZERO;
        Object insAmtObj = req.get("insuranceAmount");
        if (insAmtObj != null) {
            try {
                insuranceAmount = new BigDecimal(String.valueOf(insAmtObj));
            } catch (NumberFormatException e) {
                insuranceAmount = BigDecimal.ZERO;
            }
        }

        // Total = rent + insurance — this is what Razorpay Price Summary will show
        BigDecimal totalAmount = rentAmount.add(insuranceAmount);
        long totalInPaise = totalAmount.multiply(BigDecimal.valueOf(100)).longValue();

        String lockerNumber = String.valueOf(allocation.getOrDefault("lockerNumber", ""));
        String insurancePlanId = req.getOrDefault("insurancePlanId", "none").toString();

        // Create Razorpay order with correct total (rent + insurance)
        String orderId = createRazorpayOrder(totalInPaise, allocationId);

        // Save payment record with total amount
        Payment payment = Payment.builder()
                .allocationId(allocationId)
                .customerId(userId)
                .amount(totalAmount)
                .razorpayOrderId(orderId)
                .lockerNumber(lockerNumber)
                .status(Payment.PaymentStatus.PENDING)
                .build();
        paymentRepo.save(payment);

        log.info("Payment order created: {} for customer: {} | rent={} insurance={} total={}",
                orderId, userId, rentAmount, insuranceAmount, totalAmount);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("key",             keyId);
        resp.put("orderId",         orderId);
        resp.put("amount",          totalInPaise);
        resp.put("currency",        "INR");
        resp.put("paymentId",       payment.getId());
        resp.put("rentAmount",      rentAmount);
        resp.put("insuranceAmount", insuranceAmount);
        resp.put("insurancePlan",   insurancePlanId);
        return resp;
    }

    // ─────────────────────────────────────────────────────────────────────
    // VERIFY PAYMENT
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public Map<String, Object> verifyPayment(Long userId, Map<String, Object> req) {
        String orderId   = (String) req.get("razorpayOrderId");
        String paymentId = (String) req.get("razorpayPaymentId");
        String signature = (String) req.get("razorpaySignature");

        if (orderId == null || paymentId == null || signature == null) {
            throw new BusinessException("Missing required Razorpay payment response properties");
        }

        Payment payment = paymentRepo.findByRazorpayOrderId(orderId)
                .orElseThrow(() -> new BusinessException("Payment record not found for Order ID: " + orderId));

        if (!payment.getCustomerId().equals(userId)) {
            throw new BusinessException("Unauthorized access to this payment");
        }

        boolean valid;
        if (orderId.startsWith("order_mock_")) {
            valid = true;
            log.info("Skipping signature check for mock order: {}", orderId);
        } else {
            valid = verifyHmac(orderId, paymentId, signature);
        }

        if (valid) {
            payment.setRazorpayPaymentId(paymentId);
            payment.setRazorpaySignature(signature);
            payment.setStatus(Payment.PaymentStatus.SUCCESS);
            paymentRepo.save(payment);
            log.info("Payment verified: {}", orderId);
            return Map.of("message", "Payment verified and completed successfully");
        } else {
            payment.setStatus(Payment.PaymentStatus.FAILED);
            paymentRepo.save(payment);
            log.warn("Invalid signature for order: {}", orderId);
            throw new BusinessException("Payment signature verification failed");
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // LIST PAYMENTS
    // ─────────────────────────────────────────────────────────────────────

    @Override
    public List<Map<String, Object>> listPayments(Long userId) {
        List<Payment> payments = paymentRepo.findByCustomerId(userId);
        List<Map<String, Object>> list = new ArrayList<>();
        for (Payment p : payments) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id",           p.getId());
            map.put("allocationId", p.getAllocationId());
            map.put("lockerNumber", p.getLockerNumber());
            map.put("amount",       p.getAmount());
            map.put("orderId",      p.getRazorpayOrderId());
            map.put("paymentId",    p.getRazorpayPaymentId());
            map.put("status",       p.getStatus().name());
            map.put("createdAt",    p.getCreatedAt());
            list.add(map);
        }
        return list;
    }

    // ─────────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ─────────────────────────────────────────────────────────────────────

    private Map<String, Object> fetchAllocationFromMonolith(Long allocationId, String bearerToken) {
        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(5))
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(backendUrl + "/api/internal/allocations/" + allocationId))
                    .header("Authorization", bearerToken)
                    .GET()
                    .timeout(Duration.ofSeconds(5))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                String body = response.body();
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("rentAmount",   extractJsonValue(body, "rentAmount"));
                result.put("lockerNumber", extractJsonValue(body, "lockerNumber"));
                result.put("status",       extractJsonValue(body, "status"));
                return result;
            } else if (response.statusCode() == 403 || response.statusCode() == 404) {
                throw new BusinessException("Allocation not found or access denied (id=" + allocationId + ")");
            } else {
                throw new BusinessException("Allocation validation failed: HTTP " + response.statusCode());
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to reach lockelite-backend: {}", e.getMessage());
            throw new BusinessException("Could not verify allocation — lockelite-backend unreachable on " + backendUrl);
        }
    }

    private String extractJsonValue(String json, String key) {
        String search = "\"" + key + "\":";
        int idx = json.indexOf(search);
        if (idx == -1) return "";
        int start = idx + search.length();
        while (start < json.length() && " \t".indexOf(json.charAt(start)) >= 0) start++;
        if (json.charAt(start) == '"') {
            int end = json.indexOf('"', start + 1);
            return end == -1 ? "" : json.substring(start + 1, end);
        }
        int end = start;
        while (end < json.length() && ",}".indexOf(json.charAt(end)) < 0) end++;
        return json.substring(start, end).trim();
    }

    private String createRazorpayOrder(long amountInPaise, Long allocationId) {
        if (keyId != null && !keyId.contains("dummy") && !keyId.contains("mock")) {
            try {
                HttpClient client = HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(5)).build();

                String encodedAuth = Base64.getEncoder()
                        .encodeToString((keyId + ":" + keySecret).getBytes(StandardCharsets.UTF_8));

                String payload = String.format(
                        "{\"amount\":%d,\"currency\":\"INR\",\"receipt\":\"receipt_alloc_%d\"}",
                        amountInPaise, allocationId);

                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create("https://api.razorpay.com/v1/orders"))
                        .header("Authorization", "Basic " + encodedAuth)
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(payload))
                        .timeout(Duration.ofSeconds(5)).build();

                HttpResponse<String> response = client.send(req, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() == 200 || response.statusCode() == 201) {
                    String body = response.body();
                    int i = body.indexOf("\"id\":\"");
                    if (i != -1) {
                        int s = i + 6, e = body.indexOf("\"", s);
                        String oid = body.substring(s, e);
                        log.info("Razorpay order created: {}", oid);
                        return oid;
                    }
                }
                log.warn("Razorpay API returned {}. Using mock.", response.statusCode());
            } catch (Exception e) {
                log.warn("Razorpay call failed: {}. Using mock.", e.getMessage());
            }
        }
        String mock = "order_mock_" + UUID.randomUUID().toString().replaceAll("-", "").substring(0, 14);
        log.info("Mock order: {}", mock);
        return mock;
    }

    private boolean verifyHmac(String orderId, String paymentId, String signature) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(keySecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal((orderId + "|" + paymentId).getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                String h = Integer.toHexString(0xff & b);
                if (h.length() == 1) hex.append('0');
                hex.append(h);
            }
            return hex.toString().equals(signature);
        } catch (Exception e) {
            log.error("HMAC error: {}", e.getMessage());
            return false;
        }
    }
}