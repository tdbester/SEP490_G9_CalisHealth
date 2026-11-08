package com.calishealth.service;

import com.calishealth.dtos.ExerciseDtos.CreateExerciseRequest;
import com.calishealth.dtos.ExerciseDtos.ExerciseResponse;
import com.calishealth.dtos.ExerciseDtos.ExerciseModerationHistoryResponse;
import com.calishealth.dtos.ExerciseFilterRequestDTO;
import com.calishealth.dtos.ExerciseItemResponseDTO;
import com.calishealth.dtos.PageResponseDTO;
import com.calishealth.dtos.SystemExerciseDetailResponseDTO;
import com.calishealth.models.Exercise;
import com.calishealth.models.ExerciseTreeEdge;
import com.calishealth.models.FitnessLevel;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.ExerciseModerationHistoryRepository;
import com.calishealth.repository.ExerciseTreeEdgeRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.specification.ExerciseSpecification;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

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
    private final UserRepository users;
    private final JdbcTemplate jdbcTemplate;
    private final MediaRegistryService mediaRegistry;
    private final ExerciseTreeEdgeRepository treeEdges;
    private final FitnessLevelRepository fitnessLevels;
    private final ExerciseMuscleGroupCatalog muscleGroupCatalog;
    private final SystemNotificationService systemNotifications;

    @Transactional(readOnly = true)
    public PageResponseDTO<ExerciseItemResponseDTO> getSystemExercises(ExerciseFilterRequestDTO filter) {
        if (filter == null || filter.getType() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Exercise type is required");
        }
        Page<Exercise> result = exercises.findAll(
                ExerciseSpecification.withFilters(filter),
                PageRequest.of(filter.getPage(), filter.getSize()));
        List<ExerciseItemResponseDTO> content = result.getContent().stream()
                .map(exercise -> new ExerciseItemResponseDTO(
                        exercise.getId(),
                        exercise.getName(),
                        ExerciseFilterRequestDTO.ExerciseType.valueOf(exercise.getType().toUpperCase(Locale.ROOT)),
                        exercise.getLevel(),
                        exercise.getMuscleGroup(),
                        exercise.getDefaultSets(),
                        exercise.getDefaultReps(),
                        exercise.getDefaultDuration(),
                        exercise.getEquipment(),
                        exercise.getGoal() == null ? null
                                : ExerciseFilterRequestDTO.ExerciseGoal.valueOf(exercise.getGoal().name()),
                        exercise.getTargetSkill() == null ? null
                                : ExerciseFilterRequestDTO.TargetSkill.valueOf(exercise.getTargetSkill().name()),
                        exercise.getIcon()))
                .toList();
        return new PageResponseDTO<>(
                content,
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.hasNext(),
                result.hasPrevious());
    }

    @Transactional(readOnly = true)
    public SystemExerciseDetailResponseDTO getSystemExerciseDetail(Long exerciseId) {
        Exercise exercise = exercises.findAcceptedByIdAndSource(exerciseId, "SYSTEM")
                .filter(Exercise::isActive)
                .orElseThrow(() -> new com.calishealth.exception.ResourceNotFoundException("System exercise not found"));

        String guide = exercise.getGuideSteps();
        if (guide == null || guide.isBlank()) {
            guide = exercise.getGuide();
        }
        if (guide == null || guide.isBlank()) {
            guide = exercise.getExecutionSteps();
        }
        List<String> steps = guide == null || guide.isBlank()
                ? List.of()
                : guide.lines().map(String::trim).filter(line -> !line.isBlank()).toList();
        if (steps.size() == 1) {
            steps = List.of(
                    "Set up for " + exercise.getName() + " with " + nullToDefault(exercise.getMuscleGroup(), "the target muscles") + " engaged.",
                    "Brace your core and keep the " + nullToDefault(exercise.getMuscleGroup(), "target muscles")
                            + " engaged while moving through a controlled range of motion.",
                    steps.get(0),
                    "Return to the starting position with control and repeat.");
        }

        List<ExerciseTreeEdge> connected = exercise.getId() == null
                ? List.of()
                : treeEdges.findAllConnectedTo(Set.of(exercise.getId()));
        List<Long> relatedIds = connected.stream()
                .flatMap(edge -> java.util.stream.Stream.of(edge.getParentExerciseId(), edge.getChildExerciseId()))
                .filter(id -> !id.equals(exercise.getId()))
                .distinct()
                .toList();
        var relatedNames = exercises.findAllById(relatedIds).stream()
                .collect(Collectors.toMap(Exercise::getId, Exercise::getName));
        List<String> previous = connected.stream()
                .filter(edge -> exercise.getId().equals(edge.getChildExerciseId()))
                .map(ExerciseTreeEdge::getParentExerciseId)
                .map(relatedNames::get)
                .filter(java.util.Objects::nonNull)
                .toList();
        List<String> next = connected.stream()
                .filter(edge -> exercise.getId().equals(edge.getParentExerciseId()))
                .map(ExerciseTreeEdge::getChildExerciseId)
                .map(relatedNames::get)
                .filter(java.util.Objects::nonNull)
                .toList();
        boolean hasTree = exercise.getExerciseTreeId() != null || !connected.isEmpty();

        return new SystemExerciseDetailResponseDTO(
                exercise.getId(),
                exercise.getCode(),
                exercise.getName(),
                exercise.getDescription() == null ? exercise.getInstructions() : exercise.getDescription(),
                exercise.getVideoUrl(),
                exercise.getAnatomyImageUrl(),
                steps,
                exercise.getMuscleGroup(),
                label(exercise.getLevel()),
                exercise.getDefaultSets(),
                exercise.getDefaultReps(),
                exercise.getDefaultDuration(),
                "HOLD".equalsIgnoreCase(exercise.getCategory()) ? "HOLD" : "REPS",
                exercise.getEquipment(),
                exercise.getType(),
                exercise.getGoal() == null ? null : exercise.getGoal().name(),
                exercise.getTargetSkill() == null ? null : exercise.getTargetSkill().name(),
                exercise.getExerciseTreeId(),
                hasTree,
                exercise.getMovementGroup() == null ? null : exercise.getMovementGroup().name(),
                previous,
                next);
    }

    private static String label(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.toLowerCase(Locale.ROOT);
        return Character.toUpperCase(normalized.charAt(0)) + normalized.substring(1);
    }

    private static String nullToDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

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
        if (request.guide() == null || request.guide().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Execution steps are required");
        }
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
        exercise.setCode(temporaryExerciseCode());
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

        saved.setCode(systemExerciseCode(saved.getId()));
        muscleGroupCatalog.assign(saved, request.muscleGroup());
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
        muscleGroupCatalog.assign(exercise, request.muscleGroup());
        Exercise saved = exercises.save(exercise);
        if (demoVideoUrl != null && !demoVideoUrl.equals(previousVideoUrl)) mediaRegistry.release(previousVideoUrl, "Replaced by a newer video");
        if (anatomyImageUrl != null && !anatomyImageUrl.equals(previousAnatomyImageUrl)) mediaRegistry.release(previousAnatomyImageUrl, "Replaced by a newer image");
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
        mediaRegistry.release(videoUrl, "Exercise was deleted");
        mediaRegistry.release(anatomyImageUrl, "Exercise was deleted");
    }

    @Transactional
    public ExerciseResponse updateStatus(String code, boolean active, String rejectionReason) {
        if (!active && (rejectionReason == null || rejectionReason.isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A rejection reason is required");
        }
        Exercise exercise = exercises.findByCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Exercise or skill not found"));
        String previousStatus = exercise.getStatus();
        if (active && !isLevelActive(exercise.getDifficultyLevel(), levelActivity())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Level " + exercise.getDifficultyLevel() + " is inactive, so its exercises stay inactive. Activate the level first");
        }
        exercise.setActive(active);
        if (SOURCE_CUSTOM.equalsIgnoreCase(exercise.getSource())) {
            exercise.setStatus(active ? Exercise.EntryStatus.ACCEPTED : Exercise.EntryStatus.REJECTED);
        } else {
            exercise.setModerationStatus(active ? STATUS_ACTIVE : STATUS_INACTIVE);
        }
        ExerciseResponse response = toResponse(exercises.saveAndFlush(exercise));
        if (SOURCE_CUSTOM.equalsIgnoreCase(exercise.getSource())) {
            moderationHistory.insert(exercise.getCode(), exercise.getName(), exercise.getType(),
                    muscleGroupLabel(exercise), exercise.getDifficultyLevel(), exercise.getInstructions(),
                    exercise.getCategory(), exercise.getExecutionSteps(), exercise.getVideoUrl(),
                    exercise.getAnatomyImageUrl(),
                    exercise.getCreatedBy() == null ? null : exercise.getCreatedBy().getFullName(),
                    active ? "APPROVED" : "REJECTED", active ? null : rejectionReason.trim());
            // Rejected media is kept for the retention period so the member can read the reason and resubmit.
            List<String> mediaUrls = java.util.Arrays.asList(exercise.getVideoUrl(), exercise.getAnatomyImageUrl());
            if (active) {
                mediaRegistry.markActive(mediaUrls);
            } else {
                mediaRegistry.markRejected(mediaUrls, rejectionReason.trim());
            }
            if ("PENDING".equalsIgnoreCase(previousStatus)) {
                systemNotifications.notifyExerciseModeration(
                        exercise.getAuthorId(),
                        exercise.getName(),
                        active,
                        active ? null : rejectionReason.trim()
                );
            }
        }
        return response;
    }

    private static String systemExerciseCode(Long id) {
        return "EX_" + id;
    }

    private static String temporaryExerciseCode() {
        return "TMP-" + java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 24);
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
                        && Exercise.EntryStatus.PENDING.name().equalsIgnoreCase(exercise.getStatus())
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
        // Không có dữ liệu muscle thì để trống, không lấy category thay thế.
        return joined;
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
                exercise.getMovementGroup() == null ? null : exercise.getMovementGroup().name(),
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
