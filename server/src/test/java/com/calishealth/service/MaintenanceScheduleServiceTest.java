package com.calishealth.service;

import com.calishealth.dtos.CreateMaintenanceScheduleRequestDto;
import com.calishealth.exception.RequestValidationException;
import com.calishealth.models.MaintenanceSchedule;
import com.calishealth.models.Notification;
import com.calishealth.models.User;
import com.calishealth.models.AffectedArea;
import com.calishealth.repository.MaintenanceScheduleRepository;
import com.calishealth.repository.NotificationRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
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
        LocalDateTime start = startsAt();
        var response = service.create(request(true, start, start.plusHours(2)), "admin@example.com");

        assertEquals(12L, response.notificationId());
        assertEquals(Set.of("MEMBER_APP_ACCESS"), response.affectedAreas());
        org.mockito.ArgumentCaptor<Notification> notificationCaptor =
                org.mockito.ArgumentCaptor.forClass(Notification.class);
        verify(notifications).save(notificationCaptor.capture());
        Notification notification = notificationCaptor.getValue();
        assertEquals("Scheduled maintenance", notification.getTitle());
        assertEquals("MAINTENANCE", notification.getType());
        assertEquals("PUBLISHED", notification.getStatus());
        assertEquals("UPCOMING", response.status());
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM d, yyyy hh:mm a", java.util.Locale.ENGLISH);
        assertEquals("Improving performance. Member App Access will be unavailable from "
                        + start.format(formatter) + " to " + start.plusHours(2).format(formatter) + ".",
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
    void rejectsMaintenanceDurationShorterThanTwoHours() {
        assertThrows(
                RequestValidationException.class,
                () -> service.create(
                        request(true, startsAt(), startsAt().plusHours(2).minusSeconds(1)),
                        "admin@example.com"
                )
        );

        verify(notifications, never()).save(any(Notification.class));
        verify(schedules, never()).save(any(MaintenanceSchedule.class));
    }

    @Test
    void rejectsStartTimeLessThanThreeHoursInAdvance() {
        RequestValidationException exception = assertThrows(
                RequestValidationException.class,
                () -> service.create(
                        request(true, LocalDateTime.now().plusHours(3).minusSeconds(1),
                                LocalDateTime.now().plusHours(6)),
                        "admin@example.com"
                )
        );

        assertEquals("startsAt", exception.getField());
        assertEquals("Start time must be at least 3 hours from now.", exception.getMessage());
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
        schedule.setAffectedAreas(Set.of("MEMBER_APP_ACCESS"));
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

    @Test
    void reportsAreaUnderMaintenanceOnlyWhenAnActiveScheduleMatches() {
        when(schedules.countActiveSchedulesByArea(
                org.mockito.ArgumentMatchers.eq("MEMBER_VIDEO_UPLOADS"),
                any(LocalDateTime.class)
        )).thenReturn(1L);

        assertEquals(true, service.isServiceUnderMaintenance("MEMBER_VIDEO_UPLOADS"));
        verify(schedules).countActiveSchedulesByArea(
                org.mockito.ArgumentMatchers.eq("MEMBER_VIDEO_UPLOADS"),
                any(LocalDateTime.class)
        );
    }

    @Test
    void reportsAllDomainMaintenanceFlagsForAdmin() {
        when(schedules.findActiveAreas(any(LocalDateTime.class)))
                .thenReturn(Set.of("ADMIN_MANAGEMENT_PORTAL", "SYSTEM_STORAGE_CDN"));

        var status = service.getServiceMaintenanceStatus();

        assertEquals(5, status.size());
        assertEquals(true, status.get("ADMIN_MANAGEMENT_PORTAL"));
        assertEquals(true, status.get("SYSTEM_STORAGE_CDN"));
        assertEquals(false, status.get("AI_POSE_ASSESSMENT"));
    }

    @Test
    void rejectsUnknownMaintenanceServiceKey() {
        assertThrows(IllegalArgumentException.class, () -> service.isServiceUnderMaintenance("UNKNOWN"));
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
                Set.of(AffectedArea.MEMBER_APP_ACCESS),
                notifyMembers,
                24
        );
    }

    private static LocalDateTime startsAt() {
        return LocalDateTime.now().plusDays(2).withHour(2).withMinute(0).withSecond(0).withNano(0);
    }
}
