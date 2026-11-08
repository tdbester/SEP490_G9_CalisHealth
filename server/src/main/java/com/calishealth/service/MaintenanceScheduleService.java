package com.calishealth.service;

import com.calishealth.dtos.CreateMaintenanceScheduleRequestDto;
import com.calishealth.dtos.MaintenanceScheduleResponseDto;
import com.calishealth.exception.RequestValidationException;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.models.MaintenanceSchedule;
import com.calishealth.models.AffectedArea;
import com.calishealth.models.Notification;
import com.calishealth.models.User;
import com.calishealth.repository.MaintenanceScheduleRepository;
import com.calishealth.repository.NotificationRepository;
import com.calishealth.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class MaintenanceScheduleService {
    /** A schedule turns red this long before its window starts and stays red until the window ends. */
    public static final int DUE_WINDOW_MINUTES = 30;

    private static final Set<String> ALLOWED_AREAS =
            Set.of(
                    "MEMBER_APP_ACCESS",
                    "MEMBER_VIDEO_UPLOADS",
                    "AI_POSE_ASSESSMENT",
                    "SYSTEM_STORAGE_CDN",
                    "ADMIN_MANAGEMENT_PORTAL"
            );
    private static final List<String> AREA_ORDER =
            List.of(
                    "MEMBER_APP_ACCESS",
                    "MEMBER_VIDEO_UPLOADS",
                    "AI_POSE_ASSESSMENT",
                    "SYSTEM_STORAGE_CDN",
                    "ADMIN_MANAGEMENT_PORTAL"
            );
    private static final Set<Integer> ALLOWED_REMINDERS = Set.of(1, 12, 24, 48);
    private static final int PAGE_SIZE = 5;
    private static final Map<String, String> AREA_LABELS = Map.of(
            "MEMBER_APP_ACCESS", "Member App Access",
            "MEMBER_VIDEO_UPLOADS", "Member Video Uploads",
            "AI_POSE_ASSESSMENT", "AI Pose Assessment",
            "SYSTEM_STORAGE_CDN", "System Storage & CDN",
            "ADMIN_MANAGEMENT_PORTAL", "Admin Management Portal"
    );
    private static final DateTimeFormatter PREVIEW_DATE =
            DateTimeFormatter.ofPattern("MMM d, yyyy hh:mm a", java.util.Locale.ENGLISH);

    private final MaintenanceScheduleRepository schedules;
    private final NotificationRepository notifications;
    private final UserRepository users;
    private final MaintenanceAreaLockService areaLocks;

    public MaintenanceScheduleService(
            MaintenanceScheduleRepository schedules,
            NotificationRepository notifications,
            UserRepository users,
            MaintenanceAreaLockService areaLocks
    ) {
        this.schedules = schedules;
        this.notifications = notifications;
        this.users = users;
        this.areaLocks = areaLocks;
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
    public Page<MaintenanceScheduleResponseDto> getSchedules(
            int page,
            String title,
            LocalDateTime startsFrom,
            LocalDateTime startsTo,
            LocalDateTime endsFrom,
            LocalDateTime endsTo
    ) {
        String normalizedTitle = title == null || title.isBlank() ? null : title.trim();
        return schedules.searchSchedules(
                        normalizedTitle,
                        startsFrom,
                        startsTo,
                        endsFrom,
                        endsTo,
                        LocalDateTime.now().plusMinutes(MaintenanceScheduleService.DUE_WINDOW_MINUTES),
                        org.springframework.data.domain.PageRequest.of(
                                Math.max(0, page),
                                PAGE_SIZE
                        )
                )
                .map(this::toResponse);
    }

    @Transactional
    public MaintenanceScheduleResponseDto getSchedule(Long id) {
        return toResponse(getScheduleEntity(id));
    }

    /**
     * Marks the maintenance work as started and locks the affected service areas by hand.
     */
    @Transactional
    public MaintenanceScheduleResponseDto start(Long id, String adminEmail) {
        MaintenanceSchedule schedule = getScheduleEntity(id);
        if (schedule.isCancelled()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cancelled schedules cannot be started");
        }
        if (schedule.getCompletedAt() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This schedule has already been completed");
        }
        User admin = getAdmin(adminEmail);
        if (schedule.getStartedAt() == null) {
            schedule.setStartedAt(LocalDateTime.now());
            schedule.setStartedBy(admin.getId());
        }
        areaLocks.lockScheduleAreas(schedule.getId(), List.copyOf(schedule.getAffectedAreas()));
        return toResponse(schedules.save(schedule));
    }

    /**
     * Marks the maintenance work as finished and releases the affected service areas.
     */
    @Transactional
    public MaintenanceScheduleResponseDto complete(Long id, String adminEmail) {
        MaintenanceSchedule schedule = getScheduleEntity(id);
        if (schedule.isCancelled()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cancelled schedules cannot be completed");
        }
        User admin = getAdmin(adminEmail);
        if (schedule.getStartedAt() == null) {
            schedule.setStartedAt(LocalDateTime.now());
            schedule.setStartedBy(admin.getId());
        }
        schedule.setCompletedAt(LocalDateTime.now());
        schedule.setCompletedBy(admin.getId());
        areaLocks.unlockScheduleAreas(List.copyOf(schedule.getAffectedAreas()));
        return toResponse(schedules.save(schedule));
    }

    /**
     * The schedule only notifies users, so nothing is locked by a schedule window alone.
     * A service area is only unavailable while an admin locked it by hand.
     */
    public boolean isServiceUnderMaintenance(String serviceKey) {
        if (!ALLOWED_AREAS.contains(serviceKey)) {
            throw new IllegalArgumentException("Unsupported maintenance service key: " + serviceKey);
        }
        return areaLocks.isAreaLocked(serviceKey);
    }

    public Map<String, Boolean> getServiceMaintenanceStatus() {
        Map<String, Boolean> status = new LinkedHashMap<>();
        for (String area : AREA_ORDER) {
            status.put(area, areaLocks.isAreaLocked(area));
        }
        return status;
    }

    @Transactional
    public MaintenanceScheduleResponseDto cancel(Long id, String adminEmail) {
        MaintenanceSchedule schedule = getScheduleEntity(id);
        if (schedule.isCancelled()) {
            return toResponse(schedule);
        }
        schedule.setCancelled(true);
        areaLocks.unlockScheduleAreas(List.copyOf(schedule.getAffectedAreas()));
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
        if (request.startsAt().isBefore(now.plusHours(3))) {
            throw new RequestValidationException("startsAt", "Start time must be at least 3 hours from now.");
        }
        if (request.endsAt() == null) {
            throw new RequestValidationException("endsAt", "End time is required");
        }
        if (request.endsAt().isBefore(request.startsAt().plusHours(2))) {
            throw new RequestValidationException("endsAt", "Maintenance duration must be at least 2 hours.");
        }
        if (!ALLOWED_REMINDERS.contains(request.reminderHours())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported reminder interval");
        }
        if (request.affectedAreas() == null
                || !ALLOWED_AREAS.containsAll(request.affectedAreas().stream().map(Enum::name).toList())) {
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
        schedule.setAffectedAreas(request.affectedAreas().stream()
                .map(AffectedArea::name)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new)));
        schedule.setNotifyMembers(request.notifyMembers());
        schedule.setReminderHours(request.reminderHours());
    }

    private static Notification createMaintenanceNotification(MaintenanceSchedule schedule, Long adminId) {
        Notification notification = new Notification();
        notification.setCreatedBy(adminId);
        notification.setUserId(null);
        notification.setTargetAudience("SYSTEM_WIDE");
        updateMaintenanceNotification(notification, schedule);
        return notification;
    }

    private static void updateMaintenanceNotification(Notification notification, MaintenanceSchedule schedule) {
        notification.setTargetAudience("SYSTEM_WIDE");
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

    private MaintenanceScheduleResponseDto toResponse(MaintenanceSchedule schedule) {
        return toResponse(schedule, LocalDateTime.now());
    }

    private MaintenanceScheduleResponseDto toResponse(MaintenanceSchedule schedule, LocalDateTime now) {
        boolean locked = schedule.getAffectedAreas().stream()
                .anyMatch(area -> areaLocks.isAreaLocked(area));
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
                getStatus(schedule, now),
                schedule.getCreatedAt(),
                schedule.getStartedAt(),
                schedule.getCompletedAt(),
                isDueForExecution(schedule, now),
                locked
        );
    }

    /**
     * A schedule turns red from 30 minutes before its window starts and stays red
     * throughout the whole maintenance window.
     */
    private static boolean isDueForExecution(MaintenanceSchedule schedule, LocalDateTime now) {
        if (schedule.isCancelled() || schedule.getCompletedAt() != null) {
            return false;
        }
        LocalDateTime dueFrom = schedule.getStartsAt().minusMinutes(DUE_WINDOW_MINUTES);
        return !now.isBefore(dueFrom) && !now.isAfter(schedule.getEndsAt());
    }

    /**
     * The schedule reached its maintenance time and still waits for the admin to act.
     */
    private static boolean isReady(MaintenanceSchedule schedule, LocalDateTime now) {
        if (schedule.isCancelled() || schedule.getCompletedAt() != null) {
            return false;
        }
        return !now.isBefore(schedule.getStartsAt().minusMinutes(DUE_WINDOW_MINUTES));
    }

    /**
     * The lifecycle of a maintenance schedule.
     *
     * <ul>
     *   <li>{@code PENDING} — chưa thực hiện, chưa tới giờ.</li>
     *   <li>{@code READY} — đã đến giờ, admin cần bấm bắt đầu bảo trì.</li>
     *   <li>{@code IN_PROGRESS} — đang thực hiện, khu vực đang bị khoá.</li>
     *   <li>{@code COMPLETED} — đã thực hiện xong.</li>
     *   <li>{@code CANCELLED} — đã hủy.</li>
     * </ul>
     */
    private static String getStatus(MaintenanceSchedule schedule, LocalDateTime now) {
        if (schedule.isCancelled()) return "CANCELLED";
        if (schedule.getCompletedAt() != null) return "COMPLETED";
        if (schedule.getStartedAt() != null) return "IN_PROGRESS";
        if (isReady(schedule, now)) return "READY";
        return "PENDING";
    }
}
