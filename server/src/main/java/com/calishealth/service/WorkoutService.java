package com.calishealth.service;

import com.calishealth.dtos.ExerciseDtos.CloneWorkoutRequest;
import com.calishealth.dtos.ExerciseDtos.CreateWorkoutRequest;
import com.calishealth.dtos.ExerciseDtos.QuickUpdateWorkoutRequest;
import com.calishealth.dtos.ExerciseDtos.WorkoutExerciseItemRequest;
import com.calishealth.dtos.ExerciseDtos.WorkoutExerciseResponse;
import com.calishealth.models.WorkoutExerciseItem;
import com.calishealth.dtos.ExerciseDtos.WorkoutPlanItemRequest;
import com.calishealth.dtos.ExerciseDtos.WorkoutPlanItemResponse;
import com.calishealth.dtos.ExerciseDtos.WorkoutResponse;
import com.calishealth.models.Exercise;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.WorkoutEntry;
import com.calishealth.models.WorkoutPlanItem;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.WorkoutRepository;
import com.calishealth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorkoutService {
    private final WorkoutRepository workouts;
    private final ExerciseRepository exercises;
    private final UserRepository users;
    private final FitnessLevelRepository fitnessLevels;
    private final ContentNameGuardService contentNameGuard;
    private static final String REGULAR_WORKOUT = "WORKOUT";
    private static final String DAILY_TRAINING_PLAN = "DAILY_TRAINING_PLAN";
    private static final Set<String> ALLOWED_TYPES = Set.of(REGULAR_WORKOUT, "HEALTH", "SKILL", "FLEX", DAILY_TRAINING_PLAN);
    private static final int DEFAULT_REST_SECONDS = 60;

    @Transactional(readOnly = true)
    public List<WorkoutResponse> findAll() {
        return workouts.findAll().stream()
                .sorted(Comparator.comparing(WorkoutEntry::getUpdatedAt).reversed())
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public WorkoutResponse findByCode(String code) {
        return workouts.findByCode(code)
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workout not found"));
    }

    @Transactional
    public WorkoutResponse updateStatus(String code, boolean active) {
        WorkoutEntry workout = workouts.findByCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workout not found"));
        if (active && !isLevelActive(workout.getLevel())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Level " + workout.getLevel() + " is inactive, so its workouts stay inactive. Activate the level first");
        }
        // `active` is only the published/draft switch; the row keeps template_status as the source of truth.
        workout.setTemplateStatus(active ? "PUBLISHED" : "DRAFT");
        return toResponse(workouts.saveAndFlush(workout));
    }

    @Transactional
    public void deleteByCode(String code) {
        WorkoutEntry workout = workouts.findByCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workout not found"));
        try {
            workouts.delete(workout);
            workouts.flush();
        } catch (org.springframework.dao.DataIntegrityViolationException exception) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This workout is referenced by other records and cannot be deleted",
                    exception
            );
        }
    }

    @Transactional
    public WorkoutResponse update(String code, CreateWorkoutRequest request) {
        WorkoutEntry workout = workouts.findByCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workout not found"));
        if (DAILY_TRAINING_PLAN.equals(workout.getType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only regular workouts can be edited here");
        }
        validateWorkoutRequest(request);
        // Đổi tên sang tên một bài tập đang dùng thì bị chặn (trùng tuyệt đối).
        // Giữ nguyên tên cũ thì vẫn sửa được — dữ liệu cũ đã có workout trùng tên
        // bài tập từ trước, không nên khoá người dùng khi chỉ muốn sửa nội dung.
        String requestedName = request.name().trim();
        boolean nameChanged = !requestedName.equalsIgnoreCase(workout.getName() == null ? "" : workout.getName().trim());
        if (nameChanged) {
            contentNameGuard.assertWorkoutNameNotUsedByExercise(requestedName, null);
        }
        List<WorkoutExerciseItemRequest> requestedItems = resolveItemRequests(request);
        Map<String, Exercise> exercisesByCode = loadSystemExercises(requestedItems);

        workout.setName(request.name().trim());
        workout.setDescription(request.description().trim());
        String requestedLevel = resolveLevelName(request.level());
        // Keeping the current level is always allowed; moving a workout to an inactive level is not.
        if (!requestedLevel.equalsIgnoreCase(workout.getLevel())) {
            resolveActiveLevelName(requestedLevel);
        }
        workout.setLevel(requestedLevel);
        workout.setType(resolveWorkoutType(request.type()));
        applyTemplateMetadata(workout, request);
        workout.getExercises().clear();
        workout.getExercises().addAll(buildExerciseItems(requestedItems, exercisesByCode));
        return toResponse(workout);
    }

    /** Clone Template: same level, schedule and exercise settings, saved as a DRAFT for the target month. */
    @Transactional
    public WorkoutResponse cloneTemplate(String code, CloneWorkoutRequest request, String creatorEmail) {
        WorkoutEntry source = workouts.findByCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workout not found"));
        if (DAILY_TRAINING_PLAN.equals(source.getType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only workout templates can be cloned");
        }
        int month = request == null || request.monthNumber() == null ? source.getMonthNumber() + 1 : request.monthNumber();
        if (month < 1 || month > 24) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Target month must be between 1 and 24");
        }
        String name = request != null && request.name() != null && !request.name().isBlank()
                ? request.name().trim()
                : cloneName(source.getName(), month);
        if (name.length() > 60) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Workout title must be at most 60 characters");
        }

        WorkoutEntry copy = new WorkoutEntry();
        copy.setCode(newCode());
        copy.setName(name);
        copy.setDescription(source.getDescription());
        copy.setType(source.getType());
        copy.setSource("SYSTEM");
        copy.setLevel(source.getLevel());
        copy.setMonthNumber(month);
        copy.setDaysPerWeek(source.getDaysPerWeek());
        copy.setDaySequence(source.getDaySequence());
        copy.setTemplateStatus("DRAFT");
        copy.setCreatedBy(users.findByEmail(creatorEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Creator account not found")));
        copy.setExercises(new java.util.ArrayList<>(source.getExercises().stream().map(item -> {
            WorkoutExerciseItem entry = new WorkoutExerciseItem();
            entry.setExercise(item.getExercise());
            entry.setSets(item.getSets());
            entry.setReps(item.getReps());
            entry.setDurationSeconds(item.getDurationSeconds());
            entry.setRestSeconds(item.getRestSeconds());
            return entry;
        }).toList()));
        return toResponse(workouts.save(copy));
    }

    /** Quick Update Sets/Reps: applies the same increase/decrease to every exercise, clamped to the valid ranges. */
    @Transactional
    public WorkoutResponse quickUpdate(String code, QuickUpdateWorkoutRequest request) {
        WorkoutEntry workout = workouts.findByCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workout not found"));
        if (DAILY_TRAINING_PLAN.equals(workout.getType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only workout templates can be quick updated");
        }
        int setsDelta = request == null || request.setsDelta() == null ? 0 : request.setsDelta();
        int repsDelta = request == null || request.repsDelta() == null ? 0 : request.repsDelta();
        int durationDelta = request == null || request.durationDelta() == null ? 0 : request.durationDelta();
        if (setsDelta == 0 && repsDelta == 0 && durationDelta == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter at least one change for sets, reps, or duration");
        }
        if (Math.abs(setsDelta) > 20 || Math.abs(repsDelta) > 100 || Math.abs(durationDelta) > 3600) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The change is outside the allowed range");
        }
        for (WorkoutExerciseItem item : workout.getExercises()) {
            item.setSets(clamp(item.getSets() + setsDelta, 1, 20));
            if (item.getReps() != null) item.setReps(clamp(item.getReps() + repsDelta, 1, 100));
            if (item.getDurationSeconds() != null) {
                item.setDurationSeconds(clamp(item.getDurationSeconds() + durationDelta, 1, 3600));
            }
        }
        workout.setUpdatedAt(java.time.LocalDateTime.now());
        return toResponse(workouts.saveAndFlush(workout));
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    /** "Full Body A - Month 1" -> "Full Body A - Month 2"; otherwise appends the target month. */
    private static String cloneName(String name, int month) {
        String base = name == null ? "Workout" : name.replaceFirst("(?i)\\s*-?\\s*month\\s*\\d+\\s*$", "").trim();
        String result = base + " - Month " + month;
        return result.length() > 60 ? result.substring(0, 60).trim() : result;
    }

    private static String newCode() {
        return "WO-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
    }

    @Transactional
    public WorkoutResponse create(CreateWorkoutRequest request, String creatorEmail) {
        validateWorkoutRequest(request);
        // Tên workout không được trùng tuyệt đối với tên của một bài tập nào.
        contentNameGuard.assertWorkoutNameNotUsedByExercise(request.name(), null);
        String type = resolveWorkoutType(request.type());
        List<WorkoutExerciseItemRequest> requestedItems = resolveItemRequests(request);
        Map<String, Exercise> exercisesByCode = loadSystemExercises(requestedItems);

        WorkoutEntry workout = new WorkoutEntry();
        workout.setCode("WO-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT));
        workout.setName(request.name().trim());
        workout.setDescription(request.description().trim());
        workout.setType(type);
        workout.setSource("SYSTEM");
        workout.setLevel(resolveActiveLevelName(request.level()));
        applyTemplateMetadata(workout, request);
        workout.setCreatedBy(users.findByEmail(creatorEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Creator account not found")));
        workout.setExercises(new java.util.ArrayList<>(buildExerciseItems(requestedItems, exercisesByCode)));
        return toResponse(workouts.save(workout));
    }

    /**
     * Danh sách bài cần lưu. Ưu tiên {@code items} (có cấu hình riêng); nếu không có thì dùng
     * {@code exerciseCodes} và để cấu hình rỗng, sẽ lấy mặc định của bài tập khi dựng item.
     */
    private List<WorkoutExerciseItemRequest> resolveItemRequests(CreateWorkoutRequest request) {
        if (request.items() != null && !request.items().isEmpty()) {
            return request.items();
        }
        return request.exerciseCodes().stream()
                .map(code -> new WorkoutExerciseItemRequest(code, null, null, null, null))
                .toList();
    }

    private Map<String, Exercise> loadSystemExercises(List<WorkoutExerciseItemRequest> items) {
        List<String> requestedCodes = items.stream().map(WorkoutExerciseItemRequest::exerciseCode).distinct().toList();
        Map<String, Exercise> exercisesByCode = exercises.findAllByCodeIn(requestedCodes).stream()
                .collect(Collectors.toMap(Exercise::getCode, exercise -> exercise));
        if (exercisesByCode.size() != requestedCodes.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "One or more selected exercises no longer exist");
        }
        if (exercisesByCode.values().stream().anyMatch(exercise -> !exercise.isActive())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Inactive exercises cannot be added to a workout");
        }
        assertSystemExercises(exercisesByCode.values());
        return exercisesByCode;
    }

    private List<WorkoutExerciseItem> buildExerciseItems(
            List<WorkoutExerciseItemRequest> requests,
            Map<String, Exercise> exercisesByCode
    ) {
        return requests.stream().map(item -> {
            Exercise exercise = exercisesByCode.get(item.exerciseCode());
            boolean hold = "HOLD".equalsIgnoreCase(exercise.getCategory());

            WorkoutExerciseItem entry = new WorkoutExerciseItem();
            entry.setExercise(exercise);
            entry.setSets(item.sets() != null ? item.sets()
                    : exercise.getDefaultSets() != null ? exercise.getDefaultSets() : 3);
            entry.setRestSeconds(item.restSeconds() != null ? item.restSeconds() : DEFAULT_REST_SECONDS);
            if (hold) {
                entry.setReps(null);
                entry.setDurationSeconds(item.durationSeconds() != null ? item.durationSeconds()
                        : exercise.getDuration() != null ? exercise.getDuration() : 30);
            } else {
                entry.setDurationSeconds(null);
                entry.setReps(item.reps() != null ? item.reps()
                        : exercise.getDefaultReps() != null ? exercise.getDefaultReps() : 10);
            }
            return entry;
        }).toList();
    }

    /** Chỉ kiểm tra các giá trị client gửi lên; giá trị mặc định lấy từ bài tập luôn nằm trong khoảng hợp lệ. */
    private void validateExerciseItems(List<WorkoutExerciseItemRequest> items) {
        for (WorkoutExerciseItemRequest item : items) {
            if (item == null || item.exerciseCode() == null || item.exerciseCode().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selected exercise codes must be valid");
            }
            if (item.sets() != null && (item.sets() < 1 || item.sets() > 20)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sets must be between 1 and 20");
            }
            if (item.reps() != null && (item.reps() < 1 || item.reps() > 100)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reps must be between 1 and 100");
            }
            if (item.durationSeconds() != null
                    && (item.durationSeconds() < 1 || item.durationSeconds() > 3600)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Duration must be between 1 and 3600 seconds");
            }
            if (item.restSeconds() != null && (item.restSeconds() < 0 || item.restSeconds() > 3600)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rest must be between 0 and 3600 seconds");
            }
        }
    }

    private void validateWorkoutRequest(CreateWorkoutRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Workout data is required");
        }
        int month = request.monthNumber() == null ? 1 : request.monthNumber();
        int days = request.daysPerWeek() == null ? 3 : request.daysPerWeek();
        int sequence = request.daySequence() == null ? 1 : request.daySequence();
        if (month < 1 || month > 24 || days < 1 || days > 7 || sequence < 1 || sequence > days) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Month, training days, and day sequence are invalid");
        }
        if (request.name() == null || request.name().isBlank() || request.name().length() > 60) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Workout title is required and must be at most 60 characters");
        }
        if (request.description() == null || request.description().isBlank() || request.description().length() > 300) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Workout description is required and must be at most 300 characters");
        }
        resolveLevelName(request.level());
        boolean hasItems = request.items() != null && !request.items().isEmpty();
        if (!hasItems && (request.exerciseCodes() == null || request.exerciseCodes().isEmpty())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Add at least one system exercise");
        }
        if (hasItems) {
            validateExerciseItems(request.items());
        } else if (request.exerciseCodes().stream().anyMatch(code -> code == null || code.isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selected exercise codes must be valid");
        }
    }

    /** Levels are managed by content (fitness_levels), so any level that exists there is valid. */
    /** Workouts are built from the system library only; user-submitted (CUSTOM) exercises are rejected. */
    private static void assertSystemExercises(java.util.Collection<Exercise> selected) {
        boolean hasCustom = selected.stream().anyMatch(exercise -> {
            String source = exercise.getSource();
            return source != null && !source.isBlank()
                    ? !"SYSTEM".equalsIgnoreCase(source.trim())
                    : exercise.getCreatedBy() != null;
        });
        if (hasCustom) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only system exercises can be added to a workout");
        }
    }

    private String resolveLevelName(String level) {
        if (level == null || level.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid workout level");
        }
        return fitnessLevels.findByNameIgnoreCase(level.trim())
                .map(FitnessLevel::getName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid workout level"));
    }

    /** Resolves the level and refuses it when it is inactive (workouts cannot be created at an inactive level). */
    private String resolveActiveLevelName(String level) {
        String name = resolveLevelName(level);
        if (!isLevelActive(name)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Level " + name + " is inactive. Choose an active level or activate it in Level & Benchmark Criteria");
        }
        return name;
    }

    /** A level that is not configured at all is not treated as inactive. */
    private boolean isLevelActive(String levelName) {
        if (levelName == null || levelName.isBlank()) return true;
        return fitnessLevels.findByNameIgnoreCase(levelName.trim())
                .map(level -> "ACTIVE".equalsIgnoreCase(level.getStatus()))
                .orElse(true);
    }

    private void validatePlanItems(List<WorkoutPlanItemRequest> planItems) {
        Set<String> dayExercisePairs = new java.util.HashSet<>();
        for (WorkoutPlanItemRequest item : planItems) {
            if (item == null || item.dayOfWeek() < 1 || item.dayOfWeek() > 7
                    || item.exerciseCode() == null || item.exerciseCode().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Plan entries need a day from 1 to 7 and an exercise");
            }
            if (!dayExercisePairs.add(item.dayOfWeek() + ":" + item.exerciseCode())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "An exercise can only appear once per day");
            }
            if (!validSetRep(item.beginnerSets(), item.beginnerReps())
                    || !validSetRep(item.intermediateSets(), item.intermediateReps())
                    || !validSetRep(item.advancedSets(), item.advancedReps())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Each level needs 1-20 sets and 1-100 reps");
            }
        }
    }

    private boolean validSetRep(int sets, int reps) {
        return sets >= 1 && sets <= 20 && reps >= 1 && reps <= 100;
    }

    private WorkoutPlanItem toPlanItem(
            WorkoutPlanItemRequest request,
            Map<String, Exercise> exercisesByCode,
            WorkoutEntry workout
    ) {
        WorkoutPlanItem item = new WorkoutPlanItem();
        item.setWorkout(workout);
        item.setExercise(exercisesByCode.get(request.exerciseCode()));
        item.setDayOfWeek(request.dayOfWeek());
        item.setBeginnerSets(request.beginnerSets());
        item.setBeginnerReps(request.beginnerReps());
        item.setIntermediateSets(request.intermediateSets());
        item.setIntermediateReps(request.intermediateReps());
        item.setAdvancedSets(request.advancedSets());
        item.setAdvancedReps(request.advancedReps());
        return item;
    }

    private void applyTemplateMetadata(WorkoutEntry workout, CreateWorkoutRequest request) {
        workout.setMonthNumber(request.monthNumber() == null ? 1 : request.monthNumber());
        workout.setDaysPerWeek(request.daysPerWeek() == null ? 3 : request.daysPerWeek());
        workout.setDaySequence(request.daySequence() == null ? 1 : request.daySequence());
        String status = request.templateStatus() == null || request.templateStatus().isBlank()
                ? "PUBLISHED" : request.templateStatus().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("DRAFT", "PUBLISHED", "ARCHIVED").contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Template status must be DRAFT, PUBLISHED, or ARCHIVED");
        }
        workout.setTemplateStatus(status);
    }

    private String resolveWorkoutType(String type) {
        String normalized = type == null || type.isBlank()
                ? REGULAR_WORKOUT
                : type.trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED_TYPES.contains(normalized) || DAILY_TRAINING_PLAN.equals(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Workout type must be HEALTH, SKILL, or FLEX");
        }
        return normalized;
    }

    private WorkoutResponse toResponse(WorkoutEntry workout) {
        List<WorkoutExerciseResponse> workoutExercises = workout.getExercises().stream()
                .map(this::toExerciseResponse)
                .toList();
        if ("DAILY_TRAINING_PLAN".equals(workout.getType())) {
            workoutExercises = workout.getPlanItems().stream()
                    .map(WorkoutPlanItem::getExercise)
                    .distinct()
                    .map(exercise -> toExerciseResponse(exercise, null))
                    .toList();
        }
        List<WorkoutPlanItemResponse> planItems = workout.getPlanItems().stream()
                .map(item -> new WorkoutPlanItemResponse(
                        item.getDayOfWeek(), item.getExercise().getCode(), item.getExercise().getName(),
                        muscleGroupLabel(item.getExercise()), item.getBeginnerSets(), item.getBeginnerReps(),
                        item.getIntermediateSets(), item.getIntermediateReps(), item.getAdvancedSets(), item.getAdvancedReps()
                )).toList();
        return new WorkoutResponse(workout.getCode(), workout.getName(), workout.getDescription(),
                workout.getType() == null ? REGULAR_WORKOUT : workout.getType(),
                workout.getLevel(), workout.getMonthNumber(), workout.getDaysPerWeek(), workout.getDaySequence(),
                workout.getTemplateStatus(), workout.isActive() && isLevelActive(workout.getLevel()),
                workout.getUpdatedAt(), workout.getSource(),
                workout.getCreatedBy() == null ? null : workout.getCreatedBy().getFullName(),
                workoutExercises, planItems);
    }

    private WorkoutExerciseResponse toExerciseResponse(WorkoutExerciseItem item) {
        return toExerciseResponse(item.getExercise(), item);
    }

    /** {@code item} null = bài trong lịch tập 7 ngày, chưa có cấu hình riêng nên các field cấu hình để null. */
    private WorkoutExerciseResponse toExerciseResponse(Exercise exercise, WorkoutExerciseItem item) {
        boolean hold = "HOLD".equalsIgnoreCase(exercise.getCategory());
        return new WorkoutExerciseResponse(
                exercise.getCode(), exercise.getName(), exercise.getDifficultyLevel(), muscleGroupLabel(exercise),
                exercise.getCategory(), exercise.getDefaultSets(), exercise.getDefaultReps(), exercise.getDuration(),
                item == null ? null : (hold ? "DURATION" : "REPS"),
                item == null ? null : item.getSets(),
                item == null ? null : item.getReps(),
                item == null ? null : item.getDurationSeconds(),
                item == null ? null : item.getRestSeconds()
        );
    }

    /** Ghép tên các muscle group của bài thành nhãn "Chest · Arms"; không có dữ liệu thì trả null (để trống). */
    private String muscleGroupLabel(Exercise exercise) {
        String joined = exercise.getMuscleGroups().stream()
                .map(link -> link.getMuscleGroup().getName())
                .filter(name -> name != null && !name.isBlank())
                .distinct()
                .reduce((first, second) -> first + " · " + second)
                .orElse(null);
        return joined;
    }
}
