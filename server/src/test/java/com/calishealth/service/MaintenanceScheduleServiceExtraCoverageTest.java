package com.calishealth.service;

import com.calishealth.dtos.CreateMaintenanceScheduleRequestDto;
import com.calishealth.exception.RequestValidationException;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.models.AffectedArea;
import com.calishealth.models.MaintenanceSchedule;
import com.calishealth.models.Notification;
import com.calishealth.models.User;
import com.calishealth.repository.MaintenanceAreaLockRepository;
import com.calishealth.repository.MaintenanceScheduleRepository;
import com.calishealth.repository.NotificationRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Bo sung coverage cho cac nhanh chua duoc kiem tra cua {@link MaintenanceScheduleService}. */
class MaintenanceScheduleServiceExtraCoverageTest {
    private final MaintenanceScheduleRepository schedules = mock(MaintenanceScheduleRepository.class);
    private final NotificationRepository notifications = mock(NotificationRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final MaintenanceAreaLockRepository locks = mock(MaintenanceAreaLockRepository.class);
    private final MaintenanceAreaLockService areaLocks = new MaintenanceAreaLockService(locks);
    private final MaintenanceScheduleService service =
            new MaintenanceScheduleService(schedules, notifications, users, areaLocks);

    private static final String ADMIN = "admin@example.com";

    @BeforeEach
    void setUp() {
        User admin = new User();
        admin.setId(5L);
        when(users.findByEmail(ADMIN)).thenReturn(Optional.of(admin));
        when(notifications.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification notification = invocation.getArgument(0);
            notification.setId(77L);
            return notification;
        });
        when(schedules.save(any(MaintenanceSchedule.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(locks.findByArea(anyString())).thenReturn(Optional.empty());
    }

    private static MaintenanceSchedule schedule(Long id, boolean notifyMembers) {
        MaintenanceSchedule schedule = new MaintenanceSchedule();
        schedule.setId(id);
        schedule.setTitle("Database upgrade");
        schedule.setStartsAt(LocalDateTime.now().plusDays(2));
        schedule.setEndsAt(LocalDateTime.now().plusDays(2).plusHours(2));
        schedule.setAffectedAreas(Set.of("MEMBER_APP_ACCESS"));
        schedule.setNotifyMembers(notifyMembers);
        schedule.setReminderHours(24);
        return schedule;
    }

    @Test
    @DisplayName("create: thieu startsAt -> RequestValidationException")
    void createRejectsMissingStartTime() {
        CreateMaintenanceScheduleRequestDto request = new CreateMaintenanceScheduleRequestDto(
                "Database upgrade", null, null, LocalDateTime.now().plusDays(2).plusHours(2),
                Set.of(AffectedArea.MEMBER_APP_ACCESS), true, 24);

        RequestValidationException error = assertThrows(RequestValidationException.class,
                () -> service.create(request, ADMIN));

        assertEquals("startsAt", error.getField());
    }

    @Test
    @DisplayName("create: thieu endsAt -> RequestValidationException")
    void createRejectsMissingEndTime() {
        LocalDateTime start = LocalDateTime.now().plusDays(2);
        CreateMaintenanceScheduleRequestDto request = new CreateMaintenanceScheduleRequestDto(
                "Database upgrade", null, start, null,
                Set.of(AffectedArea.MEMBER_APP_ACCESS), true, 24);

        RequestValidationException error = assertThrows(RequestValidationException.class,
                () -> service.create(request, ADMIN));

        assertEquals("endsAt", error.getField());
    }

    @Test
    @DisplayName("create: reminder khong hop le -> 400")
    void createRejectsUnsupportedReminderInterval() {
        LocalDateTime start = LocalDateTime.now().plusDays(2);
        CreateMaintenanceScheduleRequestDto request = new CreateMaintenanceScheduleRequestDto(
                "Database upgrade", null, start, start.plusHours(2),
                Set.of(AffectedArea.MEMBER_APP_ACCESS), true, 5);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(request, ADMIN));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("create: affected area rong -> 400")
    void createRejectsUnsupportedAffectedArea() {
        LocalDateTime start = LocalDateTime.now().plusDays(2);
        CreateMaintenanceScheduleRequestDto request = new CreateMaintenanceScheduleRequestDto(
                "Database upgrade", null, start, start.plusHours(2),
                null, true, 24);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(request, ADMIN));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("create: khong tim thay admin -> ResourceNotFoundException")
    void createRejectsUnknownAdmin() {
        when(users.findByEmail("ghost@example.com")).thenReturn(Optional.empty());
        LocalDateTime start = LocalDateTime.now().plusDays(2);
        CreateMaintenanceScheduleRequestDto request = new CreateMaintenanceScheduleRequestDto(
                "Database upgrade", null, start, start.plusHours(2),
                Set.of(AffectedArea.MEMBER_APP_ACCESS), true, 24);

        assertThrows(ResourceNotFoundException.class, () -> service.create(request, "ghost@example.com"));
    }

    @Test
    @DisplayName("start: schedule da huy -> 400")
    void startRejectsCancelledSchedule() {
        MaintenanceSchedule schedule = schedule(1L, true);
        schedule.setCancelled(true);
        when(schedules.findById(1L)).thenReturn(Optional.of(schedule));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.start(1L, ADMIN));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        assertTrue(error.getMessage().contains("Cancelled"));
    }

    @Test
    @DisplayName("start: schedule da hoan thanh -> 400")
    void startRejectsCompletedSchedule() {
        MaintenanceSchedule schedule = schedule(1L, true);
        schedule.setCompletedAt(LocalDateTime.now().minusMinutes(5));
        when(schedules.findById(1L)).thenReturn(Optional.of(schedule));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.start(1L, ADMIN));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        assertTrue(error.getMessage().contains("already been completed"));
    }

    @Test
    @DisplayName("start: chua bat dau -> gan startedAt va startedBy")
    void startSetsStartedMetadata() {
        MaintenanceSchedule schedule = schedule(1L, true);
        when(schedules.findById(1L)).thenReturn(Optional.of(schedule));

        var response = service.start(1L, ADMIN);

        assertNotNull(schedule.getStartedAt());
        assertEquals(5L, schedule.getStartedBy());
        assertEquals("IN_PROGRESS", response.status());
    }

    @Test
    @DisplayName("complete: schedule da huy -> 400")
    void completeRejectsCancelledSchedule() {
        MaintenanceSchedule schedule = schedule(1L, true);
        schedule.setCancelled(true);
        when(schedules.findById(1L)).thenReturn(Optional.of(schedule));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.complete(1L, ADMIN));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        assertTrue(error.getMessage().contains("Cancelled"));
    }

