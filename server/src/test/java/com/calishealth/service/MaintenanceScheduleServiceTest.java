package com.calishealth.service;

import com.calishealth.dtos.CreateMaintenanceScheduleRequestDto;
import com.calishealth.exception.RequestValidationException;
import com.calishealth.models.MaintenanceSchedule;
import com.calishealth.models.Notification;
import com.calishealth.models.User;
import com.calishealth.repository.MaintenanceScheduleRepository;
import com.calishealth.repository.NotificationRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentCaptor.forClass;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MaintenanceScheduleServiceTest {
    private final MaintenanceScheduleRepository schedules = mock(MaintenanceScheduleRepository.class);
    private final NotificationRepository notifications = mock(NotificationRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final MaintenanceScheduleService service =
            new MaintenanceScheduleService(schedules, notifications, users);

    @BeforeEach
    void setUp() {
        User admin = new User();
        admin.setId(5L);
        when(users.findByEmail("admin@example.com")).thenReturn(java.util.Optional.of(admin));
        when(notifications.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification notification = invocation.getArgument(0);
            notification.setId(12L);
            return notification;
        });
        when(schedules.save(any(MaintenanceSchedule.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void createsScheduleAndPublishedBroadcastWhenNotificationsAreEnabled() {
        var response = service.create(request(true, startsAt(), startsAt().plusHours(2)), "admin@example.com");

        assertEquals(12L, response.notificationId());
        assertEquals(Set.of("MEMBER_APP"), response.affectedAreas());
        org.mockito.ArgumentCaptor<Notification> notificationCaptor =
                org.mockito.ArgumentCaptor.forClass(Notification.class);
        verify(notifications).save(notificationCaptor.capture());
        Notification notification = notificationCaptor.getValue();
        assertEquals("Scheduled maintenance", notification.getTitle());
        assertEquals("MAINTENANCE", notification.getType());
        assertEquals("PUBLISHED", notification.getStatus());
        assertEquals("UPCOMING", response.status());
        assertEquals("Improving performance. Member app will be unavailable from Nov 4, 2026 02:00 AM to Nov 4, 2026 04:00 AM.",
                notification.getMessage());
        assertNull(notification.getUserId());
        verify(schedules).save(any(MaintenanceSchedule.class));
    }

    @Test
    void createsScheduleWithoutNotificationWhenNotificationsAreDisabled() {
        var response = service.create(request(false, startsAt(), startsAt().plusHours(2)), "admin@example.com");

        assertNull(response.notificationId());
        assertEquals(false, response.notifyMembers());
        verify(notifications, never()).save(any(Notification.class));
        verify(schedules).save(any(MaintenanceSchedule.class));
    }

    @Test
    void rejectsEndTimeThatIsNotAfterStart() {
        assertThrows(
                RequestValidationException.class,
                () -> service.create(request(true, startsAt(), startsAt()), "admin@example.com")
        );

        verify(notifications, never()).save(any(Notification.class));
        verify(schedules, never()).save(any(MaintenanceSchedule.class));
    }

    @Test
    void rejectsPastStartTimeWhenCreating() {
        RequestValidationException exception = assertThrows(
                RequestValidationException.class,
                () -> service.create(
                        request(true, LocalDateTime.now().minusMinutes(1), LocalDateTime.now().plusHours(1)),
                        "admin@example.com"
                )
        );

        assertEquals("startsAt", exception.getField());
        assertEquals("Start time must be in the future.", exception.getMessage());
        verify(schedules, never()).save(any(MaintenanceSchedule.class));
    }

    @Test
    void cancellationMarksScheduleAndPublishesCancellationNotice() {
        MaintenanceSchedule schedule = new MaintenanceSchedule();
        schedule.setId(8L);
        schedule.setTitle("Database upgrade");
        schedule.setStartsAt(startsAt());
        schedule.setEndsAt(startsAt().plusHours(2));
        schedule.setNotifyMembers(true);
        schedule.setNotificationId(12L);
        Notification linked = new Notification();
        linked.setId(12L);
        when(schedules.findById(8L)).thenReturn(java.util.Optional.of(schedule));
        when(notifications.findById(12L)).thenReturn(java.util.Optional.of(linked));

        var response = service.cancel(8L, "admin@example.com");

        assertEquals("CANCELLED", response.status());
        assertEquals("Maintenance schedule cancelled", linked.getTitle());
        assertEquals("The scheduled maintenance 'Database upgrade' has been cancelled.", linked.getMessage());
        verify(notifications).save(same(linked));
        verify(schedules).save(same(schedule));
    }

    @Test
    void sendsMemberReminderOnceWhenReminderWindowIsDue() {
        MaintenanceSchedule schedule = new MaintenanceSchedule();
        schedule.setId(8L);
        schedule.setTitle("Database upgrade");
        schedule.setMessage("Improving performance.");
        schedule.setStartsAt(LocalDateTime.now().plusHours(23));
        schedule.setEndsAt(schedule.getStartsAt().plusHours(2));
        schedule.setAffectedAreas(Set.of("MEMBER_APP"));
        schedule.setNotifyMembers(true);
        schedule.setReminderHours(24);
        when(schedules.findAllByCancelledFalseAndNotifyMembersTrueAndReminderSentFalseAndStartsAtBetween(
                any(LocalDateTime.class), any(LocalDateTime.class)
        )).thenReturn(java.util.List.of(schedule));

        service.sendDueReminders();

        assertEquals(true, schedule.isReminderSent());
        assertEquals(12L, schedule.getReminderNotificationId());
        verify(notifications).save(any(Notification.class));
        verify(schedules).findAllByCancelledFalseAndNotifyMembersTrueAndReminderSentFalseAndStartsAtBetween(
                any(LocalDateTime.class), any(LocalDateTime.class)
        );
    }

    @Test
    void listsMaintenanceSchedulesInPagesOfFive() {
        when(schedules.findAll(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(5), 0));

        service.getSchedules(2);

        org.mockito.ArgumentCaptor<Pageable> pageableCaptor = forClass(Pageable.class);
        verify(schedules).findAll(pageableCaptor.capture());
        assertEquals(2, pageableCaptor.getValue().getPageNumber());
        assertEquals(5, pageableCaptor.getValue().getPageSize());
    }

    private static CreateMaintenanceScheduleRequestDto request(
            boolean notifyMembers,
            LocalDateTime startsAt,
            LocalDateTime endsAt
    ) {
        return new CreateMaintenanceScheduleRequestDto(
                "Database upgrade",
                "Improving performance.",
                startsAt,
                endsAt,
                Set.of("MEMBER_APP"),
                notifyMembers,
                24
        );
    }

    private static LocalDateTime startsAt() {
        return LocalDateTime.of(2026, 11, 4, 2, 0);
    }
}
