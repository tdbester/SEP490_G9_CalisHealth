package com.calishealth.dtos;

import com.calishealth.models.UserRole;
import com.calishealth.validation.ValidEmail;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

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
}
