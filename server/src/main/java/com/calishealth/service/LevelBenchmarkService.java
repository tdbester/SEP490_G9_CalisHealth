package com.calishealth.service;

import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkConfiguration;
import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkExercise;
import com.calishealth.dtos.LevelBenchmarkDtos.CreateLevelRequest;
import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkExerciseUpdate;
import com.calishealth.dtos.LevelBenchmarkDtos.ExerciseOption;
import com.calishealth.dtos.LevelBenchmarkDtos.LevelBenchmark;
import com.calishealth.dtos.LevelBenchmarkDtos.LevelUpdate;
import com.calishealth.dtos.LevelBenchmarkDtos.UpdateBenchmarkConfiguration;
import com.calishealth.models.BenchmarkCriterion;
import com.calishealth.models.Exercise;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.MemberProfile;
import com.calishealth.models.User;
import com.calishealth.repository.BenchmarkCriterionRepository;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LevelBenchmarkService {
    private static final List<String> DEFAULT_LEVELS = List.of("Beginner", "Intermediate", "Advanced");
    private static final List<ExerciseDefinition> EXERCISES = List.of(
            new ExerciseDefinition("PUSH_UP", "Push-up", "REPS", "reps", 20, 40),
            new ExerciseDefinition("SQUAT", "Bodyweight Squat", "REPS", "reps", 30, 60),
            new ExerciseDefinition("PLANK", "Plank", "HOLD", "seconds", 45, 90)
    );
    private static final Map<String, Integer> SCORE_MIN = Map.of("Beginner", 3, "Intermediate", 5, "Advanced", 8);
    private static final Map<String, Integer> SCORE_MAX = Map.of("Beginner", 4, "Intermediate", 7, "Advanced", 9);

    private final BenchmarkCriterionRepository criteria;
    private final FitnessLevelRepository fitnessLevels;
    private final ExerciseRepository exercises;
    private final UserRepository users;
    private final MemberProfileRepository memberProfiles;

    @Transactional(readOnly = true)
    public BenchmarkConfiguration getConfiguration() {
        List<BenchmarkExercise> exerciseRows = EXERCISES.stream()
                .map(definition -> {
                    Exercise exercise = configuredExercise(definition);
                    BenchmarkCriterion beginner = criterion(definition.slot(), "Beginner");
                    BenchmarkCriterion intermediate = criterion(definition.slot(), "Intermediate");
                    return new BenchmarkExercise(
                            definition.slot(),
                            exercise == null ? null : exercise.getCode(),
                            exercise == null ? definition.defaultName() : exercise.getName(),
                            definition.category(),
                            definition.unit(),
                            maxValue(beginner, definition.beginnerMax() - 1),
                            maxValue(intermediate, definition.intermediateMax())
                    );
                })
                .toList();

        List<ExerciseOption> availableExercises = exercises.findAll().stream()
                .filter(exercise -> "REPS".equalsIgnoreCase(exercise.getCategory()) || "HOLD".equalsIgnoreCase(exercise.getCategory()))
                .sorted(Comparator.comparing(Exercise::getName, String.CASE_INSENSITIVE_ORDER))
                .map(exercise -> new ExerciseOption(exercise.getCode(), exercise.getName(), exercise.getCategory().toUpperCase()))
                .toList();

        List<LevelBenchmark> levelRows = fitnessLevels.findAll().stream()
                .sorted(Comparator.comparingInt(FitnessLevel::getScoreMin).thenComparing(FitnessLevel::getName, String.CASE_INSENSITIVE_ORDER))
                .map(level -> new LevelBenchmark(
                        level.getId(), level.getName(), level.getScoreMin(), level.getScoreMax(),
                        level.getStatus(), level.getUpdatedAt(),
                        level.getUpdatedBy() == null ? "System" : level.getUpdatedBy().getFullName()
                ))
                .toList();
        return new BenchmarkConfiguration(exerciseRows, availableExercises, levelRows);
    }

    @Transactional
    public BenchmarkConfiguration updateConfiguration(UpdateBenchmarkConfiguration request, String email) {
        validateRequest(request);
        User actor = users.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "The signed-in user no longer exists"));
        Map<String, BenchmarkExerciseUpdate> updates = request.exercises().stream()
                .collect(Collectors.toMap(BenchmarkExerciseUpdate::slot, Function.identity()));
        Map<String, Exercise> configuredExercises = EXERCISES.stream()
                .collect(Collectors.toMap(ExerciseDefinition::slot, definition -> {
                    BenchmarkExerciseUpdate update = updates.get(definition.slot());
                    Exercise selected = exercises.findByCode(update.code())
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selected benchmark exercise was not found"));
                    if (!definition.category().equalsIgnoreCase(selected.getCategory())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                definition.defaultName() + " must use category " + definition.category());
                    }
                    return selected;
                }));

        criteria.deleteAllByBenchmarkSlotIn(EXERCISES.stream().map(ExerciseDefinition::slot).toList());
        criteria.flush();
        for (ExerciseDefinition definition : EXERCISES) {
            BenchmarkExerciseUpdate update = updates.get(definition.slot());
            Exercise exercise = configuredExercises.get(definition.slot());
            saveCriterion(definition, exercise, "Beginner", BigDecimal.ONE,
                    BigDecimal.valueOf(update.beginnerMax() - 1L), BigDecimal.ONE);
            saveCriterion(definition, exercise, "Intermediate", BigDecimal.valueOf(update.beginnerMax()),
                    BigDecimal.valueOf(update.intermediateMax()), BigDecimal.ONE);
            saveCriterion(definition, exercise, "Advanced", BigDecimal.valueOf(update.intermediateMax() + 1L),
                    null, BigDecimal.ONE);
        }

        validateLevelUpdates(request.levels());
        for (LevelUpdate update : request.levels()) {
            FitnessLevel level = fitnessLevels.findById(update.id())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Benchmark level not found"));
            level.setName(update.name().trim());
            level.setScoreMin(update.scoreMin());
            level.setScoreMax(update.scoreMax());
            level.setStatus(update.status().toUpperCase());
            level.setUpdatedBy(actor);
            fitnessLevels.save(level);
        }
        return getConfiguration();
    }

    @Transactional
    public BenchmarkConfiguration updateLevelStatus(String levelName, String status, String email) {
        User actor = users.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "The signed-in user no longer exists"));
        FitnessLevel level = fitnessLevels.findByNameIgnoreCase(levelName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Benchmark level not found"));
        String normalized = status == null ? "" : status.toUpperCase();
        if (!Set.of("ACTIVE", "INACTIVE").contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be Active or Inactive");
        }
        level.setStatus(normalized);
        level.setUpdatedBy(actor);
        fitnessLevels.save(level);
        return getConfiguration();
    }

    @Transactional
    public BenchmarkConfiguration createLevel(CreateLevelRequest request, String email) {
        validateLevel(request.name(), request.scoreMin(), request.scoreMax(), request.status());
        if (fitnessLevels.existsByNameIgnoreCase(request.name().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A benchmark level with this name already exists");
        }
        User actor = users.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "The signed-in user no longer exists"));
        FitnessLevel level = new FitnessLevel();
        level.setName(request.name().trim());
        level.setScoreMin(request.scoreMin());
        level.setScoreMax(request.scoreMax());
        level.setStatus(request.status().toUpperCase());
        level.setUpdatedBy(actor);
        fitnessLevels.saveAndFlush(level);
        return getConfiguration();
    }

    @Transactional
    public String assignLevelFromOnboarding(Long userId, int pushUp, int squat, int plank) {
        BenchmarkConfiguration configuration = getConfiguration();
        Map<String, BenchmarkExercise> bySlot = configuration.exercises().stream()
                .collect(Collectors.toMap(BenchmarkExercise::slot, Function.identity()));
        int totalScore = pointsFor(pushUp, bySlot.get("PUSH_UP"))
                + pointsFor(squat, bySlot.get("SQUAT"))
                + pointsFor(plank, bySlot.get("PLANK"));
        FitnessLevel level = fitnessLevels.findAll().stream()
                .filter(item -> "ACTIVE".equalsIgnoreCase(item.getStatus())
                        && totalScore >= item.getScoreMin() && totalScore <= item.getScoreMax())
                .sorted(Comparator.comparingInt(FitnessLevel::getScoreMin))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "No active benchmark level matches the calculated score " + totalScore));
        MemberProfile profile = memberProfiles.findByUser_Id(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Member profile not found"));
        profile.setFitnessLevel(level);
        memberProfiles.save(profile);
        return level.getName();
    }

    public static int pointsFor(int value, int beginnerMax, int intermediateMax) {
        if (value <= beginnerMax) return 1;
        if (value <= intermediateMax) return 2;
        return 3;
    }

    public static String levelForTotalScore(int totalScore) {
        if (totalScore >= 3 && totalScore <= 4) return "Beginner";
        if (totalScore >= 5 && totalScore <= 7) return "Intermediate";
        if (totalScore >= 8 && totalScore <= 9) return "Advanced";
        throw new IllegalArgumentException("Total score must be between 3 and 9");
    }

    private static int pointsFor(int value, BenchmarkExercise exercise) {
        if (exercise == null) throw new IllegalStateException("Benchmark criteria are not configured");
        return pointsFor(value, exercise.beginnerMax(), exercise.intermediateMax());
    }

    private void validateRequest(UpdateBenchmarkConfiguration request) {
        if (request == null || request.exercises() == null || request.levels() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Exercise thresholds and level statuses are required");
        }
        validateExerciseUpdates(request.exercises());
        if (request.levels().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one benchmark level is required");
        }
        Set<Long> ids = request.levels().stream().map(LevelUpdate::id).collect(Collectors.toSet());
        if (ids.size() != request.levels().size() || ids.stream().anyMatch(id -> !fitnessLevels.existsById(id))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Every benchmark level must be an existing level");
        }
        request.levels().forEach(item -> validateLevel(item.name(), item.scoreMin(), item.scoreMax(), item.status()));
        if (request.levels().stream().map(item -> item.name().trim().toLowerCase()).distinct().count() != request.levels().size()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Benchmark level names must be unique");
        }
    }

    private void validateLevelUpdates(List<LevelUpdate> levels) {
        if (levels == null || levels.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one benchmark level is required");
        }
        levels.forEach(item -> validateLevel(item.name(), item.scoreMin(), item.scoreMax(), item.status()));
    }

    private void validateLevel(String name, int scoreMin, int scoreMax, String status) {
        if (name == null || name.isBlank() || name.length() > 50 || scoreMin < 0 || scoreMax < scoreMin
                || status == null || !Set.of("ACTIVE", "INACTIVE").contains(status.toUpperCase())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid level name, score range, and Active/Inactive status");
        }
    }

    private void validateExerciseUpdates(List<BenchmarkExerciseUpdate> updates) {
        Set<String> requiredSlots = EXERCISES.stream().map(ExerciseDefinition::slot).collect(Collectors.toSet());
        if (updates == null || updates.size() != EXERCISES.size()
                || !updates.stream().map(BenchmarkExerciseUpdate::slot).collect(Collectors.toSet()).equals(requiredSlots)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Configure Push-up, Squat, and Plank exactly once");
        }
        if (updates.stream().anyMatch(update -> update.code() == null || update.code().isBlank()
                || update.category() == null || update.beginnerMax() < 1
                || update.intermediateMax() <= update.beginnerMax())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thresholds must be positive and the intermediate maximum must exceed the beginner maximum");
        }
        if (updates.stream().map(BenchmarkExerciseUpdate::code).distinct().count() != EXERCISES.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Each benchmark must use a different exercise");
        }
        for (BenchmarkExerciseUpdate update : updates) {
            Exercise exercise = exercises.findByCode(update.code())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selected benchmark exercise was not found"));
            ExerciseDefinition definition = EXERCISES.stream().filter(item -> item.slot().equals(update.slot())).findFirst().orElseThrow();
            if (!definition.category().equalsIgnoreCase(update.category()) || !definition.category().equalsIgnoreCase(exercise.getCategory())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, definition.defaultName() + " must use category " + definition.category());
            }
        }
    }

    private Exercise configuredExercise(ExerciseDefinition definition) {
        return criterion(definition.slot(), "Beginner") == null
                ? exercises.findByNameIgnoreCase(definition.defaultName()).orElse(null)
                : criterion(definition.slot(), "Beginner").getExercise();
    }

    private BenchmarkCriterion criterion(String slot, String level) {
        return criteria.findAllByBenchmarkSlotInAndFitnessLevel_NameIgnoreCase(List.of(slot), level)
                .stream().findFirst().orElse(null);
    }

    private int maxValue(BenchmarkCriterion criterion, int fallback) {
        if (criterion == null || criterion.getMaxValue() == null) return fallback;
        return criterion.getMaxValue().intValue();
    }

    private void saveCriterion(ExerciseDefinition definition, Exercise exercise, String levelName,
                               BigDecimal min, BigDecimal max, BigDecimal weight) {
        FitnessLevel level = fitnessLevels.findByNameIgnoreCase(levelName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "A required fitness level is missing"));
        BenchmarkCriterion criterion = new BenchmarkCriterion();
        criterion.setFitnessLevel(level);
        criterion.setExercise(exercise);
        criterion.setBenchmarkSlot(definition.slot());
        criterion.setMinValue(min);
        criterion.setMaxValue(max);
        criterion.setCriterionWeight(weight);
        criteria.save(criterion);
    }

    private record ExerciseDefinition(String slot, String defaultName, String category,
                                      String unit, int beginnerMax, int intermediateMax) {}
}
