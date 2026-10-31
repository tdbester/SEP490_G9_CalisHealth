package com.calishealth.dtos;

import java.time.LocalDateTime;

public record NotificationResponseDto(
        Long id,
        String title,
        String message,
        String type,
        String status,
        LocalDateTime createdAt
) {}
