package com.calishealth.dtos;

import java.time.LocalDateTime;

public record MemberNotificationDto(
        Long id,
        String title,
        String message,
        String type,
        String targetAudience,
        String status,
        LocalDateTime createdAt,
        boolean read
) {}
