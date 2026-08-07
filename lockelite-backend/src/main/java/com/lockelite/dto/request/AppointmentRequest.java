package com.lockelite.dto.request;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalTime;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class AppointmentRequest {
    @NotNull(message = "Visit date is required")
    @FutureOrPresent(message = "Visit date must be in the present or future")
    private LocalDate visitDate;

    @NotNull(message = "Visit time is required")
    private LocalTime visitTime;

    @NotBlank(message = "Purpose is required")
    @Size(max = 100)
    private String purpose;

    private Long lockerId;
    private String notes;
}
