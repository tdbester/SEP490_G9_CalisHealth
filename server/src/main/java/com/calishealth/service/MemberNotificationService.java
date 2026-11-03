package com.calishealth.service;

import com.calishealth.dtos.MemberNotificationDto;
import com.calishealth.dtos.MemberNotificationListDto;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.models.Notification;
import com.calishealth.models.NotificationRead;
import com.calishealth.models.User;
import com.calishealth.repository.NotificationReadRepository;
import com.calishealth.repository.NotificationRepository;
import com.calishealth.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class MemberNotificationService {
    private final NotificationRepository notifications;
    private final NotificationReadRepository reads;
    private final UserRepository users;

    public MemberNotificationService(
            NotificationRepository notifications,
            NotificationReadRepository reads,
            UserRepository users
    ) {
        this.notifications = notifications;
        this.reads = reads;
        this.users = users;
    }

    @Transactional
    public MemberNotificationListDto getNotifications(String memberEmail) {
        User member = getMember(memberEmail);
        List<Notification> published =
                notifications.findVisibleToUserByStatusOrderByCreatedAtDesc(member.getId(), "PUBLISHED");
        List<Long> ids = published.stream().map(Notification::getId).toList();
        Set<Long> readIds = new HashSet<>(
                reads.findAllByUserIdAndNotificationIdIn(member.getId(), ids).stream()
                        .map(NotificationRead::getNotificationId)
                        .toList()
        );
        List<MemberNotificationDto> items = published.stream()
                .map(item -> toDto(item, readIds.contains(item.getId())))
                .toList();
        return new MemberNotificationListDto(items, published.size() - readIds.size());
    }

    @Transactional
    public void markAsRead(Long notificationId, String memberEmail) {
        User member = getMember(memberEmail);
        Notification notification = notifications.findById(notificationId)
                .filter(item -> "PUBLISHED".equals(item.getStatus()))
                .orElseThrow(() -> new ResourceNotFoundException("Published notification not found: " + notificationId));
        if (!reads.existsByUserIdAndNotificationId(member.getId(), notification.getId())) {
            reads.save(new NotificationRead(member.getId(), notification.getId()));
        }
    }

    private User getMember(String email) {
        return users.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Authenticated member was not found"));
    }

    private static MemberNotificationDto toDto(Notification notification, boolean read) {
        return new MemberNotificationDto(
                notification.getId(),
                notification.getTitle(),
                notification.getMessage(),
                notification.getType(),
                notification.getCreatedAt(),
                read
        );
    }
}
