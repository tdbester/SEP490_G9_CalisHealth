package com.calishealth.dtos;

import java.time.LocalDateTime;

public record MemberNotificationDto(
        Long id,
        String title,
        String message,
        String type,
        LocalDateTime createdAt,
        boolean read
) {}
