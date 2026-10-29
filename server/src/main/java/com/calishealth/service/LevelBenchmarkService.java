package com.calishealth.service;

import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkConfiguration;
import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkExercise;
import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkExerciseUpdate;
import com.calishealth.dtos.LevelBenchmarkDtos.CreateLevelRequest;
import com.calishealth.dtos.LevelBenchmarkDtos.ExerciseOption;
import com.calishealth.dtos.LevelBenchmarkDtos.LevelBenchmark;
import com.calishealth.dtos.LevelBenchmarkDtos.LevelUpdate;
import com.calishealth.dtos.LevelBenchmarkDtos.UpdateBenchmarkConfiguration;
import com.calishealth.models.AssessmentQuestion;
import com.calishealth.models.BenchmarkCriterion;
import com.calishealth.models.ConfigStatus;
import com.calishealth.models.Exercise;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.MemberProfile;
import com.calishealth.models.User;
import com.calishealth.repository.AssessmentQuestionRepository;
import com.calishealth.repository.BenchmarkCriterionRepository;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Exercises and thresholds are shared by every level: each benchmark exercise scores 1, 2 or 3 points,
 * the points are summed, and the level whose score range contains the sum wins. A benchmark exercise is
 * keyed by the code of the survey NUMBER question that supplies its reps / seconds (the "slot"); content
 * never picks it, the server derives it from the exercise (see {@link #slotFor}).
 * N exercises give a total score range of N..3N. Level names are free text: nothing here depends on them.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LevelBenchmarkService {
    private static final int POINTS_PER_EXERCISE = 3;
    private static final int MIN_EXERCISES = 1;
    private static final int MAX_EXERCISES = 8;
    /** benchmark_criteria.benchmark_slot is VARCHAR(32). */
    private static final int SLOT_MAX_LENGTH = 32;
    private static final String LEGACY_SLOT_PREFIX = "LEGACY-";
    private static final String NUMBER_QUESTION_TYPE = "NUMBER";
    /**
     * The table needs a level per threshold row, but the cut-offs are shared by every level. They are stored
     * against the three oldest levels (lowest ids), so renaming or reordering levels never affects them.
     * The field names beginnerMax / intermediateMax mean "1-point limit" / "2-point limit".
     */
    private static final int THRESHOLD_ROW_COUNT = 3;

    private final BenchmarkCriterionRepository criteria;
    private final AssessmentQuestionRepository assessmentQuestions;
    private final FitnessLevelRepository fitnessLevels;
    private final ExerciseRepository exercises;
    private final UserRepository users;
    private final MemberProfileRepository memberProfiles;
    private final WorkoutRepository workouts;

    @Transactional(readOnly = true)
    public BenchmarkConfiguration getConfiguration() {
        Map<String, AssessmentQuestion> numberQuestions = activeNumberQuestions();
        List<BenchmarkExercise> exerciseRows = benchmarkRowsBySlot().entrySet().stream()
                .map(entry -> toExercise(entry.getKey(), entry.getValue(), numberQuestions))
                .toList();
        List<ExerciseOption> availableExercises = exercises.findAll().stream()
                .filter(exercise -> isBenchmarkCategory(exercise.getCategory()))
                .sorted(Comparator.comparing(Exercise::getName, String.CASE_INSENSITIVE_ORDER))
                .map(exercise -> new ExerciseOption(exercise.getCode(), exercise.getName(), categoryOf(exercise)))
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
        // Resolve every slot before the old rows are removed, so an exercise that stays keeps its survey question.
        Map<String, String> slotByExerciseCode = new LinkedHashMap<>();
        benchmarkRowsBySlot().forEach((slot, rows) -> slotByExerciseCode.putIfAbsent(rows.get(0).getExercise().getCode(), slot));
        Map<String, Exercise> chosen = new LinkedHashMap<>();
        Map<String, String> slots = new LinkedHashMap<>();
        Set<String> usedSlots = new LinkedHashSet<>();
        for (BenchmarkExerciseUpdate update : request.exercises()) {
            Exercise exercise = exercises.findByCode(update.code()).orElseThrow();
            String slot = slotFor(exercise, slotByExerciseCode.get(exercise.getCode()), usedSlots);
            if (!usedSlots.add(slot)) {
                throw bad(exercise.getName() + " resolves to the same survey result as another exercise; pick different exercises");
            }
            chosen.put(update.code(), exercise);
            slots.put(update.code(), slot);
        }

        List<Threshold> thresholds = new ArrayList<>();
        for (BenchmarkExerciseUpdate update : request.exercises()) {
            thresholds.add(new Threshold(slots.get(update.code()), chosen.get(update.code()),
                    update.beginnerMax(), update.intermediateMax()));
        }

        // Levels missing from the request are deleted, entries without an id are new levels.
        Set<Long> keptIds = request.levels().stream().map(LevelUpdate::id).filter(Objects::nonNull).collect(Collectors.toSet());
        List<FitnessLevel> removed = fitnessLevels.findAll().stream().filter(level -> !keptIds.contains(level.getId())).toList();
        removed.forEach(this::assertLevelDeletable);
        Set<Long> removedIds = removed.stream().map(FitnessLevel::getId).collect(Collectors.toSet());

        // Replace every benchmark row (legacy rows for unrelated exercises are left alone), plus anything
        // else that still points at a level that is being removed.
        criteria.deleteAll(criteria.findAll().stream()
                .filter(row -> isBenchmarkRow(row) || removedIds.contains(row.getFitnessLevel().getId()))
                .toList());
        criteria.flush();
        fitnessLevels.deleteAll(removed);
        fitnessLevels.flush();

        // Existing levels first (renames may free a name), then the new ones.
        for (LevelUpdate update : request.levels()) {
            if (update.id() == null) continue;
            FitnessLevel level = fitnessLevels.findById(update.id())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Benchmark level not found"));
            applyLevel(level, update, actor);
        }
        fitnessLevels.flush();
        for (LevelUpdate update : request.levels()) {
            if (update.id() != null) continue;
            applyLevel(new FitnessLevel(), update, actor);
        }
        fitnessLevels.flush();

        // The holders depend on which levels are left, so they are resolved last.
        saveThresholds(thresholds, thresholdHolderLevels());
        return getConfiguration();
    }

    private void applyLevel(FitnessLevel level, LevelUpdate update, User actor) {
        level.setName(update.name().trim());
        level.setScoreMin(update.scoreMin());
        level.setScoreMax(update.scoreMax());
        level.setStatus(update.status().toUpperCase());
        level.setUpdatedBy(actor);
        fitnessLevels.save(level);
    }

    /**
     * Deletes one level. Its points go to the neighbouring level so the ranges stay contiguous. Refused while
     * members, exercises or workouts still use the level (deactivate it instead) and for the last / last
     * active level.
     */
    @Transactional
    public BenchmarkConfiguration deleteLevel(Long id, String email) {
        User actor = users.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "The signed-in user no longer exists"));
        FitnessLevel target = fitnessLevels.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Benchmark level not found"));
        List<FitnessLevel> ordered = fitnessLevels.findAll().stream()
                .sorted(Comparator.comparingInt(FitnessLevel::getScoreMin))
                .toList();
        if (ordered.size() <= 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "At least one level is required");
        }
        if (ordered.stream().noneMatch(item -> !item.getId().equals(id) && "ACTIVE".equalsIgnoreCase(item.getStatus()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "At least one level must stay active");
        }
        assertLevelDeletable(target);

        int index = 0;
        while (!ordered.get(index).getId().equals(id)) index++;
        // The threshold rows hang off the oldest levels, so they have to move if one of those goes.
        boolean holder = thresholdHolderLevels().stream().anyMatch(item -> item.getId().equals(id));
        List<Threshold> thresholds = holder ? currentThresholds() : List.of();

        criteria.deleteAll(criteria.findAll().stream()
                .filter(row -> (holder && isBenchmarkRow(row)) || row.getFitnessLevel().getId().equals(id))
                .toList());
        criteria.flush();
        fitnessLevels.delete(target);
        fitnessLevels.flush();

        FitnessLevel neighbour;
        if (index > 0) {
            neighbour = ordered.get(index - 1);
            neighbour.setScoreMax(target.getScoreMax());
        } else {
            neighbour = ordered.get(1);
            neighbour.setScoreMin(target.getScoreMin());
        }
        neighbour.setUpdatedBy(actor);
        fitnessLevels.saveAndFlush(neighbour);

        if (holder) saveThresholds(thresholds, thresholdHolderLevels());
        return getConfiguration();
    }

    private void assertLevelDeletable(FitnessLevel level) {
        long members = memberProfiles.countByFitnessLevel_Id(level.getId());
        if (members > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, members + " member" + (members == 1 ? " is" : "s are")
                    + " currently at level " + level.getName() + ". Deactivate the level instead of deleting it");
        }
        if (exercises.existsInUseByDifficultyLevel(level.getName())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Exercises still use level " + level.getName()
                    + ". Move them to another level first, or deactivate the level");
        }
        if (workouts.existsByLevelIgnoreCase(level.getName())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Workouts still use level " + level.getName()
                    + ". Move them to another level first, or deactivate the level");
        }
    }

    /** The configured thresholds as they are stored now, in the order the exercises were first configured. */
    private List<Threshold> currentThresholds() {
        return benchmarkRowsBySlot().entrySet().stream().map(entry -> {
            List<BenchmarkCriterion> rows = entry.getValue();
            int onePoint = rows.get(0).getMaxValue() == null ? 1 : rows.get(0).getMaxValue().intValue();
            int twoPoints = rows.size() < 2 || rows.get(1).getMaxValue() == null
                    ? onePoint + 1 : rows.get(1).getMaxValue().intValue();
            return new Threshold(entry.getKey(), rows.get(0).getExercise(), onePoint, twoPoints);
        }).toList();
    }

    private void saveThresholds(List<Threshold> thresholds, List<FitnessLevel> holders) {
        for (Threshold item : thresholds) {
            // onePointMax / twoPointMax are inclusive upper bounds for 1 and 2 points (matches pointsFor).
            saveCriterion(item.slot(), item.exercise(), holders.get(0), BigDecimal.ONE,
                    BigDecimal.valueOf(item.onePointMax()));
            saveCriterion(item.slot(), item.exercise(), holders.get(1), BigDecimal.valueOf(item.onePointMax() + 1L),
                    BigDecimal.valueOf(item.twoPointMax()));
            saveCriterion(item.slot(), item.exercise(), holders.get(2), BigDecimal.valueOf(item.twoPointMax() + 1L), null);
        }
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
        validateNewLevel(request.name(), request.status());
        if (fitnessLevels.existsByNameIgnoreCase(request.name().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A benchmark level with this name already exists");
        }
        User actor = users.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "The signed-in user no longer exists"));
        List<FitnessLevel> existing = fitnessLevels.findAll().stream()
                .sorted(Comparator.comparingInt(FitnessLevel::getScoreMin))
                .toList();
        int exerciseCount = benchmarkRowsBySlot().size();
        int floor = scoreFloor(exerciseCount);
        int totalPoints = scoreCeiling(exerciseCount) - floor + 1;
        if (existing.size() >= totalPoints) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "No score points left: at most " + totalPoints + " levels fit in the " + floor + "-" + scoreCeiling(exerciseCount) + " score range");
        }

        // Existing levels keep their width, except the widest one (highest on ties) which gives up one
        // point to the new top level. Ranges are then re-laid out back to back, so they never overlap or gap.
        int[] sizes = new int[existing.size() + 1];
        for (int i = 0; i < existing.size(); i++) {
            sizes[i] = existing.get(i).getScoreMax() - existing.get(i).getScoreMin() + 1;
        }
        sizes[existing.size()] = 0;
        int used = Arrays.stream(sizes).sum();
        if (used < totalPoints) {
            // The top level ends below the ceiling: the new level simply takes the free points, nothing else moves.
            sizes[existing.size()] = totalPoints - used;
        } else if (used > totalPoints) {
            // Inconsistent legacy data: fall back to an even split.
            int count = sizes.length;
            for (int i = 0; i < count; i++) sizes[i] = totalPoints / count + (i < totalPoints % count ? 1 : 0);
        } else {
            int widest = 0;
            for (int i = 0; i < existing.size(); i++) if (sizes[i] >= sizes[widest]) widest = i;
            sizes[widest]--;
            sizes[existing.size()] = 1;
        }

        int cursor = floor;
        for (int i = 0; i < existing.size(); i++) {
            FitnessLevel item = existing.get(i);
            item.setScoreMin(cursor);
            item.setScoreMax(cursor + sizes[i] - 1);
            item.setUpdatedBy(actor);
            cursor += sizes[i];
        }
        FitnessLevel level = new FitnessLevel();
        level.setName(request.name().trim());
        level.setScoreMin(cursor);
        level.setScoreMax(cursor + sizes[existing.size()] - 1);
        level.setStatus(request.status().toUpperCase());
        level.setUpdatedBy(actor);
        fitnessLevels.saveAll(existing);
        fitnessLevels.saveAndFlush(level);
        return getConfiguration();
    }

    /** Codes of the survey questions whose answers feed the level calculation, in display order. */
    @Transactional(readOnly = true)
    public List<String> benchmarkSlots() {
        return new ArrayList<>(benchmarkRowsBySlot().keySet());
    }

    /**
     * Scores the onboarding answers against the shared thresholds and stores the matching level on the
     * member profile. {@code valuesBySlot} maps a survey question code to its reps / seconds answer.
     * Returns empty (and changes nothing) when an answer for any benchmark exercise is missing.
     */
    @Transactional
    public Optional<String> assignLevelFromOnboarding(Long userId, Map<String, Integer> valuesBySlot) {
        List<BenchmarkExercise> configured = getConfiguration().exercises();
        if (configured.isEmpty()) return Optional.empty();
        int totalScore = 0;
        boolean zeroResult = false;
        List<Integer> exercisePoints = new ArrayList<>();
        for (BenchmarkExercise exercise : configured) {
            Integer value = valuesBySlot.get(exercise.slot());
            if (value == null) {
                log.warn("Level not assigned for user {}: no answer for benchmark question {}", userId, exercise.slot());
                return Optional.empty();
            }
            // 0 reps / seconds still scores the minimum 1 point; the penalty is applied to the level below.
            if (isCriticalFailure(value)) zeroResult = true;
            int points = pointsFor(value, exercise.beginnerMax(), exercise.intermediateMax());
            exercisePoints.add(points);
            totalScore += points;
        }
        // Two penalties, each worth one level, that add up: any exercise at 0 reps / seconds, and lopsided
        // results (e.g. 3 points on one exercise but 1 point on another).
        boolean unbalanced = isUnbalanced(exercisePoints);
        int levelsToDrop = levelsToDrop(zeroResult, unbalanced);
        final int score = totalScore;
        List<FitnessLevel> activeLevels = fitnessLevels.findAll().stream()
                .filter(item -> "ACTIVE".equalsIgnoreCase(item.getStatus()))
                .sorted(Comparator.comparingInt(FitnessLevel::getScoreMin))
                .toList();
        // Exact range match first; if the matching level is inactive, fall back to the nearest active level
        // instead of failing the onboarding.
        FitnessLevel level = activeLevels.stream()
                .filter(item -> score >= item.getScoreMin() && score <= item.getScoreMax())
                .findFirst()
                .orElseGet(() -> activeLevels.stream()
                        .min(Comparator.comparingInt((FitnessLevel item) ->
                                        score < item.getScoreMin() ? item.getScoreMin() - score : score - item.getScoreMax())
                                .thenComparing(Comparator.comparingInt(FitnessLevel::getScoreMin).reversed()))
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                                "No active benchmark level is available for the calculated score " + score)));
        if (levelsToDrop > 0) {
            FitnessLevel lowered = levelsBelow(activeLevels, level, levelsToDrop);
            if (lowered != level) {
                log.info("User {} (zero result: {}, unbalanced: {}, points {}): level lowered from {} to {}",
                        userId, zeroResult, unbalanced, exercisePoints, level.getName(), lowered.getName());
            }
            level = lowered;
        }
        MemberProfile profile = memberProfiles.findByUser_Id(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Member profile not found"));
        profile.setFitnessLevel(level);
        memberProfiles.save(profile);
        return Optional.of(level.getName());
    }

    /**
     * True when the best and the worst exercise are two points apart (a 3-point exercise next to a 1-point
     * one): the member is strong in one benchmark but weak in another.
     */
    static boolean isUnbalanced(List<Integer> exercisePoints) {
        if (exercisePoints.size() < 2) return false;
        int max = Collections.max(exercisePoints);
        int min = Collections.min(exercisePoints);
        return max - min >= 2;
    }

    /** A member who cannot do a single rep (or hold for a single second) of a benchmark exercise. */
    static boolean isCriticalFailure(int value) {
        return value <= 0;
    }

    /** Each penalty costs one level and the two add up, so the drop is 0, 1 or 2 levels. */
    static int levelsToDrop(boolean zeroResult, boolean unbalanced) {
        return (zeroResult ? 1 : 0) + (unbalanced ? 1 : 0);
    }

    /**
     * The active level {@code steps} places below {@code level} (activeLevels is sorted by score, lowest
     * first). It stops at the lowest level, and a level that is not in the list stays where it is.
     */
    static FitnessLevel levelsBelow(List<FitnessLevel> activeLevels, FitnessLevel level, int steps) {
        int index = activeLevels.indexOf(level);
        if (index < 0) return level;
        return activeLevels.get(Math.max(0, index - Math.max(0, steps)));
    }

    public static int pointsFor(int value, int beginnerMax, int intermediateMax) {
        if (value <= beginnerMax) return 1;
        if (value <= intermediateMax) return 2;
        return 3;
    }

    /** Lowest possible total score: every exercise scores 1 point. */
    public static int scoreFloor(int exerciseCount) {
        return Math.max(exerciseCount, MIN_EXERCISES);
    }

    /** Highest possible total score: every exercise scores 3 points. */
    public static int scoreCeiling(int exerciseCount) {
        return scoreFloor(exerciseCount) * POINTS_PER_EXERCISE;
    }

    // ---- grouping helpers -------------------------------------------------------------------------

    private static boolean isBenchmarkRow(BenchmarkCriterion row) {
        return row.getBenchmarkSlot() != null && !row.getBenchmarkSlot().startsWith(LEGACY_SLOT_PREFIX);
    }

    private static boolean isBenchmarkCategory(String category) {
        return "REPS".equalsIgnoreCase(category) || "HOLD".equalsIgnoreCase(category);
    }

    private static String categoryOf(Exercise exercise) {
        return exercise.getCategory() == null ? "" : exercise.getCategory().toUpperCase();
    }

    /** Benchmark rows grouped by slot, in the order the exercises were first configured. */
    private Map<String, List<BenchmarkCriterion>> benchmarkRowsBySlot() {
        Map<String, List<BenchmarkCriterion>> grouped = criteria.findAll().stream()
                .filter(LevelBenchmarkService::isBenchmarkRow)
                .sorted(Comparator.comparing(BenchmarkCriterion::getId))
                .collect(Collectors.groupingBy(BenchmarkCriterion::getBenchmarkSlot, LinkedHashMap::new, Collectors.toList()));
        grouped.values().forEach(rows -> rows.sort(Comparator.comparing(BenchmarkCriterion::getMinValue)));
        return grouped;
    }

    private Map<String, AssessmentQuestion> activeNumberQuestions() {
        return assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus(NUMBER_QUESTION_TYPE, ConfigStatus.ACTIVE).stream()
                .collect(Collectors.toMap(AssessmentQuestion::getQuestionCode, question -> question, (a, b) -> a, LinkedHashMap::new));
    }

    private BenchmarkExercise toExercise(String slot, List<BenchmarkCriterion> rows, Map<String, AssessmentQuestion> numberQuestions) {
        Exercise exercise = rows.get(0).getExercise();
        String category = categoryOf(exercise);
        // Rows are ordered by min value: 1-point band, 2-point band, 3-point band (open ended).
        int beginnerMax = rows.get(0).getMaxValue() == null ? 1 : rows.get(0).getMaxValue().intValue();
        int intermediateMax = rows.size() < 2 || rows.get(1).getMaxValue() == null
                ? beginnerMax + 1 : rows.get(1).getMaxValue().intValue();
        return new BenchmarkExercise(
                slot, exercise.getCode(), exercise.getName(), category,
                "HOLD".equals(category) ? "seconds" : "reps",
                beginnerMax, intermediateMax, numberQuestions.containsKey(slot));
    }

    /** Levels that carry the shared threshold rows: the oldest ones, independent of their (editable) names. */
    private List<FitnessLevel> thresholdHolderLevels() {
        List<FitnessLevel> oldest = fitnessLevels.findAll().stream()
                .sorted(Comparator.comparing(FitnessLevel::getId))
                .limit(THRESHOLD_ROW_COUNT)
                .toList();
        if (oldest.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No benchmark level exists");
        }
        // The unique key is (level, slot, min), so one level may hold several rows of a slot if fewer than 3 exist.
        List<FitnessLevel> holders = new ArrayList<>();
        for (int i = 0; i < THRESHOLD_ROW_COUNT; i++) holders.add(oldest.get(i % oldest.size()));
        return holders;
    }

    /**
     * The survey question code that supplies this exercise's reps / seconds. An exercise that is already
     * configured keeps its slot; a new one gets {@code <EXERCISE_NAME>_MAX_REPS} or {@code _MAX_SECONDS},
     * the same convention the onboarding survey uses (PUSH_UP_MAX_REPS, PLANK_MAX_SECONDS, ...).
     */
    private static String slotFor(Exercise exercise, String existingSlot, Set<String> usedSlots) {
        if (existingSlot != null && !usedSlots.contains(existingSlot)) return existingSlot;
        String suffix = "HOLD".equalsIgnoreCase(exercise.getCategory()) ? "_MAX_SECONDS" : "_MAX_REPS";
        String base = exercise.getName().trim().toUpperCase(java.util.Locale.ROOT).replaceAll("[^A-Z0-9]+", "_").replaceAll("^_+|_+$", "");
        if (base.isEmpty()) base = exercise.getCode().toUpperCase(java.util.Locale.ROOT).replaceAll("[^A-Z0-9]+", "_");
        String candidate = trimSlot(base, suffix);
        if (!usedSlots.contains(candidate)) return candidate;
        return trimSlot(exercise.getCode().toUpperCase(java.util.Locale.ROOT).replaceAll("[^A-Z0-9]+", "_"), suffix);
    }

    private static String trimSlot(String base, String suffix) {
        int room = SLOT_MAX_LENGTH - suffix.length();
        return (base.length() > room ? base.substring(0, room) : base) + suffix;
    }

    private void saveCriterion(String slot, Exercise exercise, FitnessLevel level, BigDecimal min, BigDecimal max) {
        BenchmarkCriterion criterion = new BenchmarkCriterion();
        criterion.setFitnessLevel(level);
        criterion.setExercise(exercise);
        criterion.setBenchmarkSlot(slot);
        criterion.setMinValue(min);
        criterion.setMaxValue(max);
        criterion.setCriterionWeight(BigDecimal.ONE);
        criteria.save(criterion);
    }

    // ---- validation -------------------------------------------------------------------------------

    private void validateRequest(UpdateBenchmarkConfiguration request) {
        if (request == null || request.exercises() == null || request.levels() == null) {
            throw bad("Exercise thresholds and level statuses are required");
        }
        validateExerciseUpdates(request.exercises());
        if (request.levels().isEmpty()) {
            throw bad("At least one benchmark level is required");
        }
        // A level without an id is a new level; every other id must be an existing, distinct level.
        Set<Long> ids = request.levels().stream().map(LevelUpdate::id).filter(Objects::nonNull).collect(Collectors.toSet());
        long existingCount = request.levels().stream().filter(item -> item.id() != null).count();
        if (ids.size() != existingCount || ids.stream().anyMatch(id -> !fitnessLevels.existsById(id))) {
            throw bad("Every benchmark level must be an existing level");
        }
        request.levels().forEach(item -> validateLevel(item.name(), item.scoreMin(), item.scoreMax(), item.status()));
        if (request.levels().stream().map(item -> item.name().trim().toLowerCase()).distinct().count() != request.levels().size()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Benchmark level names must be unique");
        }
        if (request.levels().stream().noneMatch(item -> "ACTIVE".equalsIgnoreCase(item.status()))) {
            throw bad("At least one level must stay active");
        }
        int count = request.exercises().size();
        validateContiguousScoreRanges(request.levels().stream()
                .map(item -> new ScoreRange(item.name(), item.scoreMin(), item.scoreMax()))
                .toList(), scoreFloor(count), scoreCeiling(count));
    }

    private void validateExerciseUpdates(List<BenchmarkExerciseUpdate> updates) {
        if (updates == null || updates.size() < MIN_EXERCISES || updates.size() > MAX_EXERCISES) {
            throw bad("Configure between " + MIN_EXERCISES + " and " + MAX_EXERCISES + " benchmark exercises");
        }
        Set<String> codes = new LinkedHashSet<>();
        for (BenchmarkExerciseUpdate update : updates) {
            if (update == null || update.code() == null || update.code().isBlank() || !codes.add(update.code())) {
                throw bad("Each benchmark must use a different exercise");
            }
            if (update.beginnerMax() < 1 || update.intermediateMax() <= update.beginnerMax()) {
                throw bad("Thresholds must be positive and the intermediate maximum must exceed the beginner maximum");
            }
            Exercise exercise = exercises.findByCode(update.code())
                    .orElseThrow(() -> bad("Selected benchmark exercise was not found"));
            if (!isBenchmarkCategory(exercise.getCategory())) {
                throw bad(exercise.getName() + " must be a REPS or HOLD exercise");
            }
            if (update.category() == null || !update.category().equalsIgnoreCase(exercise.getCategory())) {
                throw bad(exercise.getName() + " category does not match the selected exercise");
            }
        }
    }

    private void validateContiguousScoreRanges(List<ScoreRange> ranges, int floor, int ceiling) {
        List<ScoreRange> ordered = new ArrayList<>(ranges);
        ordered.sort(Comparator.comparingInt(ScoreRange::min));
        if (ordered.get(0).min() != floor) {
            throw bad("Benchmark score ranges must start at " + floor);
        }
        for (int index = 1; index < ordered.size(); index++) {
            ScoreRange previous = ordered.get(index - 1);
            ScoreRange current = ordered.get(index);
            if (current.min() != previous.max() + 1) {
                throw bad("Benchmark score ranges must be contiguous: " + current.name() + " must start at " + (previous.max() + 1));
            }
        }
        if (ordered.get(ordered.size() - 1).max() != ceiling) {
            throw bad("Benchmark score ranges must end at " + ceiling);
        }
    }

    private void validateNewLevel(String name, String status) {
        if (name == null || name.isBlank() || name.length() > 50
                || status == null || !Set.of("ACTIVE", "INACTIVE").contains(status.toUpperCase())) {
            throw bad("Enter a valid level name and Active/Inactive status");
        }
    }

    private void validateLevel(String name, int scoreMin, int scoreMax, String status) {
        if (name == null || name.isBlank() || name.length() > 50 || scoreMin < 0 || scoreMax < scoreMin
                || status == null || !Set.of("ACTIVE", "INACTIVE").contains(status.toUpperCase())) {
            throw bad("Enter a valid level name, score range, and Active/Inactive status");
        }
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private record ScoreRange(String name, int min, int max) {}

    /** One benchmark exercise with its inclusive 1-point and 2-point limits. */
    private record Threshold(String slot, Exercise exercise, int onePointMax, int twoPointMax) {}
}
