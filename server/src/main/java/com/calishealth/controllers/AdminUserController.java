package com.calishealth.controllers;

import com.calishealth.dtos.AdminUserDtos.*;
import com.calishealth.models.UserRole;
import com.calishealth.service.AdminUserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/** Protected by SecurityConfig: /api/admin/** requires ROLE_ADMIN. */
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {
    private final AdminUserService service;

    @GetMapping
    public UserPage list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) UserRole role,
            @RequestParam(required = false) StatusFilter status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate joinedOn,
            @RequestParam(defaultValue = "newest") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return service.list(q, role, status, joinedOn, sort, page, size);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserItem create(Authentication a, @Valid @RequestBody CreateUserRequest r) {
        return service.create((String) a.getPrincipal(), r);
    }

    @GetMapping("/{id}")
    public UserDetail detail(Authentication a, @PathVariable Long id) {
        return service.detail((String) a.getPrincipal(), id);
    }

    @GetMapping("/{id}/workout-activity")
    public ActivityPage<WorkoutActivityItem> workoutActivity(
            @PathVariable Long id,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) ActivityKind type,
            @RequestParam(required = false) String level,
            @RequestParam(required = false) ActivityStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size) {
        return service.workoutActivity(id, q, type, level, status, date, page, size);
    }

    @GetMapping("/{id}/system-logs")
    public ActivityPage<SystemLogItem> systemLogs(
            @PathVariable Long id,
            @RequestParam(required = false) LogEventType type,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size) {
        return service.systemLogs(id, type, date, page, size);
    }

    @GetMapping("/{id}/admin-actions")
    public ActivityPage<AdminActionItem> adminActions(
            @PathVariable Long id,
            @RequestParam(required = false) AdminActionType action,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size) {
        return service.adminActions(id, action, date, page, size);
    }

    @GetMapping("/{id}/content-activity")
    public ActivityPage<ContentActivityItem> contentActivity(
            @PathVariable Long id,
            @RequestParam(required = false) ContentItemType type,
            @RequestParam(required = false) ContentActionType action,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size) {
        return service.contentActivity(id, type, action, page, size);
    }

    @PatchMapping("/status")
    public BulkResult updateStatus(Authentication a, @Valid @RequestBody BulkStatusRequest r) {
        return service.setActive((String) a.getPrincipal(), r);
    }
}
