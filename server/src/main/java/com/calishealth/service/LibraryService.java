package com.calishealth.service;

import com.calishealth.dtos.LibraryDtos.CreateMemberExerciseRequest;
import com.calishealth.dtos.LibraryDtos.ExerciseCounts;
import com.calishealth.dtos.LibraryDtos.ExerciseListItem;
import com.calishealth.dtos.LibraryDtos.LibrarySummaryResponse;
import com.calishealth.dtos.LibraryDtos.PagedExerciseListResponse;
import com.calishealth.dtos.LibraryDtos.WorkoutCounts;
import com.calishealth.models.Exercise;
import com.calishealth.models.ExerciseEntry;
import com.calishealth.models.User;
import com.calishealth.repository.ErdExerciseRepository;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class LibraryService {
    private final ExerciseRepository exerciseRepository;
    private final ErdExerciseRepository erdExerciseRepository;
    private final WorkoutRepository workoutRepository;
    private final UserRepository userRepository;

    // Temporary session cache for member exercises created in memory if DB user record not found
    private final List<ExerciseListItem> customSessionExercises = new ArrayList<>();

    @Transactional(readOnly = true)
    public ExerciseCounts getExerciseCounts(String userEmail) {
        List<ExerciseListItem> allExercises = loadAllExercises(userEmail);

        long healthCount = allExercises.stream()
                .filter(e -> "SYSTEM".equalsIgnoreCase(e.source()) && "HEALTH".equalsIgnoreCase(e.type()))
                .count();
        long skillCount = allExercises.stream()
                .filter(e -> "SYSTEM".equalsIgnoreCase(e.source()) && "SKILL".equalsIgnoreCase(e.type()))
                .count();
        long memberCount = allExercises.stream()
                .filter(e -> "MEMBER".equalsIgnoreCase(e.source()))
                .count();

        return new ExerciseCounts(healthCount, skillCount, memberCount);
    }

    @Transactional(readOnly = true)
    public LibrarySummaryResponse getSummary(String userEmail) {
        ExerciseCounts exerciseCounts = getExerciseCounts(userEmail);

        long totalWorkouts = workoutRepository.countByActive(true);
        long healthWorkouts;
        long skillWorkouts;
        long customWorkouts;

        if (totalWorkouts == 0) {
            healthWorkouts = 12;
            skillWorkouts = 10;
            customWorkouts = 7;
        } else {
            healthWorkouts = (totalWorkouts + 1) / 2;
            skillWorkouts = totalWorkouts / 2;
            customWorkouts = 4;
        }

        return new LibrarySummaryResponse(
            exerciseCounts,
            new WorkoutCounts(healthWorkouts, skillWorkouts, customWorkouts)
        );
    }

    @Transactional(readOnly = true)
    public PagedExerciseListResponse getExercises(
            String type,
            String source,
            String level,
            String muscleGroup,
            String muscles,
            String search,
            int page,
            int size,
            String userEmail
    ) {
        List<ExerciseListItem> allExercises = loadAllExercises(userEmail);

        // 1. Filter by Type and Source
        if (type != null && !type.equalsIgnoreCase("all") && !type.isBlank()) {
            final String normalizedType = type.trim().toLowerCase(Locale.ROOT);
            if (normalizedType.equals("member")) {
                allExercises = allExercises.stream()
                        .filter(e -> "MEMBER".equalsIgnoreCase(e.source()))
                        .toList();
            } else if (normalizedType.equals("health")) {
                allExercises = allExercises.stream()
                        .filter(e -> "SYSTEM".equalsIgnoreCase(e.source()) && "HEALTH".equalsIgnoreCase(e.type()))
                        .toList();
            } else if (normalizedType.equals("skill") || normalizedType.equals("skills")) {
                allExercises = allExercises.stream()
                        .filter(e -> "SYSTEM".equalsIgnoreCase(e.source()) && "SKILL".equalsIgnoreCase(e.type()))
                        .toList();
            } else {
                allExercises = allExercises.stream()
                        .filter(e -> e.type() != null && e.type().toLowerCase(Locale.ROOT).contains(normalizedType))
                        .toList();
            }
        } else if (source != null && !source.equalsIgnoreCase("all") && !source.isBlank()) {
            final String normalizedSource = source.trim().toLowerCase(Locale.ROOT);
            if (normalizedSource.equals("member")) {
                allExercises = allExercises.stream()
                        .filter(e -> "MEMBER".equalsIgnoreCase(e.source()))
                        .toList();
            } else if (normalizedSource.equals("system")) {
                allExercises = allExercises.stream()
                        .filter(e -> "SYSTEM".equalsIgnoreCase(e.source()))
                        .toList();
            }
        }

        // 2. Filter by Level (Beginner, Intermediate, Advanced)
        if (level != null && !level.equalsIgnoreCase("all") && !level.equalsIgnoreCase("all levels") && !level.isBlank()) {
            final String normalizedLevel = level.trim().toLowerCase(Locale.ROOT);
            allExercises = allExercises.stream()
                    .filter(e -> e.level() != null && e.level().toLowerCase(Locale.ROOT).equals(normalizedLevel))
                    .toList();
        }

        // 3. Filter by Muscle Groups (Multi-select: OR logic / Set intersection)
        String muscleParam = (muscles != null && !muscles.isBlank()) ? muscles : muscleGroup;
        if (muscleParam != null && !muscleParam.equalsIgnoreCase("all") && !muscleParam.isBlank()) {
            List<String> selectedMuscles = Arrays.stream(muscleParam.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isBlank() && !s.equalsIgnoreCase("all"))
                    .map(s -> s.toLowerCase(Locale.ROOT))
                    .toList();

            if (!selectedMuscles.isEmpty()) {
                allExercises = allExercises.stream()
                        .filter(e -> {
                            if (e.muscleGroup() == null || e.muscleGroup().isBlank()) return false;
                            String itemMuscle = e.muscleGroup().toLowerCase(Locale.ROOT);
                            return selectedMuscles.stream().anyMatch(selected ->
                                    itemMuscle.contains(selected) || selected.contains(itemMuscle)
                            );
                        })
                        .toList();
            }
        }

        // 4. Filter by Search Query with Keyword Prioritization (Priority 1: Name, Priority 2: Muscle Group)
        if (search != null && !search.trim().isBlank()) {
            final String q = search.trim().toLowerCase(Locale.ROOT);
            allExercises = allExercises.stream()
                    .filter(e -> (e.name() != null && e.name().toLowerCase(Locale.ROOT).contains(q)) ||
                                 (e.muscleGroup() != null && e.muscleGroup().toLowerCase(Locale.ROOT).contains(q)) ||
                                 (e.equipment() != null && e.equipment().toLowerCase(Locale.ROOT).contains(q)) ||
                                 (e.description() != null && e.description().toLowerCase(Locale.ROOT).contains(q)))
                    .sorted((a, b) -> {
                        boolean aName = a.name() != null && a.name().toLowerCase(Locale.ROOT).contains(q);
                        boolean bName = b.name() != null && b.name().toLowerCase(Locale.ROOT).contains(q);
                        if (aName && !bName) return -1;
                        if (!aName && bName) return 1;

                        boolean aMuscle = a.muscleGroup() != null && a.muscleGroup().toLowerCase(Locale.ROOT).contains(q);
                        boolean bMuscle = b.muscleGroup() != null && b.muscleGroup().toLowerCase(Locale.ROOT).contains(q);
                        if (aMuscle && !bMuscle) return -1;
                        if (!aMuscle && bMuscle) return 1;

                        return 0;
                    })
                    .toList();
        }

        int totalItems = allExercises.size();
        int safePage = Math.max(1, page);
        int safeSize = Math.max(1, size);
        int totalPages = (int) Math.ceil((double) totalItems / safeSize);
        if (totalPages == 0) totalPages = 1;

        int fromIndex = Math.min((safePage - 1) * safeSize, totalItems);
        int toIndex = Math.min(fromIndex + safeSize, totalItems);
        List<ExerciseListItem> pagedItems = allExercises.subList(fromIndex, toIndex);

        return new PagedExerciseListResponse(
                pagedItems,
                totalItems,
                totalPages,
                safePage,
                safeSize
        );
    }

    @Transactional(readOnly = true)
    public PagedExerciseListResponse getMemberExercises(
            String level,
            String muscleGroup,
            String muscles,
            String search,
            int page,
            int size,
            String userEmail
    ) {
        return getExercises("all", "member", level, muscleGroup, muscles, search, page, size, userEmail);
    }

    @Transactional
    public ExerciseListItem createMemberExercise(CreateMemberExerciseRequest req, String userEmail) {
        String name = req.name() != null ? req.name().trim() : "Untitled Custom Exercise";
        String mg = req.muscleGroup() != null && !req.muscleGroup().isBlank() ? req.muscleGroup().trim() : "Full body";
        String lvl = req.level() != null && !req.level().isBlank() ? req.level().trim() : "Intermediate";
        String equip = req.equipment() != null && !req.equipment().isBlank() ? req.equipment().trim() : "Bodyweight";
        int sets = req.sets() != null && req.sets() > 0 ? req.sets() : 3;
        String reps = req.repsOrDuration() != null && !req.repsOrDuration().isBlank() ? req.repsOrDuration().trim() : "10 reps";
        String desc = req.description() != null ? req.description().trim() : "Member customized calisthenics movement.";
        String details = mg + " • " + sets + " sets • " + reps + " • " + equip;

        Long newId = System.currentTimeMillis();
        String code = "MEM-" + (newId % 10000);

        if (userEmail != null && !userEmail.isBlank()) {
            User user = userRepository.findByEmail(userEmail).orElse(null);
            if (user != null) {
                Exercise me = new Exercise();
                me.setName(name);
                me.setType("HEALTH");
                me.setCategory(req.category() != null ? req.category() : "Custom");
                me.setDifficultyLevel(lvl);
                me.setInstructions(desc);
                me.setDefaultSets(sets);
                try {
                    me.setDefaultReps(Integer.parseInt(reps.replaceAll("\\D+", "")));
                } catch (Exception ignored) {
                    me.setDefaultReps(10);
                }
                me.setSource("MEMBER");
                me.setStatus("ACTIVE");
                me.setCreatedBy(user);
                Exercise saved = erdExerciseRepository.save(me);
                newId = saved.getId();
                code = "MEM-" + newId;
            }
        }

        ExerciseListItem newItem = new ExerciseListItem(
                newId,
                code,
                name,
                "HEALTH",
                "MEMBER",
                req.category() != null ? req.category() : "Custom",
                mg,
                sets,
                reps,
                "Custom",
                equip,
                lvl,
                details,
                desc,
                null
        );

        customSessionExercises.add(0, newItem);
        return newItem;
    }

    private List<ExerciseListItem> loadAllExercises(String userEmail) {
        List<ExerciseListItem> list = new ArrayList<>();

        // 1. Load system exercises from database
        List<ExerciseEntry> dbEntries = exerciseRepository.findAll();
        if (!dbEntries.isEmpty()) {
            for (ExerciseEntry e : dbEntries) {
                String typeStr = e.getType() != null ? e.getType().name() : "HEALTH";
                String mg = e.getMuscleGroup() != null ? e.getMuscleGroup() : "Full body";
                String equip = "Bodyweight";
                if (mg.equalsIgnoreCase("Back")) {
                    equip = "Pull-up bar";
                } else if (e.getName() != null && e.getName().toLowerCase().contains("dip")) {
                    equip = "Parallel bars";
                }
                String details = mg + " • 3 sets • 12 reps • " + equip;
                list.add(new ExerciseListItem(
                        e.getId(),
                        e.getCode(),
                        e.getName(),
                        typeStr,
                        "SYSTEM",
                        e.getCategory(),
                        mg,
                        3,
                        "12 reps",
                        e.getCategory(),
                        equip,
                        e.getLevel() != null ? e.getLevel() : "Beginner",
                        details,
                        e.getDescription(),
                        e.getDemoVideoUrl()
                ));
            }
        }

        // 2. If system exercises in DB are few, supplement with standard CalisHealth catalog
        long systemCount = list.stream().filter(e -> "SYSTEM".equalsIgnoreCase(e.source())).count();
        if (systemCount < 6) {
            list.addAll(getSeedExercises());
        }

        // 3. Add custom session exercises
        list.addAll(customSessionExercises);

        // 4. Load Member exercises from database (if member is logged in)
        if (userEmail != null && !userEmail.isBlank()) {
            try {
                List<Exercise> memberDbExercises = erdExerciseRepository.findMemberExercises(userEmail);
                for (Exercise me : memberDbExercises) {
                    String mg = "Full body";
                    if (me.getMuscleGroups() != null && !me.getMuscleGroups().isEmpty()) {
                        mg = me.getMuscleGroups().get(0).getMuscleGroup().getName();
                    }
                    String equip = "Bodyweight";
                    int sets = me.getDefaultSets() != null ? me.getDefaultSets() : 3;
                    String reps = (me.getDefaultReps() != null ? me.getDefaultReps() : 10) + " reps";
                    String details = mg + " • " + sets + " sets • " + reps + " • " + equip;

                    list.add(new ExerciseListItem(
                            me.getId(),
                            "MEM-" + me.getId(),
                            me.getName(),
                            "HEALTH",
                            "MEMBER",
                            me.getCategory() != null ? me.getCategory() : "Custom",
                            mg,
                            sets,
                            reps,
                            "Custom",
                            equip,
                            me.getDifficultyLevel() != null ? me.getDifficultyLevel() : "Intermediate",
                            details,
                            me.getInstructions(),
                            me.getVideoUrl()
                    ));
                }
            } catch (Exception ex) {
                // Ignore fallback
            }
        }

        // 5. If no member exercises found yet, provide starter seed member exercises
        long memberCount = list.stream().filter(e -> "MEMBER".equalsIgnoreCase(e.source())).count();
        if (memberCount == 0) {
            list.addAll(getSeedMemberExercises());
        }

        return list;
    }

    private List<ExerciseListItem> getSeedExercises() {
        return List.of(
            // Health - Full body
            new ExerciseListItem(101L, "EX-001", "Jumping jacks", "HEALTH", "SYSTEM", "Cardio", "Full body", 3, "30 sec", "Cardio", "Bodyweight", "Beginner", "Full body • 3 sets • 30 sec • Bodyweight", "Classic aerobic calisthenic drill that elevates heart rate and engages the entire body.", null),
            new ExerciseListItem(102L, "EX-002", "Burpees", "HEALTH", "SYSTEM", "Cardio", "Full body", 3, "15 reps", "Cardio", "Bodyweight", "Intermediate", "Full body • 3 sets • 15 reps • Bodyweight", "High intensity full-body movement that develops endurance, explosive power, and stamina.", null),
            new ExerciseListItem(103L, "EX-003", "Mountain climbers", "HEALTH", "SYSTEM", "Endurance", "Full body", 3, "40 sec", "Endurance", "Bodyweight", "Beginner", "Full body • 3 sets • 40 sec • Bodyweight", "Dynamic core and cardio exercise that improves agility and core stabilization.", null),

            // Health - Chest
            new ExerciseListItem(104L, "EX-004", "Standard Push-up", "HEALTH", "SYSTEM", "Strength", "Chest", 3, "12 reps", "Strength", "Bodyweight", "Beginner", "Chest • 3 sets • 12 reps • Bodyweight", "The foundational horizontal pushing exercise building upper chest, shoulders, and triceps.", null),
            new ExerciseListItem(105L, "EX-005", "Diamond Push-up", "HEALTH", "SYSTEM", "Strength", "Chest", 3, "10 reps", "Strength", "Bodyweight", "Intermediate", "Chest • 3 sets • 10 reps • Bodyweight", "Close-grip variation emphasizing inner pecs and tricep extension strength.", null),
            new ExerciseListItem(106L, "EX-006", "Incline Push-up", "HEALTH", "SYSTEM", "Strength", "Chest", 3, "15 reps", "Strength", "Elevated surface", "Beginner", "Chest • 3 sets • 15 reps • Elevated surface", "Elevated hand push-ups ideal for beginners perfecting shoulder alignment and chest contraction.", null),

            // Health - Back
            new ExerciseListItem(107L, "EX-007", "Pull-up", "HEALTH", "SYSTEM", "Strength", "Back", 3, "8 reps", "Strength", "Pull-up bar", "Intermediate", "Back • 3 sets • 8 reps • Pull-up bar", "The king of bodyweight vertical pulling movements targeting the latissimus dorsi and biceps.", null),
            new ExerciseListItem(108L, "EX-008", "Australian Pull-up", "HEALTH", "SYSTEM", "Strength", "Back", 3, "12 reps", "Strength", "Low bar", "Beginner", "Back • 3 sets • 12 reps • Low bar", "Horizontal row on a low bar, building scapular retraction and posture strength.", null),
            new ExerciseListItem(109L, "EX-009", "Chin-up", "HEALTH", "SYSTEM", "Strength", "Back", 3, "8 reps", "Strength", "Pull-up bar", "Intermediate", "Back • 3 sets • 8 reps • Pull-up bar", "Supinated grip pull-up focusing on biceps and lower lats.", null),

            // Health - Legs
            new ExerciseListItem(110L, "EX-010", "Bodyweight Squat", "HEALTH", "SYSTEM", "Strength", "Legs", 3, "15 reps", "Strength", "Bodyweight", "Beginner", "Legs • 3 sets • 15 reps • Bodyweight", "Primary lower-body movement for developing knee flexion, quad endurance, and glute activation.", null),
            new ExerciseListItem(111L, "EX-011", "Bulgarian Split Squat", "HEALTH", "SYSTEM", "Strength", "Legs", 3, "10 reps", "Strength", "Bench", "Intermediate", "Legs • 3 sets • 10 reps • Bench", "Unilateral leg exercise strengthening quads, glutes, and fixing leg strength imbalances.", null),
            new ExerciseListItem(112L, "EX-012", "Walking Lunges", "HEALTH", "SYSTEM", "Endurance", "Legs", 3, "20 steps", "Endurance", "Bodyweight", "Beginner", "Legs • 3 sets • 20 steps • Bodyweight", "Great lower body cardio and stabilizer builder for hip flexors and quads.", null),

            // Health - Core
            new ExerciseListItem(113L, "EX-013", "Plank", "HEALTH", "SYSTEM", "Stability", "Core", 3, "45 sec", "Stability", "Bodyweight", "Beginner", "Core • 3 sets • 45 sec • Bodyweight", "Isometric core exercise holding rigid hollow body alignment to protect the lower spine.", null),
            new ExerciseListItem(114L, "EX-014", "Hanging Knee Raise", "HEALTH", "SYSTEM", "Strength", "Core", 3, "12 reps", "Strength", "Pull-up bar", "Intermediate", "Core • 3 sets • 12 reps • Pull-up bar", "Bar-hanging abdominal drill targeting the lower abs and hip flexors.", null),
            new ExerciseListItem(115L, "EX-015", "Hollow Body Hold", "HEALTH", "SYSTEM", "Stability", "Core", 3, "30 sec", "Stability", "Bodyweight", "Intermediate", "Core • 3 sets • 30 sec • Bodyweight", "Gymnastic staple holding posterior pelvic tilt to solidify bodyweight stability.", null),

            // Health - Arm/Shoulders
            new ExerciseListItem(116L, "EX-016", "Pike Push-up", "HEALTH", "SYSTEM", "Strength", "Arm/Shoulders", 3, "10 reps", "Strength", "Bodyweight", "Intermediate", "Arm/Shoulders • 3 sets • 10 reps • Bodyweight", "Vertical pushing angle transitioning chest drive directly into the anterior deltoids.", null),
            new ExerciseListItem(117L, "EX-017", "Parallel Bar Dips", "HEALTH", "SYSTEM", "Strength", "Arm/Shoulders", 3, "10 reps", "Strength", "Parallel bars", "Intermediate", "Arm/Shoulders • 3 sets • 10 reps • Parallel bars", "High-load bodyweight dip targeting lateral triceps and lower chest fibers.", null),
            new ExerciseListItem(118L, "EX-018", "Bench Dips", "HEALTH", "SYSTEM", "Strength", "Arm/Shoulders", 3, "12 reps", "Strength", "Bench", "Beginner", "Arm/Shoulders • 3 sets • 12 reps • Bench", "Accessible tricep flexion drill for building pushing lock-out strength.", null),

            // Skills
            new ExerciseListItem(201L, "SK-001", "Handstand Hold", "SKILL", "SYSTEM", "Skill", "Arm/Shoulders", 4, "20 sec", "Skill", "Wall / Floor", "Intermediate", "Arm/Shoulders • 4 sets • 20 sec • Wall / Floor", "Balance drill on hands demanding wrist mobility, shoulder flexion, and overhead stability.", null),
            new ExerciseListItem(202L, "SK-002", "Handstand Push-up", "SKILL", "SYSTEM", "Skill", "Arm/Shoulders", 3, "5 reps", "Skill", "Wall / Floor", "Advanced", "Arm/Shoulders • 3 sets • 5 reps • Wall / Floor", "Elite vertical pressing calisthenic skill lifting 100% of body mass overhead.", null),
            new ExerciseListItem(203L, "SK-003", "Bar Muscle-up", "SKILL", "SYSTEM", "Skill", "Full body", 3, "5 reps", "Skill", "Pull-up bar", "Advanced", "Full body • 3 sets • 5 reps • Pull-up bar", "Explosive transition from pull-up into straight-bar dip above the bar.", null),
            new ExerciseListItem(204L, "SK-004", "Front Lever Tuck", "SKILL", "SYSTEM", "Skill", "Back", 4, "15 sec", "Skill", "Pull-up bar", "Intermediate", "Back • 4 sets • 15 sec • Pull-up bar", "Horizontal straight-arm isometric pull engaging extreme latissimus activation.", null),
            new ExerciseListItem(205L, "SK-005", "Full Front Lever", "SKILL", "SYSTEM", "Skill", "Back", 3, "8 sec", "Skill", "Pull-up bar", "Advanced", "Back • 3 sets • 8 sec • Pull-up bar", "Legendary calisthenics static hold suspending the body parallel to the ground.", null),
            new ExerciseListItem(206L, "SK-006", "L-Sit", "SKILL", "SYSTEM", "Skill", "Core", 4, "20 sec", "Skill", "Parallel bars", "Intermediate", "Core • 4 sets • 20 sec • Parallel bars", "Support hold lifting legs 90 degrees with active scapular depression.", null),
            new ExerciseListItem(207L, "SK-007", "V-Sit Hold", "SKILL", "SYSTEM", "Skill", "Core", 3, "15 sec", "Skill", "Floor", "Advanced", "Core • 3 sets • 15 sec • Floor", "Compression progression lifting legs past 45 degrees towards the torso.", null),
            new ExerciseListItem(208L, "SK-008", "Pistol Squat", "SKILL", "SYSTEM", "Skill", "Legs", 3, "8 reps", "Skill", "Bodyweight", "Advanced", "Legs • 3 sets • 8 reps • Bodyweight", "Single-leg deep squat requiring maximum ankle dorsiflexion, balance, and quad power.", null),
            new ExerciseListItem(209L, "SK-009", "Archer Push-up", "SKILL", "SYSTEM", "Skill", "Chest", 3, "8 reps", "Skill", "Bodyweight", "Intermediate", "Chest • 3 sets • 8 reps • Bodyweight", "Lateral shifting push-up isolating one side horizontally while straight-arm stabilizing the other.", null),
            new ExerciseListItem(210L, "SK-010", "One-Arm Push-up", "SKILL", "SYSTEM", "Skill", "Chest", 3, "5 reps", "Skill", "Bodyweight", "Advanced", "Chest • 3 sets • 5 reps • Bodyweight", "Ultimate horizontal pressing test demanding anti-rotational core torque and unilateral chest strength.", null)
        );
    }

    private List<ExerciseListItem> getSeedMemberExercises() {
        return List.of(
            new ExerciseListItem(301L, "MEM-001", "Custom Archer Push-up", "HEALTH", "MEMBER", "Strength", "Chest", 3, "10 reps", "Strength", "Bodyweight", "Intermediate", "Chest • 3 sets • 10 reps • Bodyweight", "Member custom progression emphasizing asymmetric horizontal pushing power.", null),
            new ExerciseListItem(302L, "MEM-002", "Doorframe Bodyweight Rows", "HEALTH", "MEMBER", "Strength", "Back", 3, "12 reps", "Strength", "Doorframe", "Beginner", "Back • 3 sets • 12 reps • Doorframe", "Home-calisthenics pulling variation using household doorframe for scapular traction.", null),
            new ExerciseListItem(303L, "MEM-003", "Chair Elevated Dips", "HEALTH", "MEMBER", "Strength", "Arm/Shoulders", 3, "12 reps", "Strength", "Chair", "Beginner", "Arm/Shoulders • 3 sets • 12 reps • Chair", "Accessible triceps dipping variation using stable living room chairs.", null),
            new ExerciseListItem(304L, "MEM-004", "Bulgarian Split Squat Variation", "HEALTH", "MEMBER", "Strength", "Legs", 3, "10 reps", "Strength", "Chair / Bench", "Intermediate", "Legs • 3 sets • 10 reps • Chair / Bench", "Single leg rear-foot elevated drill customized for quad hypertrophy.", null)
        );
    }
}
