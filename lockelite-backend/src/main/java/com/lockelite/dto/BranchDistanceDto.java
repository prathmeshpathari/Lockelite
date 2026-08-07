package com.lockelite.dto;

import lombok.*;
import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BranchDistanceDto {
    private String id;
    private String branchName;
    private String address;
    private Double distanceKm;
    private Double distance; // Compatibility with br.distance
    private BigDecimal latitude;
    private BigDecimal longitude;
    private Long lockers;
    private Long available;
}
