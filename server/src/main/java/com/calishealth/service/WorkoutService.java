package com.calishealth.service;

import com.calishealth.dtos.ExerciseDtos.CreateWorkoutRequest;
import com.calishealth.dtos.ExerciseDtos.WorkoutExerciseResponse;
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
    private static final String REGULAR_WORKOUT = "WORKOUT";
    private static final String DAILY_TRAINING_PLAN = "DAILY_TRAINING_PLAN";
    private static final Set<String> ALLOWED_TYPES = Set.of(REGULAR_WORKOUT, DAILY_TRAINING_PLAN);

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
        workout.setActive(active);
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
        if (!REGULAR_WORKOUT.equals(workout.getType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only regular workouts can be edited here");
        }
        validateWorkoutRequest(request);
        List<String> requestedCodes = request.exerciseCodes().stream().distinct().toList();
        Map<String, Exercise> exercisesByCode = exercises.findAllByCodeIn(requestedCodes).stream()
                .collect(Collectors.toMap(Exercise::getCode, exercise -> exercise));
        if (exercisesByCode.size() != requestedCodes.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "One or more selected exercises no longer exist");
        }
        if (exercisesByCode.values().stream().anyMatch(exercise -> !exercise.isActive())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Inactive exercises cannot be added to a workout");
        }
        assertSystemExercises(exercisesByCode.values());

        workout.setName(request.name().trim());
        workout.setDescription(request.description().trim());
        workout.setRestSeconds(request.restSeconds());
        String requestedLevel = resolveLevelName(request.level());
        // Keeping the current level is always allowed; moving a workout to an inactive level is not.
        if (!requestedLevel.equalsIgnoreCase(workout.getLevel())) {
            resolveActiveLevelName(requestedLevel);
        }
        workout.setLevel(requestedLevel);
        workout.getExercises().clear();
        workout.getExercises().addAll(request.exerciseCodes().stream().map(exercisesByCode::get).toList());
        return toResponse(workout);
    }

    @Transactional
    public WorkoutResponse create(CreateWorkoutRequest request, String creatorEmail) {
        validateWorkoutRequest(request);
        String type = REGULAR_WORKOUT;
        List<String> requestedCodes = request.exerciseCodes().stream().distinct().toList();
        Map<String, Exercise> exercisesByCode = exercises.findAllByCodeIn(requestedCodes).stream()
                .collect(Collectors.toMap(Exercise::getCode, exercise -> exercise));
        if (exercisesByCode.size() != requestedCodes.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "One or more selected exercises no longer exist");
        }
        if (exercisesByCode.values().stream().anyMatch(exercise -> !exercise.isActive())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Inactive exercises cannot be added to a workout");
        }
        assertSystemExercises(exercisesByCode.values());

        WorkoutEntry workout = new WorkoutEntry();
        workout.setCode("WO-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT));
        workout.setName(request.name().trim());
        workout.setDescription(request.description().trim());
        workout.setType(type);
        workout.setSource("SYSTEM");
        workout.setRestSeconds(request.restSeconds());
        workout.setLevel(resolveActiveLevelName(request.level()));
        workout.setActive(true);
        workout.setCreatedBy(users.findByEmail(creatorEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Creator account not found")));
        workout.setExercises(request.exerciseCodes().stream().map(exercisesByCode::get).toList());
        return toResponse(workouts.save(workout));
    }

    private void validateWorkoutRequest(CreateWorkoutRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Workout data is required");
        }
        if (request.name() == null || request.name().isBlank() || request.name().length() > 60) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Workout title is required and must be at most 60 characters");
        }
        if (request.description() == null || request.description().isBlank() || request.description().length() > 300) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Workout description is required and must be at most 300 characters");
        }
        if (request.restSeconds() < 0 || request.restSeconds() > 3600) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rest between sets must be between 0 and 3600 seconds");
        }
        resolveLevelName(request.level());
        if (request.exerciseCodes() == null || request.exerciseCodes().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Add at least one system exercise");
        }
        if (request.exerciseCodes().stream().anyMatch(code -> code == null || code.isBlank())) {
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

    private WorkoutResponse toResponse(WorkoutEntry workout) {
        List<WorkoutExerciseResponse> workoutExercises = workout.getExercises().stream()
                .map(this::toExerciseResponse)
                .toList();
        if ("DAILY_TRAINING_PLAN".equals(workout.getType())) {
            workoutExercises = workout.getPlanItems().stream()
                    .map(WorkoutPlanItem::getExercise)
                    .distinct()
                    .map(this::toExerciseResponse)
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
                workout.getLevel(), workout.getRestSeconds(), workout.isActive() && isLevelActive(workout.getLevel()),
                workout.getUpdatedAt(), workout.getSource(),
                workout.getCreatedBy() == null ? null : workout.getCreatedBy().getFullName(),
                workoutExercises, planItems);
    }

    private WorkoutExerciseResponse toExerciseResponse(Exercise exercise) {
        return new WorkoutExerciseResponse(
                exercise.getCode(), exercise.getName(), exercise.getDifficultyLevel(), muscleGroupLabel(exercise),
                exercise.getCategory(), exercise.getDefaultSets(), exercise.getDefaultReps(), exercise.getDuration()
        );
    }

    /** Ghép tên các muscle group của bài thành nhãn "Chest · Arms" (fallback: category). */
    private String muscleGroupLabel(Exercise exercise) {
        String joined = exercise.getMuscleGroups().stream()
                .map(link -> link.getMuscleGroup().getName())
                .filter(name -> name != null && !name.isBlank())
                .distinct()
                .reduce((first, second) -> first + " · " + second)
                .orElse(null);
        return joined != null ? joined : exercise.getCategory();
    }
}
