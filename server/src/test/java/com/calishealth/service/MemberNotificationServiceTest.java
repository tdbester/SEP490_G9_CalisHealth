package com.calishealth.service;

import com.calishealth.models.Notification;
import com.calishealth.models.NotificationRead;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.NotificationReadRepository;
import com.calishealth.repository.NotificationRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MemberNotificationServiceTest {
    private final NotificationRepository notifications = mock(NotificationRepository.class);
    private final NotificationReadRepository reads = mock(NotificationReadRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final MemberNotificationService service =
            new MemberNotificationService(notifications, reads, users);

    @Test
    void returnsBroadcastAndMemberTargetedPublishedNotifications() {
        User member = new User();
        member.setId(42L);
        Notification broadcast = notification(1L, "Broadcast");
        Notification targeted = notification(2L, "Targeted");
        when(users.findByEmail("member@example.com")).thenReturn(Optional.of(member));
        when(notifications.findVisibleToUserByStatusAudienceOrderByCreatedAtDesc(42L, "MEMBER", "PUBLISHED"))
                .thenReturn(List.of(broadcast, targeted));
        when(reads.findAllByUserIdAndNotificationIdIn(42L, List.of(1L, 2L)))
                .thenReturn(List.of(new NotificationRead(42L, 1L)));

        var result = service.getNotifications("member@example.com");

        assertEquals(2, result.notifications().size());
        assertEquals(1, result.unreadCount());
        assertEquals(true, result.notifications().get(0).read());
        assertEquals(false, result.notifications().get(1).read());
        verify(notifications).findVisibleToUserByStatusAudienceOrderByCreatedAtDesc(42L, "MEMBER", "PUBLISHED");
    }

    @Test
    void fetchesAudienceForContentManagers() {
        User manager = new User();
        manager.setId(43L);
        manager.setRole(UserRole.CONTENT_MANAGER);
        Notification targeted = notification(11L, "Content review required");
        targeted.setTargetAudience("CONTENT_MANAGER");
        when(users.findByEmail("manager@example.com")).thenReturn(Optional.of(manager));
        when(notifications.findVisibleToUserByStatusAudienceOrderByCreatedAtDesc(
                43L, "CONTENT_MANAGER", "PUBLISHED")).thenReturn(List.of(targeted));
        when(reads.findAllByUserIdAndNotificationIdIn(43L, List.of(11L))).thenReturn(List.of());

        var result = service.getNotifications("manager@example.com");

        assertEquals(1, result.notifications().size());
        assertEquals("Content review required", result.notifications().get(0).title());
        assertEquals("CONTENT_MANAGER", result.notifications().get(0).targetAudience());
        assertEquals("PUBLISHED", result.notifications().get(0).status());
        assertEquals(1, result.unreadCount());
        verify(notifications).findVisibleToUserByStatusAudienceOrderByCreatedAtDesc(
                43L, "CONTENT_MANAGER", "PUBLISHED");
    }

    @Test
    void returnsPrivateExerciseRejectionWithReasonToItsMemberAuthor() {
        User member = new User();
        member.setId(42L);
        member.setRole(UserRole.MEMBER);
        Notification rejection = notification(12L, "Exercise submission rejected");
        rejection.setTargetAudience("SPECIFIC_USER");
        rejection.setUserId(42L);
        rejection.setMessage("Your exercise submission \"Ring dip\" was rejected. Reason: Add safe setup steps.");
        when(users.findByEmail("member@example.com")).thenReturn(Optional.of(member));
        when(notifications.findVisibleToUserByStatusAudienceOrderByCreatedAtDesc(
                42L, "MEMBER", "PUBLISHED")).thenReturn(List.of(rejection));
        when(reads.findAllByUserIdAndNotificationIdIn(42L, List.of(12L))).thenReturn(List.of());

        var result = service.getNotifications("member@example.com");

        assertEquals(1, result.notifications().size());
        assertEquals(rejection.getMessage(), result.notifications().get(0).message());
        assertEquals("SPECIFIC_USER", result.notifications().get(0).targetAudience());
        verify(notifications).findVisibleToUserByStatusAudienceOrderByCreatedAtDesc(
                42L, "MEMBER", "PUBLISHED");
    }

    @Test
    void doesNotQueryReadRecordsWhenAudienceHasNoNotifications() {
        User manager = new User();
        manager.setId(43L);
        manager.setRole(UserRole.CONTENT_MANAGER);
        when(users.findByEmail("manager@example.com")).thenReturn(Optional.of(manager));
        when(notifications.findVisibleToUserByStatusAudienceOrderByCreatedAtDesc(
                43L, "CONTENT_MANAGER", "PUBLISHED")).thenReturn(List.of());

        var result = service.getNotifications("manager@example.com");

        assertEquals(0, result.notifications().size());
        assertEquals(0, result.unreadCount());
        verify(reads, never()).findAllByUserIdAndNotificationIdIn(43L, List.of());
    }

    private static Notification notification(Long id, String title) {
        Notification notification = new Notification();
        notification.setId(id);
        notification.setTitle(title);
        notification.setMessage("Message");
        notification.setType("ANNOUNCEMENT");
        notification.setStatus("PUBLISHED");
        notification.setTargetAudience("MEMBER");
        return notification;
    }
}
