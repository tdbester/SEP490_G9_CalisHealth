package com.calishealth.service;

import com.calishealth.models.Notification;
import com.calishealth.repository.NotificationRepository;
import org.springframework.stereotype.Service;

@Service
public class SystemNotificationService {
    private final NotificationRepository notifications;

    public SystemNotificationService(NotificationRepository notifications) {
        this.notifications = notifications;
    }

    public void notifyExerciseModeration(
            Long memberId,
            String exerciseName,
            boolean accepted,
            String rejectionReason
    ) {
        if (memberId == null) return;

        Notification notification = new Notification();
        notification.setUserId(memberId);
        notification.setTitle(accepted ? "Exercise submission approved" : "Exercise submission rejected");
        notification.setMessage(accepted
                ? "Your exercise submission '" + exerciseName + "' has been approved by the Content Manager."
                : "Your exercise submission '" + exerciseName + "' was rejected. Reason: " + rejectionReason.trim());
        notification.setType("SYSTEM");
        notification.setStatus("PUBLISHED");
        notifications.save(notification);
    }
}
