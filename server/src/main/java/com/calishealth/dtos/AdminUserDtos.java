package com.calishealth.dtos;

import com.calishealth.models.UserRole;
import com.calishealth.validation.ValidEmail;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public class AdminUserDtos {
    /** ACTIVE = can sign in (verified and not blocked); INACTIVE = blocked or email not verified. */
    public enum StatusFilter { ACTIVE, INACTIVE }

    /** One row of the admin user table. userCode is the display id, e.g. USR-00124. */
    public record UserItem(
            Long id,
            String userCode,
            String fullName,
            String email,
            String role,
            boolean active,
            LocalDateTime createdAt) {}

    /** Table-wide numbers (ignore the current search/filter): stat cards and role dropdown counts. */
    public record Summary(long total, long active, long inactive, Map<String, Long> byRole) {}

    public record UserPage(
            List<UserItem> items,
            int page,
            int size,
            long totalElements,
            int totalPages,
            Summary summary) {}

    public record CreateUserRequest(
            @NotBlank(message = "Please enter the full name") @Size(max = 255, message = "Full name is too long") String fullName,
            @ValidEmail String email,
            @NotNull(message = "Please choose a role") UserRole role) {}

    public record BulkStatusRequest(
            @NotEmpty(message = "Select at least one user") @Size(max = 200, message = "Too many users selected") List<Long> ids,
            @NotNull(message = "Status is required") Boolean active) {}

    public record BulkResult(int affected) {}

    // ---------------------------------------------------------------------------------
    // User detail & activity log (Figma user-detail-*)
    // ---------------------------------------------------------------------------------

    /** Row filters of the activity tables. Invalid values are rejected by Spring with HTTP 400. */
    public enum ActivityKind { WORKOUT, EXERCISE }
    public enum ActivityStatus { COMPLETED, CANCELLED, IN_PROGRESS }
    public enum LogEventType {
        SKILL, LEVEL_CHANGE, ASSESSMENT, ACCOUNT, LOGIN, MODERATION, NOTIFICATION, MAINTENANCE, STORAGE
    }
    public enum AdminActionType { CREATE_ACCOUNT, ACTIVATE, DEACTIVATE }
    public enum ContentItemType { SKILL, EXERCISE, WORKOUT }
    /** exercises / workout_entries keep no creation time, so the date is the last change and the action is derived from the active flag. */
    public enum ContentActionType { UPDATED, DEACTIVATED }

    /** Profile and progress of a MEMBER. Fields are null when the member has no profile data yet. */
    public record MemberInfo(
            Integer age,
            String gender,
            String goal,
            BigDecimal heightCm,
            BigDecimal weightKg,
            String levelName,
            Integer levelRank,
            long totalWorkouts,
            int streakDays,
            int longestStreak,
            List<String> levelOptions) {}

    /** Numbers of a CONTENT_MANAGER. reviewed is null: moderation decisions do not record who made them. */
    public record ContentInfo(long exercises, long skills, long workouts, Long reviewed) {}

    public record AdminInfo(
            long accountsCreated,
            long usersDeactivated,
            long usersActivated,
            long notificationsSent,
            long maintenanceSchedules,
            long storageActions) {}

    /** passwordState is DEFAULT or CHANGED for staff accounts and null for members. */
    public record UserDetail(
            Long id,
            String userCode,
            String fullName,
            String email,
            String role,
            boolean active,
            boolean self,
            LocalDateTime createdAt,
            LocalDateTime lastActiveAt,
            String passwordState,
            MemberInfo member,
            ContentInfo content,
            AdminInfo admin) {}

    public record ActivityPage<T>(List<T> items, int page, int size, long totalElements, int totalPages) {}

    /** One workout session or one exercise of a session. detail is display text, e.g. "3 sets · 24 reps". */
    public record WorkoutActivityItem(
            ActivityKind kind,
            LocalDateTime occurredAt,
            String name,
            String detail,
            String level,
            ActivityStatus status) {}

    public record SystemLogItem(LocalDateTime occurredAt, LogEventType eventType, String description, String status) {}

    public record AdminActionItem(
            LocalDateTime occurredAt,
            AdminActionType action,
            String status,
            String targetName,
            String targetCode,
            String targetRole) {}

    public record ContentActivityItem(
            LocalDateTime occurredAt,
            ContentItemType itemType,
            String name,
            String code,
            ContentActionType action,
            String status) {}
}
