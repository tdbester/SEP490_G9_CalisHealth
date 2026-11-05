package com.calishealth.dtos;

public record NotificationCountsDto(
        long allCount,
        long maintenanceCount,
        long announcementCount,
        long updateCount
) {}
