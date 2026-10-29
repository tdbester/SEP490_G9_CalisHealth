package com.calishealth.service;

import com.calishealth.dtos.ExerciseDtos.CreateExerciseRequest;
import com.calishealth.dtos.ExerciseDtos.ExerciseResponse;
import com.calishealth.dtos.ExerciseDtos.ExerciseModerationHistoryResponse;
import com.calishealth.models.Exercise;
import com.calishealth.models.ExerciseMuscleGroup;
import com.calishealth.models.ExerciseMuscleGroupId;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.MuscleGroup;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.ExerciseModerationHistoryRepository;
import com.calishealth.repository.MuscleGroupRepository;
import com.calishealth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Thư viện exercise/skill. Bảng canonical là `exercises` (ERD) — mọi module
 * workout, tiến trình, form rule đều FK tới nó, nên khu Content Manager đọc và
 * ghi trực tiếp trên bảng này thay vì một bảng projection riêng.
 */
@Service
@RequiredArgsConstructor
public class ExerciseService {
    /** Bài do người dùng tạo/nằm trong workout cộng đồng -> hiện ở bộ lọc Custom. */
    public static final String SOURCE_CUSTOM = "CUSTOM";
    public static final String SOURCE_SYSTEM = "SYSTEM";

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_INACTIVE = "INACTIVE";
    private static final String STATUS_DELETED = "DELETED";
    private static final String STATUS_REJECTED = "REJECTED";

    private final ExerciseRepository exercises;
    private final ExerciseModerationHistoryRepository moderationHistory;
    private final MuscleGroupRepository muscleGroups;
    private final UserRepository users;
    private final JdbcTemplate jdbcTemplate;
    private final ExerciseVideoStorageService videoStorage;
    private final FitnessLevelRepository fitnessLevels;

