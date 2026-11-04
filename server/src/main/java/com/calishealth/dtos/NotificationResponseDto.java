package com.calishealth.dtos;

import java.time.LocalDateTime;

public record NotificationResponseDto(
        Long id,
        String title,
        String message,
        String type,
        String status,
        String targetAudience,
        Long userId,
        LocalDateTime createdAt
) {
    public NotificationResponseDto(
            Long id,
            String title,
            String message,
            String type,
            String status,
            LocalDateTime createdAt
    ) {
        this(id, title, message, type, status, "ALL_MEMBERS", null, createdAt);
    }
}
