package com.calishealth.service;

import com.calishealth.dtos.CreateNotificationRequestDto;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.models.Notification;
import com.calishealth.models.User;
import com.calishealth.repository.NotificationRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Bo sung coverage cho cac nhanh chua duoc kiem tra cua {@link AdminNotificationService}. */
class AdminNotificationServiceExtraCoverageTest {
    private NotificationRepository notifications;
    private UserRepository users;
    private AdminNotificationService service;

    private static final String ADMIN = "admin@example.com";

    @BeforeEach
    void setUp() {
        notifications = mock(NotificationRepository.class);
        users = mock(UserRepository.class);
        service = new AdminNotificationService(notifications, users);

        User admin = new User();
        admin.setId(42L);
        admin.setEmail(ADMIN);
        when(users.findByEmail(ADMIN)).thenReturn(Optional.of(admin));
        when(notifications.save(any(Notification.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    @DisplayName("createNotification: khong tim thay admin -> ResourceNotFoundException")
    void createRejectsUnknownAdmin() {
        when(users.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> service.createNotification(
                        new CreateNotificationRequestDto("Title", "Message", "UPDATE", "PUBLISHED"),
                        "ghost@example.com"));
    }

    @Test
    @DisplayName("getNotifications: type khong ho tro -> 400")
    void getNotificationsRejectsUnsupportedType() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.getNotifications("SPAM"));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("getNotifications: type null -> lay ALL")
    void getNotificationsDefaultsToAll() {
        when(notifications.findAllByTypeInOrderByCreatedAtDesc(anyCollection())).thenReturn(List.of());
        when(notifications.countByType(any())).thenReturn(0L);

        assertEquals(0, service.getNotifications(null).notifications().size());
    }

    @Test
    @DisplayName("deleteNotifications: tat ca id ton tai -> xoa hang loat")
    void deleteNotificationsRemovesAllRows() {
        Notification first = new Notification();
        first.setId(1L);
        Notification second = new Notification();
        second.setId(2L);
        when(notifications.findAllByIdIn(anyCollection())).thenReturn(List.of(first, second));

        service.deleteNotifications(List.of(1L, 2L, 1L));

        verify(notifications).deleteAllByIdIn(anyCollection());
    }

    @Test
    @DisplayName("deleteNotification: id khong ton tai -> ResourceNotFoundException")
    void deleteNotificationRejectsUnknownId() {
        when(notifications.existsById(404L)).thenReturn(false);

        assertThrows(ResourceNotFoundException.class, () -> service.deleteNotification(404L));
    }

    @Test
    @DisplayName("deleteNotification: id ton tai -> xoa")
    void deleteNotificationRemovesRow() {
        when(notifications.existsById(5L)).thenReturn(true);

        service.deleteNotification(5L);

        verify(notifications).deleteById(5L);
    }

    @Test
    @DisplayName("normalizeAudience: ALL_MEMBERS -> MEMBER")
    void audienceAllMembersBecomesMember() {
        var response = service.createNotification(
                new CreateNotificationRequestDto("Title", "Message", "UPDATE", "PUBLISHED", "ALL_MEMBERS"),
                ADMIN);

        assertEquals("MEMBER", response.targetAudience());
    }

    @Test
    @DisplayName("normalizeAudience: ALL_USERS / GLOBAL / ALL_ROLES -> SYSTEM_WIDE")
    void audienceGlobalAliasesBecomeSystemWide() {
        assertEquals("SYSTEM_WIDE", service.createNotification(
                new CreateNotificationRequestDto("T", "M", "UPDATE", "PUBLISHED", "ALL_USERS"), ADMIN)
                .targetAudience());
        assertEquals("SYSTEM_WIDE", service.createNotification(
                new CreateNotificationRequestDto("T", "M", "UPDATE", "PUBLISHED", "GLOBAL"), ADMIN)
                .targetAudience());
        assertEquals("SYSTEM_WIDE", service.createNotification(
                new CreateNotificationRequestDto("T", "M", "UPDATE", "PUBLISHED", "ALL_ROLES"), ADMIN)
                .targetAudience());
    }

    @Test
    @DisplayName("normalizeAudience: rong -> MEMBER")
    void audienceBlankFallsBackToMember() {
        var response = service.createNotification(
                new CreateNotificationRequestDto("T", "M", "UPDATE", "PUBLISHED", "   "),
                ADMIN);

        assertEquals("MEMBER", response.targetAudience());
    }
}
