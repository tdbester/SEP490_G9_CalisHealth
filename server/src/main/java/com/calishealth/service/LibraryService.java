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
import java.util.Objects;

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

    public ExerciseListItem getExerciseById(String idOrSlug) {
        if (idOrSlug == null || idOrSlug.isBlank()) {
            return getDefaultDiamondPushup();
        }

        try {
            Long numericId = Long.parseLong(idOrSlug);
            var found = erdExerciseRepository.findById(numericId);
            if (found.isPresent()) {
                return mapExerciseEntityToDto(found.get());
            }
        } catch (NumberFormatException ignored) {}

        List<ExerciseListItem> all = new ArrayList<>(getSeedExercises());
        all.addAll(getSeedMemberExercises());
        all.addAll(customSessionExercises);

        for (ExerciseListItem item : all) {
            if (String.valueOf(item.id()).equals(idOrSlug) ||
                (item.code() != null && item.code().equalsIgnoreCase(idOrSlug)) ||
                (item.name() != null && item.name().toLowerCase().replace(" ", "-").equals(idOrSlug.toLowerCase()))) {
                return item;
            }
        }

        return getDefaultDiamondPushup();
    }

    private ExerciseListItem mapExerciseEntityToDto(Exercise e) {
        String mg = "Full body";
        if (e.getMuscleGroups() != null && !e.getMuscleGroups().isEmpty()) {
            List<String> names = e.getMuscleGroups().stream()
                .map(emg -> emg.getMuscleGroup() != null ? emg.getMuscleGroup().getName() : null)
                .filter(Objects::nonNull)
                .toList();
            if (!names.isEmpty()) {
                mg = String.join(", ", names);
            }
        }

        int sets = e.getDefaultSets() != null ? e.getDefaultSets() : 3;
        String reps = (e.getDefaultReps() != null ? e.getDefaultReps() : 10) + " reps";
        String equip = "Bodyweight";
        if (mg.toLowerCase().contains("back")) {
            equip = "Pull-up bar";
        } else if (e.getName() != null && e.getName().toLowerCase().contains("dip")) {
            equip = "Parallel bars";
        }

        String details = mg + " • " + sets + " sets • " + reps + " • " + equip;
        String desc = e.getInstructions();
        if (desc == null || desc.isBlank()) {
            desc = e.getExecutionSteps();
        }
        if (desc == null || desc.isBlank()) {
            desc = "Standard calisthenics bodyweight exercise.";
        }

        String videoUrl = e.getVideoUrl();
        if (videoUrl == null && e.getDemoMedia() != null) {
            videoUrl = e.getDemoMedia().getFileUrl();
        }

        String source = e.getSource() != null ? e.getSource() : "SYSTEM";
        String code = "EX-" + e.getId();

        return new ExerciseListItem(
            e.getId(),
            code,
            e.getName(),
            e.getType() != null ? e.getType() : "HEALTH",
            source,
            e.getCategory() != null ? e.getCategory() : "General",
            mg,
            sets,
            reps,
            e.getCategory() != null ? e.getCategory() : "Strength",
            equip,
            e.getDifficultyLevel() != null ? e.getDifficultyLevel() : "Beginner",
            details,
            desc,
            videoUrl
        );
    }

    private ExerciseListItem getDefaultDiamondPushup() {
        return new ExerciseListItem(
            999L,
            "EX-099",
            "Diamond push-up",
            "HEALTH",
            "SYSTEM",
            "Strength",
            "Chest, Triceps",
            3,
            "8 reps",
            "Strength",
            "Bodyweight",
            "Intermediate",
            "Chest, triceps • 3 sets • 8 reps",
            "A push-up variation where your hands form a diamond under the chest. It shifts more of the load onto the triceps and inner chest, and is a solid stepping stone toward archer and one-arm push-ups.",
            null
        );
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
                    list.add(mapExerciseEntityToDto(me));
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
            // Health - Top 6 matching Figma mockup screenshot
            new ExerciseListItem(101L, "EX-001", "Jumping jacks", "HEALTH", "SYSTEM", "Cardio", "Full body", 3, "30 sec", "Cardio", "Bodyweight", "Beginner", "Full body • 3 sets • 30 sec", "Classic aerobic calisthenic drill that elevates heart rate and engages the entire body.", null),
            new ExerciseListItem(102L, "EX-002", "Mountain climbers", "HEALTH", "SYSTEM", "Endurance", "Core", 3, "30 sec", "Endurance", "Bodyweight", "Intermediate", "Core, cardio • 3 sets • 30 sec", "Dynamic core and cardio exercise that improves agility and core stabilization.", null),
            new ExerciseListItem(103L, "EX-003", "Burpees", "HEALTH", "SYSTEM", "Cardio", "Full body", 3, "10 reps", "Cardio", "Bodyweight", "Advanced", "Full body • 3 sets • 10 reps", "High intensity full-body movement that develops endurance, explosive power, and stamina.", null),
            new ExerciseListItem(104L, "EX-004", "Push-up", "HEALTH", "SYSTEM", "Strength", "Chest", 3, "8–12 reps", "Strength", "Bodyweight", "Beginner", "Chest, triceps • 3 sets • 8–12 reps", "The foundational horizontal pushing exercise building upper chest, shoulders, and triceps.", null),
            new ExerciseListItem(105L, "EX-005", "Pull-up", "HEALTH", "SYSTEM", "Strength", "Back", 3, "5–8 reps", "Strength", "Pull-up bar", "Intermediate", "Back, biceps • 3 sets • 5–8 reps", "The king of bodyweight vertical pulling movements targeting the latissimus dorsi and biceps.", null),
            new ExerciseListItem(106L, "EX-006", "Pistol squat", "HEALTH", "SYSTEM", "Strength", "Legs", 3, "5 reps", "Strength", "Bodyweight", "Advanced", "Legs, glutes • 3 sets • 5 reps", "Single-leg deep squat requiring maximum ankle dorsiflexion, balance, and quad power.", null),

            // Health - Core
            new ExerciseListItem(113L, "EX-013", "Plank", "HEALTH", "SYSTEM", "Stability", "Core", 3, "45 sec", "Stability", "Bodyweight", "Beginner", "Core • 3 sets • 45 sec • Bodyweight", "Isometric core exercise holding rigid hollow body alignment to protect the lower spine.", null),
            new ExerciseListItem(114L, "EX-014", "Hanging Knee Raise", "HEALTH", "SYSTEM", "Strength", "Core", 3, "12 reps", "Strength", "Pull-up bar", "Intermediate", "Core • 3 sets • 12 reps • Pull-up bar", "Bar-hanging abdominal drill targeting the lower abs and hip flexors.", null),
            new ExerciseListItem(115L, "EX-015", "Hollow Body Hold", "HEALTH", "SYSTEM", "Stability", "Core", 3, "30 sec", "Stability", "Bodyweight", "Intermediate", "Core • 3 sets • 30 sec • Bodyweight", "Gymnastic staple holding posterior pelvic tilt to solidify bodyweight stability.", null),

            // Health - Arm/Shoulders
            new ExerciseListItem(116L, "EX-016", "Pike Push-up", "HEALTH", "SYSTEM", "Strength", "Arm/Shoulders", 3, "10 reps", "Strength", "Bodyweight", "Intermediate", "Arm/Shoulders • 3 sets • 10 reps • Bodyweight", "Vertical pushing angle transitioning chest drive directly into the anterior deltoids.", null),
            new ExerciseListItem(117L, "EX-017", "Parallel Bar Dips", "HEALTH", "SYSTEM", "Strength", "Arm/Shoulders", 3, "10 reps", "Strength", "Parallel bars", "Intermediate", "Arm/Shoulders • 3 sets • 10 reps • Parallel bars", "High-load bodyweight dip targeting lateral triceps and lower chest fibers.", null),
            new ExerciseListItem(118L, "EX-018", "Bench Dips", "HEALTH", "SYSTEM", "Strength", "Arm/Shoulders", 3, "12 reps", "Strength", "Bench", "Beginner", "Arm/Shoulders • 3 sets • 12 reps • Bench", "Accessible tricep flexion drill for building pushing lock-out strength.", null),

            // Skills (Chuẩn 100% theo Mockup Figma)
            new ExerciseListItem(201L, "SK-001", "Wall handstand hold", "SKILL", "SYSTEM", "Skill", "Shoulders", 4, "30 sec", "Handstand", "Wall / Floor", "Beginner", "Shoulders, core • 4 sets • 30 sec • Handstand", "Balance drill on hands demanding wrist mobility, shoulder flexion, and overhead stability.", null),
            new ExerciseListItem(202L, "SK-002", "Handstand push-up", "SKILL", "SYSTEM", "Skill", "Shoulders", 3, "5 reps", "Handstand", "Wall / Floor", "Advanced", "Shoulders, triceps • 3 sets • 5 reps • Handstand", "Elite vertical pressing calisthenic skill lifting 100% of body mass overhead.", null),
            new ExerciseListItem(203L, "SK-003", "Explosive pull-up", "SKILL", "SYSTEM", "Skill", "Back", 4, "5 reps", "Muscle-up", "Pull-up bar", "Intermediate", "Back, arms • 4 sets • 5 reps • Muscle-up", "Explosive transition building power for muscle-up.", null),
            new ExerciseListItem(204L, "SK-004", "Straight bar dip", "SKILL", "SYSTEM", "Skill", "Chest", 3, "8 reps", "Muscle-up", "Straight bar", "Intermediate", "Chest, triceps • 3 sets • 8 reps • Muscle-up", "Bar dip drill developing pressing strength above the bar.", null),
            new ExerciseListItem(205L, "SK-005", "Tuck front lever", "SKILL", "SYSTEM", "Skill", "Back", 4, "10 sec", "Front lever", "Pull-up bar", "Intermediate", "Back, core • 4 sets • 10 sec • Front lever", "Horizontal straight-arm isometric pull engaging extreme latissimus activation.", null),
            new ExerciseListItem(206L, "SK-006", "Advanced tuck front lever", "SKILL", "SYSTEM", "Skill", "Back", 4, "8 sec", "Front lever", "Pull-up bar", "Advanced", "Back, core • 4 sets • 8 sec • Front lever", "Legendary calisthenics static hold progression.", null)
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
