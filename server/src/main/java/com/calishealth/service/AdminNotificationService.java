package com.calishealth.service;

import com.calishealth.dtos.NotificationCountsDto;
import com.calishealth.dtos.CreateNotificationRequestDto;
import com.calishealth.dtos.NotificationListResponseDto;
import com.calishealth.dtos.NotificationResponseDto;
import com.calishealth.dtos.UpdateNotificationRequestDto;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.models.Notification;
import com.calishealth.models.User;
import com.calishealth.repository.NotificationRepository;
import com.calishealth.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class AdminNotificationService {
    private static final Set<String> TYPES = Set.of("MAINTENANCE", "ANNOUNCEMENT", "UPDATE");

    private final NotificationRepository notifications;
    private final UserRepository users;

    public AdminNotificationService(NotificationRepository notifications, UserRepository users) {
        this.notifications = notifications;
        this.users = users;
    }

    @Transactional
    public NotificationResponseDto createNotification(CreateNotificationRequestDto request, String adminEmail) {
        User admin = users.findByEmail(adminEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Authenticated admin user was not found"));

        Notification notification = new Notification();
        notification.setTitle(request.title().trim());
        notification.setMessage(request.message().trim());
        notification.setType(request.type());
        notification.setStatus(request.status());
        notification.setCreatedBy(admin.getId());

        return toResponse(notifications.save(notification));
    }

    @Transactional
    public NotificationListResponseDto getNotifications(String requestedType) {
        String type = requestedType == null ? "ALL" : requestedType.trim().toUpperCase(Locale.ROOT);
        if (!"ALL".equals(type) && !TYPES.contains(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported notification type");
        }

        List<Notification> rows = "ALL".equals(type)
                ? notifications.findAllByOrderByCreatedAtDesc()
                : notifications.findAllByTypeOrderByCreatedAtDesc(type);
        NotificationCountsDto counts = new NotificationCountsDto(
                notifications.count(),
                notifications.countByType("MAINTENANCE"),
                notifications.countByType("ANNOUNCEMENT"),
                notifications.countByType("UPDATE")
        );
        return new NotificationListResponseDto(
                rows.stream().map(AdminNotificationService::toResponse).toList(),
                counts
        );
    }

    @Transactional
    public NotificationResponseDto getNotification(Long id) {
        Notification notification = notifications.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found: " + id));
        return toResponse(notification);
    }

    @Transactional
    public NotificationResponseDto updateNotification(Long id, UpdateNotificationRequestDto request) {
        Notification notification = notifications.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found: " + id));

        String requestedType = request.type();
        if ("MAINTENANCE".equals(notification.getType()) != "MAINTENANCE".equals(requestedType)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Maintenance notifications must remain managed by Maintenance schedules"
            );
        }

        notification.setTitle(request.title().trim());
        notification.setMessage(request.message().trim());
        notification.setType(requestedType);
        notification.setStatus(request.status());
        return toResponse(notifications.save(notification));
    }

    @Transactional
    public void deleteNotifications(List<Long> ids) {
        Set<Long> uniqueIds = new LinkedHashSet<>(ids);
        List<Notification> found = notifications.findAllById(uniqueIds);
        if (found.size() != uniqueIds.size()) {
            throw new ResourceNotFoundException("One or more notifications were not found");
        }
        notifications.deleteAllByIdIn(uniqueIds);
    }

    @Transactional
    public void deleteNotification(Long id) {
        if (!notifications.existsById(id)) {
            throw new ResourceNotFoundException("Notification not found: " + id);
        }
        notifications.deleteById(id);
    }

    private static NotificationResponseDto toResponse(Notification notification) {
        return new NotificationResponseDto(
                notification.getId(),
                notification.getTitle(),
                notification.getMessage(),
                notification.getType(),
                notification.getStatus(),
                notification.getCreatedAt()
        );
    }
}
