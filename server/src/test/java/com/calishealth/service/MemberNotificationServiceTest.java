package com.calishealth.service;

import com.calishealth.models.Notification;
import com.calishealth.models.NotificationRead;
import com.calishealth.models.User;
import com.calishealth.repository.NotificationReadRepository;
import com.calishealth.repository.NotificationRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
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
        when(notifications.findVisibleToUserByStatusOrderByCreatedAtDesc(42L, "PUBLISHED"))
                .thenReturn(List.of(broadcast, targeted));
        when(reads.findAllByUserIdAndNotificationIdIn(42L, List.of(1L, 2L)))
                .thenReturn(List.of(new NotificationRead(42L, 1L)));

        var result = service.getNotifications("member@example.com");

        assertEquals(2, result.notifications().size());
        assertEquals(1, result.unreadCount());
        assertEquals(true, result.notifications().get(0).read());
        assertEquals(false, result.notifications().get(1).read());
        verify(notifications).findVisibleToUserByStatusOrderByCreatedAtDesc(42L, "PUBLISHED");
    }

    private static Notification notification(Long id, String title) {
        Notification notification = new Notification();
        notification.setId(id);
        notification.setTitle(title);
        notification.setMessage("Message");
        notification.setType("ANNOUNCEMENT");
        notification.setStatus("PUBLISHED");
        return notification;
    }
}