    @Test
    @DisplayName("complete: chua bat dau -> gan startedAt truoc")
    void completeSetsStartedMetadataWhenMissing() {
        MaintenanceSchedule schedule = schedule(1L, true);
        when(schedules.findById(1L)).thenReturn(Optional.of(schedule));

        var response = service.complete(1L, ADMIN);

        assertNotNull(schedule.getStartedAt());
        assertEquals(5L, schedule.getCompletedBy());
        assertEquals("COMPLETED", response.status());
    }

    @Test
    @DisplayName("cancel: da huy truoc do -> tra ve luon, khong tao thong bao moi")
    void cancelIsIdempotent() {
        MaintenanceSchedule schedule = schedule(1L, true);
        schedule.setCancelled(true);
        when(schedules.findById(1L)).thenReturn(Optional.of(schedule));

        var response = service.cancel(1L, ADMIN);

        assertEquals("CANCELLED", response.status());
        verify(notifications, never()).save(any(Notification.class));
    }

    @Test
    @DisplayName("cancel: khong co linked notification -> tao notification moi")
    void cancelCreatesNotificationWhenLinkMissing() {
        MaintenanceSchedule schedule = schedule(1L, true);
        schedule.setNotificationId(null);
        when(schedules.findById(1L)).thenReturn(Optional.of(schedule));

        service.cancel(1L, ADMIN);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notifications).save(captor.capture());
        assertEquals(5L, captor.getValue().getCreatedBy());
        assertEquals("Maintenance schedule cancelled", captor.getValue().getTitle());
        assertEquals(77L, schedule.getNotificationId());
    }

    @Test
    @DisplayName("cancel: xoa reminder notification da gui")
    void cancelDeletesReminderNotification() {
        MaintenanceSchedule schedule = schedule(1L, true);
        schedule.setNotificationId(12L);
        schedule.setReminderNotificationId(34L);
        Notification linked = new Notification();
        linked.setId(12L);
        when(schedules.findById(1L)).thenReturn(Optional.of(schedule));
        when(notifications.findById(12L)).thenReturn(Optional.of(linked));

        service.cancel(1L, ADMIN);

        verify(notifications).deleteById(34L);
        assertNull(schedule.getReminderNotificationId());
    }

    @Test
    @DisplayName("cancel: linked notification khong con trong DB -> tao notification moi")
    void cancelCreatesNotificationWhenLinkedRecordMissing() {
        MaintenanceSchedule schedule = schedule(1L, true);
        schedule.setNotificationId(12L);
        when(schedules.findById(1L)).thenReturn(Optional.of(schedule));
        when(notifications.findById(12L)).thenReturn(Optional.empty());

        service.cancel(1L, ADMIN);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notifications).save(captor.capture());
        assertEquals(5L, captor.getValue().getCreatedBy());
    }

    @Test
    @DisplayName("sendDueReminders: schedule chua toi gio nhac -> bo qua")
    void sendDueRemindersSkipsSchedulesOutsideTheReminderWindow() {
        MaintenanceSchedule schedule = schedule(1L, true);
        schedule.setStartsAt(LocalDateTime.now().plusHours(30));
        when(schedules.findAllByCancelledFalseAndNotifyMembersTrueAndReminderSentFalseAndStartsAtBetween(
                any(LocalDateTime.class), any(LocalDateTime.class))).thenReturn(List.of(schedule));

        service.sendDueReminders();

        assertFalse(schedule.isReminderSent());
        verify(notifications, never()).save(any(Notification.class));
    }

    @Test
    @DisplayName("sendDueReminders: nhac nhieu lich -> tao nhieu thong bao")
    void sendDueRemindersCreatesOneReminderPerSchedule() {
        MaintenanceSchedule first = schedule(1L, true);
        first.setStartsAt(LocalDateTime.now().plusHours(2));
        MaintenanceSchedule second = schedule(2L, true);
        second.setStartsAt(LocalDateTime.now().plusHours(3));
        when(schedules.findAllByCancelledFalseAndNotifyMembersTrueAndReminderSentFalseAndStartsAtBetween(
                any(LocalDateTime.class), any(LocalDateTime.class))).thenReturn(List.of(first, second));

        service.sendDueReminders();

        verify(notifications, times(2)).save(any(Notification.class));
        assertTrue(first.isReminderSent());
        assertTrue(second.isReminderSent());
    }

    @Test
    @DisplayName("getSchedule: khong tim thay -> ResourceNotFoundException")
    void getScheduleRejectsUnknownId() {
        when(schedules.findById(999L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.getSchedule(999L));
    }

    @Test
    @DisplayName("getSchedule: schedule da huy -> status CANCELLED")
    void getScheduleReportsCancelledStatus() {
        MaintenanceSchedule schedule = schedule(1L, true);
        schedule.setCancelled(true);
        when(schedules.findById(1L)).thenReturn(Optional.of(schedule));

        assertEquals("CANCELLED", service.getSchedule(1L).status());
    }

    @Test
    @DisplayName("toResponse: vung bi admin khoa -> locked = true")
    void toResponseReportsLockedArea() {
        MaintenanceSchedule schedule = schedule(1L, true);
        com.calishealth.models.MaintenanceAreaLock lock =
                new com.calishealth.models.MaintenanceAreaLock();
        lock.setArea("MEMBER_APP_ACCESS");
        lock.setLocked(true);
        when(locks.findByArea("MEMBER_APP_ACCESS")).thenReturn(Optional.of(lock));
        when(schedules.findById(1L)).thenReturn(Optional.of(schedule));

        assertTrue(service.getSchedule(1L).locked());
    }

    @Test
    @DisplayName("buildNotificationMessage: nhieu khu vuc -> dinh dang danh sach co 'and'")
    void buildNotificationMessageFormatsMultipleAreas() {
        MaintenanceSchedule schedule = schedule(1L, true);
        schedule.setAffectedAreas(Set.of("MEMBER_APP_ACCESS", "MEMBER_VIDEO_UPLOADS"));
        schedule.setMessage("");
        when(schedules.findById(1L)).thenReturn(Optional.of(schedule));

        var response = service.getSchedule(1L);


        assertEquals(Set.of("MEMBER_APP_ACCESS", "MEMBER_VIDEO_UPLOADS"), response.affectedAreas());
    }

    @Test
    @DisplayName("create: message rong -> luu null")
    void createNormalisesBlankMessageToNull() {
        LocalDateTime start = LocalDateTime.now().plusDays(2);
        CreateMaintenanceScheduleRequestDto request = new CreateMaintenanceScheduleRequestDto(
                "  Database upgrade  ", "   ", start, start.plusHours(2),
                Set.of(AffectedArea.MEMBER_APP_ACCESS, AffectedArea.MEMBER_VIDEO_UPLOADS,
                        AffectedArea.AI_POSE_ASSESSMENT),
                true, 24);

        var response = service.create(request, ADMIN);

        assertEquals("Database upgrade", response.title());
        assertNull(response.message());
        assertEquals(3, response.affectedAreas().size());
    }
}
