package com.calishealth.service;

import com.calishealth.dtos.ExerciseDtos.CreateWorkoutRequest;
import com.calishealth.dtos.ExerciseDtos.WorkoutExerciseResponse;
import com.calishealth.dtos.ExerciseDtos.WorkoutPlanItemRequest;
import com.calishealth.dtos.ExerciseDtos.WorkoutPlanItemResponse;
import com.calishealth.dtos.ExerciseDtos.WorkoutResponse;
import com.calishealth.models.ExerciseEntry;
import com.calishealth.models.WorkoutEntry;
import com.calishealth.models.WorkoutPlanItem;
import com.calishealth.repository.ExerciseRepository;
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
    private static final String REGULAR_WORKOUT = "WORKOUT";
    private static final String DAILY_TRAINING_PLAN = "DAILY_TRAINING_PLAN";
    private static final Set<String> ALLOWED_TYPES = Set.of(REGULAR_WORKOUT, DAILY_TRAINING_PLAN);
    private static final Set<String> ALLOWED_LEVELS = Set.of("Beginner", "Intermediate", "Advanced");

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
    public WorkoutResponse create(CreateWorkoutRequest request, String creatorEmail) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Workout data is required");
        }
        if (request.name() == null || request.name().isBlank() || request.name().length() > 60) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Workout title is required and must be at most 60 characters");
        }
        if (request.description() == null || request.description().isBlank() || request.description().length() > 300) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Workout description is required and must be at most 300 characters");
        }
        if (request.content() != null && request.content().length() > 2000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Workout content must be at most 2000 characters");
        }
        String type = request.type() == null ? "" : request.type().trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED_TYPES.contains(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose Workout or Daily training plan");
        }
        if (type.equals(REGULAR_WORKOUT)
                && (request.level() == null || !ALLOWED_LEVELS.contains(request.level()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid workout level");
        }
        if (type.equals(REGULAR_WORKOUT)
                && (request.exerciseCodes() == null || request.exerciseCodes().isEmpty())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Add at least one system exercise");
        }
        if (type.equals(REGULAR_WORKOUT)
                && request.exerciseCodes().stream().distinct().count() != request.exerciseCodes().size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "An exercise can only be added once");
        }
        List<WorkoutPlanItemRequest> planRequests = request.planItems() == null ? List.of() : request.planItems();
        if (type.equals(DAILY_TRAINING_PLAN) && planRequests.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Add at least one exercise to the 7-day plan");
        }
        if (type.equals(DAILY_TRAINING_PLAN)) {
            validatePlanItems(planRequests);
        }

        if (type.equals(REGULAR_WORKOUT)
                && request.exerciseCodes().stream().anyMatch(code -> code == null || code.isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selected exercise codes must be valid");
        }
        List<String> requestedCodes = type.equals(REGULAR_WORKOUT)
                ? request.exerciseCodes()
                : planRequests.stream().map(WorkoutPlanItemRequest::exerciseCode).distinct().toList();
        Map<String, ExerciseEntry> exercisesByCode = exercises.findAllByCodeIn(requestedCodes).stream()
                .collect(Collectors.toMap(ExerciseEntry::getCode, exercise -> exercise));
        if (exercisesByCode.size() != requestedCodes.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "One or more selected exercises no longer exist");
        }
        if (exercisesByCode.values().stream().anyMatch(exercise -> !exercise.isActive())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Inactive exercises cannot be added to a workout");
        }

        WorkoutEntry workout = new WorkoutEntry();
        workout.setCode("WO-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT));
        workout.setName(request.name().trim());
        workout.setDescription(request.description().trim());
        workout.setContent(request.content());
        workout.setType(type);
        workout.setLevel(type.equals(REGULAR_WORKOUT) ? request.level().trim() : "All levels");
        workout.setActive(true);
        workout.setCreatedBy(users.findByEmail(creatorEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Creator account not found")));
        if (type.equals(REGULAR_WORKOUT)) {
            workout.setExercises(request.exerciseCodes().stream().map(exercisesByCode::get).toList());
        } else {
            List<WorkoutPlanItem> items = planRequests.stream().map(item -> toPlanItem(item, exercisesByCode, workout)).toList();
            workout.setPlanItems(items);
        }
        return toResponse(workouts.save(workout));
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
            Map<String, ExerciseEntry> exercisesByCode,
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
                .map(exercise -> new WorkoutExerciseResponse(
                        exercise.getCode(), exercise.getName(), exercise.getLevel(), exercise.getMuscleGroup()
                )).toList();
        if ("DAILY_TRAINING_PLAN".equals(workout.getType())) {
            workoutExercises = workout.getPlanItems().stream()
                    .map(WorkoutPlanItem::getExercise)
                    .distinct()
                    .map(exercise -> new WorkoutExerciseResponse(
                            exercise.getCode(), exercise.getName(), exercise.getLevel(), exercise.getMuscleGroup()
                    )).toList();
        }
        List<WorkoutPlanItemResponse> planItems = workout.getPlanItems().stream()
                .map(item -> new WorkoutPlanItemResponse(
                        item.getDayOfWeek(), item.getExercise().getCode(), item.getExercise().getName(),
                        item.getExercise().getMuscleGroup(), item.getBeginnerSets(), item.getBeginnerReps(),
                        item.getIntermediateSets(), item.getIntermediateReps(), item.getAdvancedSets(), item.getAdvancedReps()
                )).toList();
        return new WorkoutResponse(workout.getCode(), workout.getName(), workout.getDescription(),
                workout.getContent(), workout.getType() == null ? REGULAR_WORKOUT : workout.getType(),
                workout.getLevel(), workout.isActive(),
                workout.getUpdatedAt(), workoutExercises, planItems);
    }
}