    /** Levels are managed by content (fitness_levels), so any level that exists there is valid. */
    private String resolveLevelName(String level) {
        if (level == null || level.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid exercise level");
        }
        return fitnessLevels.findByNameIgnoreCase(level.trim())
                .map(FitnessLevel::getName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid exercise level"));
    }

    /** Resolves the level and refuses it when it is inactive (exercises cannot be created at an inactive level). */
    private String resolveActiveLevelName(String level) {
        String name = resolveLevelName(level);
        if (!isLevelActive(name, levelActivity())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Level " + name + " is inactive. Choose an active level or activate it in Level & Benchmark Criteria");
        }
        return name;
    }

    /** Lower-cased level name -> is the level active. */
    private Map<String, Boolean> levelActivity() {
        Map<String, Boolean> activity = new HashMap<>();
        for (FitnessLevel level : fitnessLevels.findAll()) {
            activity.put(level.getName().toLowerCase(Locale.ROOT), "ACTIVE".equalsIgnoreCase(level.getStatus()));
        }
        return activity;
    }

    /** A level that is not configured at all is not treated as inactive. */
    private static boolean isLevelActive(String levelName, Map<String, Boolean> activity) {
        return levelName == null || activity.getOrDefault(levelName.trim().toLowerCase(Locale.ROOT), true);
    }

    @Transactional(readOnly = true)
    public List<ExerciseResponse> findAll() {
        Map<String, Boolean> activity = levelActivity();
        return exercises.findAll().stream()
                .filter(exercise -> !STATUS_DELETED.equalsIgnoreCase(exercise.getModerationStatus()))
                .sorted((first, second) -> second.getUpdatedAt().compareTo(first.getUpdatedAt()))
                .map(exercise -> toResponse(exercise, activity))
                .toList();
    }

    @Transactional(readOnly = true)
    public ExerciseResponse findByCode(String code) {
        return exercises.findByCode(code)
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Exercise or skill not found"));
    }

    private static String responseSource(Exercise exercise) {
        if (exercise.getSource() != null && !exercise.getSource().isBlank()) {
            return exercise.getSource().trim().toUpperCase(Locale.ROOT);
        }
        return exercise.getCreatedBy() == null ? SOURCE_SYSTEM : SOURCE_CUSTOM;
    }

    private void validateExerciseValue(CreateExerciseRequest request) {
        if (!"REPS".equals(request.category()) && !"HOLD".equals(request.category())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a repetition-count or hold exercise category");
        }
        Integer value = "REPS".equals(request.category()) ? request.defaultReps() : request.duration();
        if (request.defaultSets() == null || request.defaultSets() < 1 || request.defaultSets() > 20) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Default sets must be between 1 and 20");
        }
        if (value == null || value < 1 || value > 3600) {
            String field = "REPS".equals(request.category()) ? "Number of reps" : "Hold duration";
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " must be between 1 and 3600");
        }
        if ("REPS".equals(request.category()) && request.duration() != null
                || "HOLD".equals(request.category()) && request.defaultReps() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Provide a value only for the selected exercise category");
        }
    }

    @Transactional
    public ExerciseResponse create(
            CreateExerciseRequest request,
            String demoVideoUrl,
            String anatomyImageUrl,
            String createdByEmail
    ) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Exercise data is required");
        }
        if (request.name() == null || request.name().isBlank() || request.name().length() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Exercise title is required and must be at most 120 characters");
        }
        if (request.muscleGroup() == null || request.muscleGroup().isBlank() || request.muscleGroup().length() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select one or more muscle groups");
        }
        resolveActiveLevelName(request.level());
        if (!Set.of("REPS", "HOLD").contains(request.category())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a repetition-count or hold exercise category");
        }
        validateExerciseValue(request);

        String type;
        if (request.type() == null || request.type().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Type must be Health or Skill");
        }
        String requestedType = request.type().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("HEALTH", "SKILL").contains(requestedType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Type must be Health or Skill");
        }
        type = requestedType;

        Exercise exercise = new Exercise();
        exercise.setCode(newCode(requestedType));
        exercise.setName(request.name().trim());
        exercise.setType(type);
        exercise.setCategory(request.category());
        exercise.setDefaultSets(request.defaultSets());
        exercise.setDefaultReps(request.defaultReps());
        exercise.setDuration(request.duration());
        exercise.setDifficultyLevel(resolveActiveLevelName(request.level()));
        exercise.setInstructions(request.description());
        exercise.setExecutionSteps(request.guide());
        exercise.setVideoUrl(demoVideoUrl);
        exercise.setAnatomyImageUrl(anatomyImageUrl);
        exercise.setSource(SOURCE_SYSTEM);
        exercise.setModerationStatus(STATUS_ACTIVE);
        exercise.setActive(true);
        exercise.setCreatedBy(users.findByEmail(createdByEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "The signed-in user no longer exists")));
        Exercise saved = exercises.save(exercise);

        // Phải persist exercise trước: ExerciseMuscleGroup dùng @MapsId nên khoá
        // chính ghép (exercise_id, muscle_group_id) lấy từ id vừa sinh.
        for (String muscleName : request.muscleGroup().split("\\s*·\\s*")) {
            String displayName = muscleName.trim();
            if (displayName.isEmpty()) {
                continue;
            }
            MuscleGroup muscleGroup = resolveMuscleGroup(displayName);
            ExerciseMuscleGroup link = new ExerciseMuscleGroup();
            link.setId(new ExerciseMuscleGroupId());
            link.setExercise(saved);
            link.setMuscleGroup(muscleGroup);
            saved.getMuscleGroups().add(link);
        }

        return toResponse(exercises.save(saved));
    }

    @Transactional
    public ExerciseResponse updateSystemExercise(
            String code,
            CreateExerciseRequest request,
            String demoVideoUrl,
            String anatomyImageUrl
    ) {
        Exercise exercise = exercises.findByCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Exercise or skill not found"));
        if (!SOURCE_SYSTEM.equalsIgnoreCase(exercise.getSource())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only system exercises can be edited here");
        }
        if (request == null || request.name() == null || request.name().isBlank() || request.name().length() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Exercise title is required and must be at most 120 characters");
        }
        if (request.muscleGroup() == null || request.muscleGroup().isBlank() || request.muscleGroup().length() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select one or more muscle groups");
        }
        // Keeping the current level is always allowed; moving an exercise to an inactive level is not.
        String requestedLevel = resolveLevelName(request.level());
        if (!requestedLevel.equalsIgnoreCase(exercise.getDifficultyLevel())) {
            resolveActiveLevelName(requestedLevel);
        }
        String type = request.type() == null ? "" : request.type().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("HEALTH", "SKILL").contains(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Type must be Health or Skill");
        }
        if (!Set.of("REPS", "HOLD").contains(request.category())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a repetition-count or hold exercise category");
        }
        validateExerciseValue(request);

        String previousVideoUrl = exercise.getVideoUrl();
        String previousAnatomyImageUrl = exercise.getAnatomyImageUrl();
        exercise.setName(request.name().trim());
        exercise.setType(type);
        exercise.setCategory(request.category());
        exercise.setDefaultSets(request.defaultSets());
        exercise.setDefaultReps(request.defaultReps());
        exercise.setDuration(request.duration());
        exercise.setDifficultyLevel(requestedLevel);
        exercise.setInstructions(request.description());
        exercise.setExecutionSteps(request.guide());
        if (demoVideoUrl != null) exercise.setVideoUrl(demoVideoUrl);
        if (anatomyImageUrl != null) exercise.setAnatomyImageUrl(anatomyImageUrl);
        List<String> requestedMuscles = java.util.Arrays.stream(request.muscleGroup().split("\\s*·\\s*"))
                .map(String::trim)
                .filter(name -> !name.isEmpty())
                .distinct()
                .toList();
        List<MuscleGroup> resolvedMuscles = requestedMuscles.stream()
                .map(this::resolveMuscleGroup)
                .toList();
        exercise.getMuscleGroups().clear();
        exercises.saveAndFlush(exercise);
        for (MuscleGroup muscleGroup : resolvedMuscles) {
            ExerciseMuscleGroup link = new ExerciseMuscleGroup();
            link.setId(new ExerciseMuscleGroupId());
            link.setExercise(exercise);
            link.setMuscleGroup(muscleGroup);
            exercise.getMuscleGroups().add(link);
        }
        Exercise saved = exercises.save(exercise);
        if (demoVideoUrl != null) videoStorage.delete(previousVideoUrl);
        if (anatomyImageUrl != null) videoStorage.deleteAnatomyImage(previousAnatomyImageUrl);
        return toResponse(saved);
    }

    @Transactional
    public void deleteByCode(String code) {
        Exercise exercise = exercises.findByCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Exercise or skill not found"));
        String videoUrl = exercise.getVideoUrl();
        String anatomyImageUrl = exercise.getAnatomyImageUrl();
        try {
            exercises.delete(exercise);
            exercises.flush();
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This exercise is still referenced by workout or member history and cannot be permanently deleted."
            );
        }
        videoStorage.delete(videoUrl);
        videoStorage.deleteAnatomyImage(anatomyImageUrl);
    }

    @Transactional
    public ExerciseResponse updateStatus(String code, boolean active, String rejectionReason) {
        if (!active && (rejectionReason == null || rejectionReason.isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A rejection reason is required");
        }
        Exercise exercise = exercises.findByCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Exercise or skill not found"));
        if (active && !isLevelActive(exercise.getDifficultyLevel(), levelActivity())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Level " + exercise.getDifficultyLevel() + " is inactive, so its exercises stay inactive. Activate the level first");
        }
        exercise.setActive(active);
        exercise.setModerationStatus(active
                ? STATUS_ACTIVE
                : (SOURCE_CUSTOM.equalsIgnoreCase(exercise.getSource()) ? STATUS_REJECTED : STATUS_INACTIVE));
        ExerciseResponse response = toResponse(exercises.saveAndFlush(exercise));
        if (SOURCE_CUSTOM.equalsIgnoreCase(exercise.getSource())) {
            moderationHistory.insert(exercise.getCode(), exercise.getName(), exercise.getType(),
                    muscleGroupLabel(exercise), exercise.getDifficultyLevel(), exercise.getInstructions(),
                    exercise.getCategory(), exercise.getExecutionSteps(), exercise.getVideoUrl(),
                    exercise.getAnatomyImageUrl(),
                    exercise.getCreatedBy() == null ? null : exercise.getCreatedBy().getFullName(),
                    active ? "APPROVED" : "REJECTED", active ? null : rejectionReason.trim());
        }
        return response;
    }

    /**
     * Lấy muscle group theo tên (không phân biệt hoa/thường), tạo mới nếu chưa có.
     * Flush sau khi save để lần lặp sau trong cùng request luôn thấy row vừa tạo.
     */
    private MuscleGroup resolveMuscleGroup(String displayName) {
        return muscleGroups.findByNameIgnoreCase(displayName)
                .orElseGet(() -> muscleGroups.saveAndFlush(newMuscleGroup(displayName)));
    }

    /**
     * V4 tạo muscle_groups với dashboard_code / icon_key / tone NOT NULL, nhưng
     * màn hình Content Manager cho phép chọn group mới. Sinh các cột dashboard
     * từ tên để INSERT không vướng ràng buộc NOT NULL.
     */
    private MuscleGroup newMuscleGroup(String displayName) {
        String dashboardCode = displayName.toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
        if (dashboardCode.isBlank()) {
            dashboardCode = "GROUP_" + UUID.randomUUID().toString().substring(0, 6).toUpperCase(Locale.ROOT);
        }
        MuscleGroup createdGroup = new MuscleGroup();
        createdGroup.setName(displayName);
        createdGroup.setDashboardCode(dashboardCode);
        createdGroup.setIconKey(dashboardCode.toLowerCase(Locale.ROOT));
        createdGroup.setTone(defaultToneFor(displayName));
        return createdGroup;
    }

    private static String defaultToneFor(String displayName) {
        Set<String> strong = Set.of("CHEST", "BACK", "ARMS", "SHOULDERS", "LEGS", "GLUTES");
        Set<String> core = Set.of("CORE", "ABS");
        String key = displayName.toUpperCase(Locale.ROOT);
        if (core.contains(key)) {
            return "amber";
        }
        return strong.contains(key) ? "violet" : "slate";
    }

    /** Mã hiển thị duy nhất, giữ ổn định vì được dùng trên URL của Content Manager. */
    private String newCode(String type) {
        String prefix = "SKILL".equals(type) ? "SK" : "HE";
        for (int attempt = 0; attempt < 5; attempt++) {
            String candidate = prefix + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
            if (!exercises.existsByCode(candidate)) {
                return candidate;
            }
        }
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not allocate an exercise code");
    }

    @Transactional(readOnly = true)
    public List<ExerciseModerationHistoryResponse> findApprovalHistory() {
        return moderationHistory.findAll();
    }

    @Transactional(readOnly = true)
    public List<ExerciseResponse> findPendingModeration() {
        Map<String, Boolean> activity = levelActivity();
        return exercises.findAll().stream()
                .filter(exercise -> SOURCE_CUSTOM.equalsIgnoreCase(exercise.getSource())
                        && !exercise.isActive()
                        && !STATUS_REJECTED.equalsIgnoreCase(exercise.getModerationStatus()))
                .sorted((first, second) -> second.getUpdatedAt().compareTo(first.getUpdatedAt()))
                .map(exercise -> toResponse(exercise, activity))
                .toList();
    }

    private String autoCheckStatus(Exercise exercise) {
        boolean complete = exercise.getName() != null && !exercise.getName().isBlank()
                && exercise.getType() != null && !exercise.getType().isBlank()
                && exercise.getDifficultyLevel() != null && !exercise.getDifficultyLevel().isBlank()
                && exercise.getExecutionSteps() != null && !exercise.getExecutionSteps().isBlank();
        return complete ? "PASSED" : "NEEDS_REVIEW";
    }

    private String muscleGroupLabel(Exercise exercise) {
        String joined = exercise.getMuscleGroups().stream()
                .map(link -> link.getMuscleGroup().getName())
                .filter(name -> name != null && !name.isBlank())
                .distinct()
                .reduce((first, second) -> first + " · " + second)
                .orElse(null);
        if (joined != null) {
            return joined;
        }
        return exercise.getCategory();
    }

    private ExerciseResponse toResponse(Exercise exercise) {
        return toResponse(exercise, levelActivity());
    }

    /** {@code active} is the effective status: the exercise is active AND its level is active. */
    private ExerciseResponse toResponse(Exercise exercise, Map<String, Boolean> activity) {
        boolean levelActive = isLevelActive(exercise.getDifficultyLevel(), activity);
        String type = "SKILL".equalsIgnoreCase(exercise.getType()) ? "Skill" : "Health";
        String source = responseSource(exercise);
        return new ExerciseResponse(
                exercise.getCode(),
                exercise.getName(),
                type,
                exercise.getInstructions(),
                exercise.getCategory(),
                muscleGroupLabel(exercise),
                exercise.getDifficultyLevel(),
                exercise.getExecutionSteps(),
                exercise.getVideoUrl(),
                exercise.getAnatomyImageUrl(),
                source,
                exercise.getCreatedBy() == null ? null : exercise.getCreatedBy().getFullName(),
                exercise.getDefaultReps(),
                exercise.getDuration(),
                exercise.isActive() && levelActive,
                exercise.getUpdatedAt(),
                exercise.getUpdatedAt(),
                autoCheckStatus(exercise),
                exercise.getDefaultSets(),
                exercise.isActive(),
                levelActive
        );
    }
}
