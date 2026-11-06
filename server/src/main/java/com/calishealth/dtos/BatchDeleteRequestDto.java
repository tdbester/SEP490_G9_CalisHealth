package com.calishealth.dtos;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record BatchDeleteRequestDto(
        @NotEmpty(message = "Notification IDs list cannot be empty")
        List<Long> ids
) {}
