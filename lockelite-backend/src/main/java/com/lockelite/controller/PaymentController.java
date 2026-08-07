package com.lockelite.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.Map;

/**
 * Payment proxy — all payment calls are forwarded to the payment-service
 * running on port 8081. The JWT token is forwarded as-is.
 *
 * Frontend can also call payment-service directly on port 8081;
 * this proxy exists for backwards compatibility.
 */
@RestController
@RequestMapping("/api/customer/payments")
@PreAuthorize("hasRole('CUSTOMER')")
@Tag(name = "Payments (proxy)", description = "Forwards to payment-service on :8081")
public class PaymentController {

    private static final Logger log = LoggerFactory.getLogger(PaymentController.class);

    @Value("${payment.service-url:http://localhost:8081}")
    private String paymentServiceUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    @PostMapping("/create-order")
    @Operation(summary = "Proxy → payment-service: create Razorpay order")
    public ResponseEntity<Object> createOrder(
            @RequestHeader("Authorization") String auth,
            @RequestBody Map<String, Object> req) {
        return forward(HttpMethod.POST, "/api/payments/create-order", auth, req);
    }

    @PostMapping("/verify-payment")
    @Operation(summary = "Proxy → payment-service: verify payment signature")
    public ResponseEntity<Object> verifyPayment(
            @RequestHeader("Authorization") String auth,
            @RequestBody Map<String, Object> req) {
        return forward(HttpMethod.POST, "/api/payments/verify-payment", auth, req);
    }

    @GetMapping
    @Operation(summary = "Proxy → payment-service: list payment history")
    public ResponseEntity<Object> listPayments(
            @RequestHeader("Authorization") String auth) {
        return forward(HttpMethod.GET, "/api/payments", auth, null);
    }

    // ─── helper ──────────────────────────────────────────────────────────

    private ResponseEntity<Object> forward(HttpMethod method, String path, String auth, Object body) {
        String url = paymentServiceUrl + path;
        log.debug("Forwarding {} {} to payment-service", method, url);

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", auth);
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Object> entity = new HttpEntity<>(body, headers);

        try {
            return restTemplate.exchange(url, method, entity, Object.class);
        } catch (org.springframework.web.client.HttpClientErrorException ex) {
            return ResponseEntity.status(ex.getStatusCode()).body(ex.getResponseBodyAs(Object.class));
        } catch (Exception ex) {
            log.error("payment-service unreachable: {}", ex.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "payment-service is unavailable. Make sure it is running on " + paymentServiceUrl));
        }
    }
}
