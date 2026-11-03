package com.calishealth.dtos;

import com.calishealth.models.MemberProfile;
import com.calishealth.models.User;
import com.calishealth.validation.StrongPassword;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.util.List;

/** Payloads of the Profile Information screen, shared by MEMBER, CONTENT_MANAGER and ADMIN. */
public class ProfileDtos {

    /** Gender choices offered by the select. "Prefer not to say" is the fallback for legacy free text. */
    public static final List<String> GENDERS = List.of("Male", "Female", "Other", "Prefer not to say");

    /**
     * Everything the screen renders.
     * <p>
     * username/email/role/emailVerified are account facts and read-only on the page.
     * member holds the fitness summary and is null for CONTENT_MANAGER and ADMIN.
     * security backs the "Security &amp; sign-in" card; changing the password lives on
     * {@code POST /api/profile/password}.
     */
    public record ProfileResponse(
            Long id,
            String userCode,
            String fullName,
            String username,
            String email,
            String phone,
            String gender,
            LocalDate dateOfBirth,
            Integer age,
            String bio,
            String avatarUrl,
            String role,
            String roleLabel,
            boolean emailVerified,
            boolean active,
            LocalDateTime memberSince,
            SecurityInfo security,
            MemberSummary member,
            List<String> genderOptions,
            List<String> fitnessLevelOptions) {

        public static ProfileResponse of(User u, SecurityInfo security, MemberSummary member) {
            return of(u, security, member, age(u.getDateOfBirth()));
        }

        /** Same payload with an explicit age, used when the age comes from the onboarding survey. */
        public static ProfileResponse of(User u, SecurityInfo security, MemberSummary member, Integer age) {
            return new ProfileResponse(
                    u.getId(), userCode(u.getId()), u.getFullName(), username(u), u.getEmail(),
                    u.getPhone(), u.getGender(), u.getDateOfBirth(), age, u.getBio(),
                    u.getAvatarUrl(), u.getRole().name(), roleLabel(u),
                    u.isEnabled(), u.isActive(), u.getCreatedAt(), security, member, GENDERS, List.of());
        }

        /** USR-00042, the same display id the admin user table uses. */
        public static String userCode(Long id) {
            return String.format("USR-%05d", id);
        }

        /** The local part of the email; the mockup calls it "Username" and it cannot be edited. */
        static String username(User u) {
            String email = u.getEmail() == null ? "" : u.getEmail();
            int at = email.indexOf('@');
            return at > 0 ? email.substring(0, at) : email;
        }

        static Integer age(LocalDate dateOfBirth) {
            return dateOfBirth == null ? null : Period.between(dateOfBirth, LocalDate.now()).getYears();
        }

        /** Same calculation, callable from the service so a survey answer can take precedence. */
        public static Integer ageFrom(LocalDate dateOfBirth) {
            return age(dateOfBirth);
        }

        static String roleLabel(User u) {
            return switch (u.getRole()) {
                case ADMIN -> "Administrator";
                case CONTENT_MANAGER -> "Content Manager";
                default -> "Member";
            };
        }
    }

    /** "Security & sign-in" card: when the password changed and whether a temporary one is still in use. */
    public record SecurityInfo(
            LocalDateTime passwordChangedAt,
            boolean mustChangePassword,
            boolean temporaryPassword) {}

    /** Fitness summary of a MEMBER; null for the other roles. */
    public record MemberSummary(
            String levelName,
            Integer levelRank,
            String goal,
            java.math.BigDecimal heightCm,
            java.math.BigDecimal weightKg,
            int streakDays,
            int longestStreak) {

        /** Raw row values; levelRank is filled in by ProfileService from the ordered level ladder. */
        public static MemberSummary of(MemberProfile p) {
            if (p == null) return null;
            return new MemberSummary(
                    p.getFitnessLevel() == null ? null : p.getFitnessLevel().getName(),
                    null, p.getGoals(), p.getHeight(), p.getWeight(),
                    p.getStreakCount(), p.getLongestStreak());
        }
    }

    /**
     * Editable part of the screen. A null/absent text field means "leave unchanged"; the page always
     * sends the whole form, so clearing a value needs an empty string (which is stored as null).
     * A date cannot tell "unchanged" from "cleared" in JSON, hence the explicit clearDateOfBirth flag.
     */
    public record UpdateProfileRequest(
            @Size(max = 255, message = "Full name is too long") String fullName,

            // Vietnamese numbers: digits, spaces, dashes, dots, parentheses and the "+" prefix.
            @Pattern(regexp = "^$|^[+]?[0-9 ()\\-.]{6,30}$",
                    message = "Enter a valid phone number, e.g. 0912345678 or +84912345678")
            String phone,

            String gender,

            @Past(message = "Date of birth must be in the past")
            LocalDate dateOfBirth,

            boolean clearDateOfBirth,

            @Size(max = 500, message = "Bio must be 500 characters or fewer")
            String bio,

            String fitnessLevel) {}

    /**
     * Change password from the profile screen. Unlike the first-login endpoint in AuthDtos, the
     * current password is mandatory here: the account owner is already inside the app.
     */
    public record ChangeOwnPasswordRequest(
            @NotBlank(message = "Please enter your current password") String currentPassword,
            @NotBlank(message = "Please enter a new password") @StrongPassword String newPassword,
            @NotBlank(message = "Please confirm your new password") String confirmNewPassword) {

        @AssertTrue(message = "The confirmation password does not match")
        public boolean isNewPasswordConfirmed() {
            return newPassword != null && newPassword.equals(confirmNewPassword);
        }
    }
}
