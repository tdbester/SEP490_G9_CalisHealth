package com.calishealth.service;

import com.calishealth.dtos.CreateMaintenanceScheduleRequestDto;
import com.calishealth.dtos.MaintenanceScheduleResponseDto;
import com.calishealth.exception.RequestValidationException;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.models.MaintenanceSchedule;
import com.calishealth.models.Notification;
import com.calishealth.models.User;
import com.calishealth.repository.MaintenanceScheduleRepository;
import com.calishealth.repository.NotificationRepository;
import com.calishealth.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class MaintenanceScheduleService {
    private static final Set<String> ALLOWED_AREAS =
            Set.of("MEMBER_APP", "AI_CAMERA_TRAINING", "UPLOADS", "ADMIN_AREA");
    private static final List<String> AREA_ORDER =
            List.of("MEMBER_APP", "AI_CAMERA_TRAINING", "UPLOADS", "ADMIN_AREA");
    private static final Set<Integer> ALLOWED_REMINDERS = Set.of(1, 12, 24, 48);
    private static final Map<String, String> AREA_LABELS = Map.of(
            "MEMBER_APP", "Member app",
            "AI_CAMERA_TRAINING", "AI camera training",
            "UPLOADS", "Uploads",
            "ADMIN_AREA", "Admin area"
    );
    private static final DateTimeFormatter PREVIEW_DATE =
            DateTimeFormatter.ofPattern("MMM d, yyyy hh:mm a", java.util.Locale.ENGLISH);

    private final MaintenanceScheduleRepository schedules;
    private final NotificationRepository notifications;
    private final UserRepository users;

    public MaintenanceScheduleService(
            MaintenanceScheduleRepository schedules,
            NotificationRepository notifications,
            UserRepository users
    ) {
        this.schedules = schedules;
        this.notifications = notifications;
        this.users = users;
    }

    @Transactional
    public MaintenanceScheduleResponseDto create(
            CreateMaintenanceScheduleRequestDto request,
            String adminEmail
    ) {
        validate(request);
        User admin = getAdmin(adminEmail);
        MaintenanceSchedule schedule = new MaintenanceSchedule();
        applyRequest(schedule, request);
        schedule.setCreatedBy(admin.getId());

        if (schedule.isNotifyMembers()) {
            Notification notification = notifications.save(
                    createMaintenanceNotification(schedule, admin.getId())
            );
            schedule.setNotificationId(notification.getId());
        }

        return toResponse(schedules.save(schedule));
    }

    @Transactional
    public Page<MaintenanceScheduleResponseDto> getSchedules(int page) {
        return schedules.findAll(PageRequest.of(Math.max(0, page), 5, Sort.by("startsAt").ascending()))
                .map(MaintenanceScheduleService::toResponse);
    }

    @Transactional
    public MaintenanceScheduleResponseDto getSchedule(Long id) {
        return toResponse(getScheduleEntity(id));
    }

    @Transactional
    public MaintenanceScheduleResponseDto cancel(Long id, String adminEmail) {
        MaintenanceSchedule schedule = getScheduleEntity(id);
        if (schedule.isCancelled()) {
            return toResponse(schedule);
        }
        schedule.setCancelled(true);
        if (schedule.isNotifyMembers()) {
            User admin = getAdmin(adminEmail);
            Notification notification = getLinkedNotification(schedule);
            if (notification == null) {
                notification = new Notification();
                notification.setCreatedBy(admin.getId());
            }
            notification.setTitle("Maintenance schedule cancelled");
            notification.setMessage("The scheduled maintenance '" + schedule.getTitle() + "' has been cancelled.");
            notification.setType("MAINTENANCE");
            notification.setStatus("PUBLISHED");
            schedule.setNotificationId(notifications.save(notification).getId());
            if (schedule.getReminderNotificationId() != null) {
                notifications.deleteById(schedule.getReminderNotificationId());
                schedule.setReminderNotificationId(null);
            }
        }
        return toResponse(schedules.save(schedule));
    }

    @Scheduled(fixedDelayString = "${maintenance.reminder-poll-ms:60000}")
    @Transactional
    public void sendDueReminders() {
        LocalDateTime now = LocalDateTime.now();
        int maxReminderHours = ALLOWED_REMINDERS.stream().mapToInt(Integer::intValue).max().orElse(48);
        List<MaintenanceSchedule> dueSchedules =
                schedules.findAllByCancelledFalseAndNotifyMembersTrueAndReminderSentFalseAndStartsAtBetween(
                        now,
                        now.plusHours(maxReminderHours)
                );
        for (MaintenanceSchedule schedule : dueSchedules) {
            if (schedule.getStartsAt().minusHours(schedule.getReminderHours()).isAfter(now)) continue;

            Notification reminder = new Notification();
            reminder.setTitle("Maintenance reminder");
            reminder.setMessage("Reminder: " + buildNotificationMessage(schedule));
            reminder.setType("MAINTENANCE");
            reminder.setStatus("PUBLISHED");
            reminder.setCreatedBy(schedule.getCreatedBy());
            schedule.setReminderNotificationId(notifications.save(reminder).getId());
            schedule.setReminderSent(true);
        }
    }

    private void validate(CreateMaintenanceScheduleRequestDto request) {
        LocalDateTime now = LocalDateTime.now();
        if (request.startsAt() == null) {
            throw new RequestValidationException("startsAt", "Start time is required");
        }
        if (!request.startsAt().isAfter(now)) {
            throw new RequestValidationException("startsAt", "Start time must be in the future.");
        }
        if (request.endsAt() == null) {
            throw new RequestValidationException("endsAt", "End time is required");
        }
        if (!request.endsAt().isAfter(request.startsAt())) {
            throw new RequestValidationException("endsAt", "End time must be after start time.");
        }
        if (!ALLOWED_REMINDERS.contains(request.reminderHours())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported reminder interval");
        }
        if (!ALLOWED_AREAS.containsAll(request.affectedAreas())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported affected area");
        }
    }

    private User getAdmin(String adminEmail) {
        return users.findByEmail(adminEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Authenticated admin user was not found"));
    }

    private MaintenanceSchedule getScheduleEntity(Long id) {
        return schedules.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Maintenance schedule not found: " + id));
    }

    private Notification getLinkedNotification(MaintenanceSchedule schedule) {
        if (schedule.getNotificationId() == null) return null;
        return notifications.findById(schedule.getNotificationId()).orElse(null);
    }

    private static void applyRequest(
            MaintenanceSchedule schedule,
            CreateMaintenanceScheduleRequestDto request
    ) {
        schedule.setTitle(request.title().trim());
        schedule.setMessage(request.message() == null || request.message().isBlank()
                ? null
                : request.message().trim());
        schedule.setStartsAt(request.startsAt());
        schedule.setEndsAt(request.endsAt());
        schedule.setAffectedAreas(new LinkedHashSet<>(request.affectedAreas()));
        schedule.setNotifyMembers(request.notifyMembers());
        schedule.setReminderHours(request.reminderHours());
    }

    private static Notification createMaintenanceNotification(MaintenanceSchedule schedule, Long adminId) {
        Notification notification = new Notification();
        notification.setCreatedBy(adminId);
        notification.setUserId(null);
        updateMaintenanceNotification(notification, schedule);
        return notification;
    }

    private static void updateMaintenanceNotification(Notification notification, MaintenanceSchedule schedule) {
        notification.setTitle("Scheduled maintenance");
        notification.setMessage(buildNotificationMessage(schedule));
        notification.setType("MAINTENANCE");
        notification.setStatus("PUBLISHED");
    }

    private static String buildNotificationMessage(MaintenanceSchedule schedule) {
        List<String> areas = AREA_ORDER.stream()
                .filter(schedule.getAffectedAreas()::contains)
                .map(AREA_LABELS::get)
                .toList();
        String affectedAreas = formatAreas(areas);
        String availability = affectedAreas + " will be unavailable";
        String window = " from " + schedule.getStartsAt().format(PREVIEW_DATE)
                + " to " + schedule.getEndsAt().format(PREVIEW_DATE) + ".";
        String optionalMessage = schedule.getMessage();
        return optionalMessage == null || optionalMessage.isBlank()
                ? availability + window
                : optionalMessage + " " + availability + window;
    }

    private static String formatAreas(List<String> areas) {
        if (areas.size() == 1) return areas.get(0);
        if (areas.size() == 2) return areas.get(0) + " and " + areas.get(1);
        return String.join(", ", areas.subList(0, areas.size() - 1))
                + ", and " + areas.get(areas.size() - 1);
    }

    private static MaintenanceScheduleResponseDto toResponse(MaintenanceSchedule schedule) {
        return new MaintenanceScheduleResponseDto(
                schedule.getId(),
                schedule.getTitle(),
                schedule.getMessage(),
                schedule.getStartsAt(),
                schedule.getEndsAt(),
                Set.copyOf(schedule.getAffectedAreas()),
                schedule.isNotifyMembers(),
                schedule.isNotifyMembers() && schedule.getNotificationId() != null,
                schedule.getReminderHours(),
                schedule.getNotificationId(),
                getStatus(schedule),
                schedule.getCreatedAt()
        );
    }

    private static String getStatus(MaintenanceSchedule schedule) {
        return getStatus(schedule, LocalDateTime.now());
    }

    private static String getStatus(MaintenanceSchedule schedule, LocalDateTime now) {
        if (schedule.isCancelled()) return "CANCELLED";
        if (now.isBefore(schedule.getStartsAt())) return "UPCOMING";
        if (!now.isAfter(schedule.getEndsAt())) return "ONGOING";
        return "COMPLETED";
    }
}
