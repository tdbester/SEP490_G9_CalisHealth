package com.calishealth.service;

import com.calishealth.dtos.CreateNotificationRequestDto;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.models.Notification;
import com.calishealth.models.User;
import com.calishealth.repository.NotificationRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminNotificationServiceTest {
    @Mock
    private NotificationRepository notifications;

    @Mock
    private UserRepository users;

    @InjectMocks
    private AdminNotificationService service;

    @Test
    void loadsSelectedTypeAndCountsAllNotificationTypes() {
        Notification item = new Notification();
        item.setId(8L);
        item.setTitle("Front lever roadmap");
        item.setMessage("A new progression is available.");
        item.setType("UPDATE");
        item.setStatus("PUBLISHED");
        item.setTargetAudience("CONTENT_MANAGER");
        item.setCreatedBy(42L);
        item.setCreatedAt(LocalDateTime.of(2026, 10, 10, 9, 0));
        when(notifications.findAllByTypeOrderByCreatedAtDesc("UPDATE"))
                .thenReturn(List.of(item));
        when(notifications.countByType("MAINTENANCE")).thenReturn(1L);
        when(notifications.countByType("ANNOUNCEMENT")).thenReturn(2L);
        when(notifications.countByType("UPDATE")).thenReturn(1L);

        var response = service.getNotifications("update");

        assertEquals(1, response.notifications().size());
        assertEquals(8L, response.notifications().get(0).id());
        assertEquals("CONTENT_MANAGER", response.notifications().get(0).targetAudience());
        assertEquals(4L, response.counts().allCount());
        assertEquals(1L, response.counts().maintenanceCount());
        assertEquals(2L, response.counts().announcementCount());
        assertEquals(1L, response.counts().updateCount());
        verify(notifications).findAllByTypeOrderByCreatedAtDesc("UPDATE");
    }

    @Test
    void loadsSupportedNotificationsIncludingRowsWithoutCreator() {
        Notification seededNotification = notification(20L, "Seeded notice", "ANNOUNCEMENT", "PUBLISHED");
        seededNotification.setCreatedBy(null);
        when(notifications.findAllByTypeInOrderByCreatedAtDesc(anyCollection()))
                .thenReturn(List.of(seededNotification));
        when(notifications.countByType("MAINTENANCE")).thenReturn(0L);
        when(notifications.countByType("ANNOUNCEMENT")).thenReturn(1L);
        when(notifications.countByType("UPDATE")).thenReturn(0L);

        var response = service.getNotifications("ALL");

        assertEquals(1, response.notifications().size());
        assertEquals(20L, response.notifications().get(0).id());
        assertEquals(1L, response.counts().allCount());
        verify(notifications).findAllByTypeInOrderByCreatedAtDesc(anyCollection());
    }

    @Test
    void loadsNotificationWithoutCreatorById() {
        Notification notification = notification(21L, "System notice", "ANNOUNCEMENT", "PUBLISHED");
        notification.setCreatedBy(null);
        when(notifications.findById(21L)).thenReturn(Optional.of(notification));

        assertEquals(21L, service.getNotification(21L).id());
    }

    @Test
    void rejectsBatchDeleteIfAnyIdDoesNotExist() {
        Notification found = new Notification();
        found.setId(1L);
        found.setCreatedBy(42L);
        doReturn(List.of(found))
                .when(notifications).findAllByIdIn(anyCollection());

        assertThrows(ResourceNotFoundException.class,
                () -> service.deleteNotifications(List.of(1L, 999L)));

        verify(notifications, never()).deleteAllByIdIn(anyCollection());
    }

    @Test
    void createsPublishedNotificationAndUsesAuthenticatedAdminId() {
        assertCreatesNotificationWithStatus("PUBLISHED");
    }

    @Test
    void createsDraftNotificationAndUsesAuthenticatedAdminId() {
        assertCreatesNotificationWithStatus("DRAFT");
    }

    @Test
    void storesTheSelectedAudience() {
        User admin = new User();
        admin.setId(42L);
        when(users.findByEmail("admin@example.com")).thenReturn(Optional.of(admin));
        when(notifications.save(any(Notification.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.createNotification(
                new CreateNotificationRequestDto(
                        "CM notice", "Review the new submission.", "ANNOUNCEMENT", "PUBLISHED", "CONTENT_MANAGER"),
                "admin@example.com");

        assertEquals("CONTENT_MANAGER", response.targetAudience());
        verify(notifications).save(org.mockito.ArgumentMatchers.argThat(saved ->
                "CONTENT_MANAGER".equals(saved.getTargetAudience())));
    }

    @Test
    void loadsNotificationById() {
        Notification item = notification(15L, "Existing title", "ANNOUNCEMENT", "DRAFT");
        when(notifications.findById(15L)).thenReturn(Optional.of(item));

        var response = service.getNotification(15L);

        assertEquals(15L, response.id());
        assertEquals("Existing title", response.title());
        assertEquals("ANNOUNCEMENT", response.type());
        assertEquals("DRAFT", response.status());
    }

    @Test
    void throwsNotFoundWhenLoadingMissingNotification() {
        when(notifications.findById(404L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.getNotification(404L));
    }

    private Notification notification(Long id, String title, String type, String status) {
        Notification item = new Notification();
        item.setId(id);
        item.setCreatedBy(42L);
        item.setTitle(title);
        item.setMessage("Notification message");
        item.setType(type);
        item.setStatus(status);
        item.setCreatedAt(LocalDateTime.of(2026, 10, 14, 9, 0));
        return item;
    }

    private void assertCreatesNotificationWithStatus(String status) {
        User admin = new User();
        admin.setId(42L);
        admin.setEmail("admin@example.com");
        when(users.findByEmail("admin@example.com")).thenReturn(Optional.of(admin));
        when(notifications.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification saved = invocation.getArgument(0);
            saved.setId(19L);
            saved.setCreatedAt(LocalDateTime.of(2026, 10, 30, 12, 0));
            return saved;
        });

        var response = service.createNotification(
                new CreateNotificationRequestDto("  New update  ", "  Message body  ", "UPDATE", status),
                "admin@example.com"
        );

        assertEquals(19L, response.id());
        assertEquals("New update", response.title());
        assertEquals("Message body", response.message());
        assertEquals("UPDATE", response.type());
        assertEquals(status, response.status());
        verify(notifications).save(org.mockito.ArgumentMatchers.argThat(saved ->
                saved.getCreatedBy().equals(42L) && saved.getStatus().equals(status)
        ));
    }
}
