package com.calishealth.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateMaintenanceLockRequestDto(
        @NotBlank(message = "Affected area is required")
        String area,

        @NotBlank(message = "Lock state is required")
        String locked,

        @Size(max = 255, message = "Reason must not exceed 255 characters")
        String reason
) {
}
