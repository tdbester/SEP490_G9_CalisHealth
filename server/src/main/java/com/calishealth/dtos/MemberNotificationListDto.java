package com.calishealth.dtos;

import java.util.List;

public record MemberNotificationListDto(
        List<MemberNotificationDto> notifications,
        long unreadCount
) {}
