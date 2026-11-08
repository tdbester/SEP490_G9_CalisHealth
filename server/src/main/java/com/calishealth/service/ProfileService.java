package com.calishealth.service;

import com.calishealth.dtos.ProfileDtos;
import com.calishealth.dtos.ProfileDtos.ChangeOwnPasswordRequest;
import com.calishealth.dtos.ProfileDtos.MemberSummary;
import com.calishealth.dtos.ProfileDtos.ProfileResponse;
import com.calishealth.dtos.ProfileDtos.SecurityInfo;
import com.calishealth.dtos.ProfileDtos.UpdateProfileRequest;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.MemberProfile;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.AssessmentAnswerRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.UserActivityRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.service.survey.SurveyJson;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

/**
 * Backs the Profile Information screen of every role.
 * <p>
 * The editable fields live on {@code users}. A MEMBER also has a {@code member_profiles} row that the
 * onboarding survey and the dashboard read, so when a member saves this screen the shared fields are
 * written to both places. Content Managers and Admins only have the user row.
 */
@Service
@RequiredArgsConstructor
public class ProfileService {
    private final UserRepository users;
    private final MemberProfileRepository memberProfiles;
    private final FitnessLevelRepository fitnessLevels;
    private final AssessmentAnswerRepository answers;
    private final ProfileAvatarStorageService avatars;
    private final MediaRegistryService registry;
    private final PasswordEncoder encoder;
    private final UserActivityRepository activity;

    private static final String AGE_QUESTION = "AGE";

    /** Same fallback {@code member_profiles.days_per_week} declares as its column default. */
    private static final int DEFAULT_DAYS_PER_WEEK = 3;

    private static ResponseStatusException err(HttpStatus status, String message) {
        return new ResponseStatusException(status, message);
    }

    private User require(String email) {
        return users.findByEmail(email.trim().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> err(HttpStatus.UNAUTHORIZED, "Not logged in"));
    }

    @Transactional(readOnly = true)
    public ProfileResponse get(String email) {
        return build(require(email));
    }

    @Transactional
    public ProfileResponse update(String email, UpdateProfileRequest r) {
        User u = require(email);

        if (r.fullName() != null) {
            String fullName = r.fullName().trim();
            if (fullName.isEmpty()) throw err(HttpStatus.BAD_REQUEST, "Please enter your full name");
            u.setFullName(fullName);
        }
        if (r.phone() != null) u.setPhone(blankToNull(r.phone()));
        if (r.gender() != null) u.setGender(normaliseGender(r.gender()));
        if (r.clearDateOfBirth()) u.setDateOfBirth(null);
        else if (r.dateOfBirth() != null) u.setDateOfBirth(validateDateOfBirth(r.dateOfBirth()));
        if (r.bio() != null) u.setBio(blankToNull(r.bio()));
        users.save(u);

        // A member's profile row feeds the survey, the dashboard and the streak, so keep it in step.
        if (u.getRole() == UserRole.MEMBER) syncMemberProfile(u, r);
        return build(u);
    }

    @Transactional
    public ProfileResponse updateAvatar(String email, MultipartFile file) {
        User u = require(email);
        String previous = u.getAvatarUrl();
        String url = avatars.store(file);
        u.setAvatarUrl(url);
        users.save(u);
        // The photo is written to the registry too, so it counts toward the storage of the system.
        registry.registerAvatar(url, file.getOriginalFilename(), avatars.sizeOf(url), u);
        // Only remove our own uploads; a legacy external URL is left alone.
        avatars.delete(previous);
        registry.purgeAvatar(previous);
        return build(u);
    }

    @Transactional
    public ProfileResponse removeAvatar(String email) {
        User u = require(email);
        avatars.delete(u.getAvatarUrl());
        registry.purgeAvatar(u.getAvatarUrl());
        u.setAvatarUrl(null);
        users.save(u);
        return build(u);
    }

    /**
     * Change password from the profile screen. Like the auth endpoint, replacing the password clears
     * the "must change on next sign-in" flag and stamps {@code password_changed_at}.
     */
    @Transactional
    public ProfileResponse changePassword(String email, ChangeOwnPasswordRequest r) {
        User u = require(email);
        if (!encoder.matches(r.currentPassword(), u.getPassword()))
            throw err(HttpStatus.BAD_REQUEST, "Your current password is incorrect");
        if (encoder.matches(r.newPassword(), u.getPassword()))
            throw err(HttpStatus.BAD_REQUEST, "The new password must be different from the current one");
        u.setPassword(encoder.encode(r.newPassword()));
        u.setMustChangePassword(false);
        u.setPasswordChangedAt(LocalDateTime.now());
        users.save(u);
        activity.logEvent(u.getId(), "ACCOUNT", "Password changed from the profile screen", "SUCCESS");
        return build(u);
    }

    // ---------------------------------------------------------------------------------
    // Assembly
    // ---------------------------------------------------------------------------------

