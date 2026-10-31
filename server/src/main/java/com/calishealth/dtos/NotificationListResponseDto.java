package com.calishealth.dtos;

import java.util.List;

public record NotificationListResponseDto(
        List<NotificationResponseDto> notifications,
        NotificationCountsDto counts
) {}
