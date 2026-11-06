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
        notification.setTargetAudience("SPECIFIC_USER");
        notification.setTitle(accepted ? "Exercise submission approved" : "Exercise submission rejected");
        notification.setMessage(accepted
                ? "Your exercise submission \"" + exerciseName + "\" has been approved!"
                : "Your exercise submission \"" + exerciseName + "\" was rejected. Reason: " + rejectionReason.trim());
        notification.setType("ANNOUNCEMENT");
        notification.setStatus("PUBLISHED");
        notifications.save(notification);
    }

    public void notifyContentManagersPendingApproval(String exerciseTitle) {
        Notification notification = new Notification();
        notification.setTargetAudience("CONTENT_MANAGER");
        notification.setTitle("New exercise pending approval");
        notification.setMessage("Exercise \"" + exerciseTitle + "\" is waiting for moderation.");
        notification.setType("ANNOUNCEMENT");
        notification.setStatus("PUBLISHED");
        notifications.save(notification);
    }
}