    private ProfileResponse build(User u) {
        MemberProfile memberProfile = u.getRole() == UserRole.MEMBER
                ? memberProfiles.findByUser_Id(u.getId()).orElse(null)
                : null;
        ProfileResponse base = ProfileResponse.of(u, securityOf(u), memberSummary(u), surveyAge(u));
        // Hồ sơ member lưu giới tính đã chuẩn hoá; member chưa có hồ sơ (hoặc hồ sơ chưa có giới tính)
        // thì lấy từ users.
        String memberGender = memberProfile == null ? null : normaliseGender(memberProfile.getGender());
        String gender = memberGender != null ? memberGender : base.gender();
        List<String> levels = fitnessLevels.findAll(
                        Sort.by(Sort.Order.asc("scoreMin"), Sort.Order.asc("id")))
                .stream()
                .filter(level -> "ACTIVE".equalsIgnoreCase(level.getStatus()))
                .map(FitnessLevel::getName)
                .toList();
        return new ProfileResponse(
                base.id(), base.userCode(), base.fullName(), base.username(), base.email(), base.phone(),
                gender, base.dateOfBirth(), base.age(), base.bio(), base.avatarUrl(), base.role(),
                base.roleLabel(), base.emailVerified(), base.active(), base.memberSince(), base.security(),
                base.member(), base.genderOptions(), levels);
    }

    /**
     * The age the member typed in the onboarding survey (question {@value #AGE_QUESTION}). It is read as
     * answered, never derived from {@code date_of_birth}, because the survey only knows the age and the
     * profile screen must show the same number the member entered. Falls back to the date of birth only
     * when the survey was never completed (a staff account, or a member who skipped it).
     */
    private Integer surveyAge(User u) {
        for (String json : answers.findLatestAnswerValues(u.getId(), AGE_QUESTION)) {
            Integer age = asAge(json);
            if (age != null) return age;
        }
        return ProfileResponse.ageFrom(u.getDateOfBirth());
    }

    /** Answer JSON is a bare number for a NUMBER question; 1..120 keeps obviously broken data out. */
    private static Integer asAge(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            int age = SurveyJson.parse(json).asInt(-1);
            return age >= 1 && age <= 120 ? age : null;
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    /**
     * A staff account created by an admin starts on the shared temporary password and must replace it
     * on first sign-in, so the screen flags it as temporary until that happens.
     */
    private static SecurityInfo securityOf(User u) {
        boolean temporary = u.isMustChangePassword();
        return new SecurityInfo(u.getPasswordChangedAt(), temporary, temporary);
    }

    private MemberSummary memberSummary(User u) {
        if (u.getRole() != UserRole.MEMBER) return null;
        MemberProfile profile = memberProfiles.findByUser_Id(u.getId()).orElse(null);
        if (profile == null) {
            return new MemberSummary(null, null, null, null, null, 0, 0, DEFAULT_DAYS_PER_WEEK);
        }
        MemberSummary base = MemberSummary.of(profile);
        Integer rank = null;
        try {
            rank = levelRank(profile);
        } catch (Exception e) {
            // Fitness level may not exist or be properly configured
            rank = null;
        }
        return new MemberSummary(base.levelName(), rank, base.goal(), base.heightCm(),
                base.weightKg(), base.streakDays(), base.longestStreak(), base.daysPerWeek());
    }

    /** 1-based position of the member's level in the ordered ladder; null when it has no level yet. */
    private Integer levelRank(MemberProfile profile) {
        if (profile == null) return null;
        FitnessLevel level = profile.getFitnessLevel();
        if (level == null) return null;
        List<String> names = fitnessLevels
                .findAll(Sort.by(Sort.Order.asc("scoreMin"), Sort.Order.asc("id")))
                .stream()
                .map(FitnessLevel::getName)
                .toList();
        int index = names.indexOf(level.getName());
        return index < 0 ? null : index + 1;
    }

    private void syncMemberProfile(User u, UpdateProfileRequest r) {
        MemberProfile profile = memberProfiles.findByUser_Id(u.getId()).orElseGet(() -> {
            MemberProfile created = new MemberProfile();
            created.setUser(u);
            return created;
        });
        if (r.gender() != null) profile.setGender(u.getGender());
        if (r.clearDateOfBirth()) profile.setDateOfBirth(null);
        else if (r.dateOfBirth() != null) profile.setDateOfBirth(u.getDateOfBirth());
        if (r.bio() != null) profile.setBio(u.getBio());
        if (r.fitnessLevel() != null) {
            FitnessLevel level = fitnessLevels.findByNameIgnoreCase(r.fitnessLevel().trim())
                    .filter(item -> "ACTIVE".equalsIgnoreCase(item.getStatus()))
                    .orElseThrow(() -> err(HttpStatus.BAD_REQUEST, "Choose a valid active fitness level"));
            profile.setFitnessLevel(level);
        }
        // The onboarding answer is only the starting value; once saved here it wins.
        if (r.daysPerWeek() != null) profile.setDaysPerWeek(r.daysPerWeek());
        if (r.goal() != null && !r.goal().isBlank()) {
            profile.setGoals(r.goal().trim().toUpperCase(Locale.ROOT));
        }
        memberProfiles.save(profile);
    }

    // ---------------------------------------------------------------------------------
    // Validation
    // ---------------------------------------------------------------------------------

    private static String blankToNull(String value) {
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /**
     * Accepts only the offered options; legacy free text from the survey becomes "Prefer not to say".
     * Public because the onboarding survey writes the same column (see {@code SurveyProfileSync}).
     */
    public static String normaliseGender(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isEmpty()) return null;
        for (String option : ProfileDtos.GENDERS) {
            if (option.equalsIgnoreCase(value)) return option;
        }
        return "Prefer not to say";
    }

    private static LocalDate validateDateOfBirth(LocalDate dateOfBirth) {
        if (dateOfBirth.isAfter(LocalDate.now()))
            throw err(HttpStatus.BAD_REQUEST, "Date of birth must be in the past");
        if (dateOfBirth.isBefore(LocalDate.now().minusYears(120)))
            throw err(HttpStatus.BAD_REQUEST, "Please enter a valid date of birth");
        return dateOfBirth;
    }
}
