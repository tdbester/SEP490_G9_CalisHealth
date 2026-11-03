package com.calishealth.controllers;

import com.calishealth.dtos.MemberNotificationListDto;
import com.calishealth.service.MemberNotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
@PreAuthorize("hasRole('MEMBER')")
public class MemberNotificationController {
    private final MemberNotificationService notifications;

    public MemberNotificationController(MemberNotificationService notifications) {
        this.notifications = notifications;
    }

    @GetMapping
    public ResponseEntity<MemberNotificationListDto> getNotifications(Authentication authentication) {
        return ResponseEntity.ok(notifications.getNotifications(authentication.getName()));
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<Void> markAsRead(
            @PathVariable Long id,
            Authentication authentication
    ) {
        notifications.markAsRead(id, authentication.getName());
        return ResponseEntity.noContent().build();
    }
}
