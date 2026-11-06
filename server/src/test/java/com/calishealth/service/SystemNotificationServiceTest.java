package com.calishealth.service;

import com.calishealth.models.Notification;
import com.calishealth.repository.NotificationRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class SystemNotificationServiceTest {
    private final NotificationRepository notifications = mock(NotificationRepository.class);
    private final SystemNotificationService service = new SystemNotificationService(notifications);

    @Test
    void createsPublishedRejectionNotificationForSubmissionAuthor() {
        service.notifyExerciseModeration(42L, "Calisthenics Skill A", false, "Missing safety steps");

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notifications).save(captor.capture());
        Notification notification = captor.getValue();
        assertEquals(42L, notification.getUserId());
        assertEquals("ANNOUNCEMENT", notification.getType());
        assertEquals("PUBLISHED", notification.getStatus());
        assertEquals("Exercise submission rejected", notification.getTitle());
        assertEquals(
                "Your exercise submission \"Calisthenics Skill A\" was rejected. Reason: Missing safety steps",
                notification.getMessage()
        );
        assertEquals("SPECIFIC_USER", notification.getTargetAudience());
    }

    @Test
    void createsPublishedApprovalNotificationForSubmissionAuthor() {
        service.notifyExerciseModeration(42L, "Calisthenics Skill A", true, null);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notifications).save(captor.capture());
        Notification notification = captor.getValue();
        assertEquals(42L, notification.getUserId());
        assertEquals("SPECIFIC_USER", notification.getTargetAudience());
        assertEquals("ANNOUNCEMENT", notification.getType());
        assertEquals("PUBLISHED", notification.getStatus());
        assertEquals("Exercise submission approved", notification.getTitle());
        assertEquals(
                "Your exercise submission \"Calisthenics Skill A\" has been approved!",
                notification.getMessage()
        );
    }

    @Test
    void createsPublishedPendingApprovalNotificationForContentManagers() {
        service.notifyContentManagersPendingApproval("Ring dip");

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notifications).save(captor.capture());
        Notification notification = captor.getValue();
        assertEquals("CONTENT_MANAGER", notification.getTargetAudience());
        assertEquals("ANNOUNCEMENT", notification.getType());
        assertEquals("PUBLISHED", notification.getStatus());
        assertEquals("New exercise pending approval", notification.getTitle());
        assertEquals(
                "Exercise \"Ring dip\" is waiting for moderation.",
                notification.getMessage());
    }
}
