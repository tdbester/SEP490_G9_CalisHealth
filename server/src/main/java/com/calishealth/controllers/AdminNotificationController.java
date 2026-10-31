package com.calishealth.controllers;

import com.calishealth.dtos.BatchDeleteRequestDto;
import com.calishealth.dtos.CreateNotificationRequestDto;
import com.calishealth.dtos.NotificationListResponseDto;
import com.calishealth.dtos.NotificationResponseDto;
import com.calishealth.dtos.UpdateNotificationRequestDto;
import com.calishealth.service.AdminNotificationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PutMapping;

@RestController
@RequestMapping("/api/admin/notifications")
@PreAuthorize("hasRole('ADMIN')")
public class AdminNotificationController {
    private final AdminNotificationService notifications;

    public AdminNotificationController(AdminNotificationService notifications) {
        this.notifications = notifications;
    }

    @GetMapping
    public ResponseEntity<NotificationListResponseDto> getNotifications(
            @RequestParam(defaultValue = "ALL") String type
    ) {
        return ResponseEntity.ok(notifications.getNotifications(type));
    }

    @PostMapping
    public ResponseEntity<NotificationResponseDto> createNotification(
            @Valid @RequestBody CreateNotificationRequestDto request,
            Authentication authentication
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(notifications.createNotification(request, authentication.getName()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<NotificationResponseDto> getNotification(@PathVariable Long id) {
        return ResponseEntity.ok(notifications.getNotification(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<NotificationResponseDto> updateNotification(
            @PathVariable Long id,
            @Valid @RequestBody UpdateNotificationRequestDto request
    ) {
        return ResponseEntity.ok(notifications.updateNotification(id, request));
    }

    @DeleteMapping("/batch")
    public ResponseEntity<Void> deleteBatch(@Valid @RequestBody BatchDeleteRequestDto request) {
        notifications.deleteNotifications(request.ids());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteOne(@PathVariable Long id) {
        notifications.deleteNotification(id);
        return ResponseEntity.noContent().build();
    }
}
