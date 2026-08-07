package com.lockelite.dto.request;

import jakarta.validation.constraints.*;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class AllocationRequest {
    @NotNull(message = "Locker ID is required")
    private Long lockerId;

    @NotNull(message = "Tenure is required")
    @Min(value = 1, message = "Minimum tenure is 1 month")
    @Max(value = 60, message = "Maximum tenure is 60 months")
    private Integer tenureMonths;

    private String insurancePlan; // BASIC, STANDARD, PREMIUM, NONE
}
