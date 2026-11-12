package com.calishealth.service;

import com.calishealth.dtos.LibraryDtos.CreateMemberExerciseRequest;
import com.calishealth.dtos.LibraryDtos.ExerciseCounts;
import com.calishealth.dtos.LibraryDtos.ExerciseListItem;
import com.calishealth.dtos.LibraryDtos.FitnessLevelOption;
import com.calishealth.dtos.LibraryDtos.LibrarySummaryResponse;
import com.calishealth.dtos.LibraryDtos.PagedExerciseListResponse;
import com.calishealth.dtos.LibraryDtos.WorkoutCounts;
import com.calishealth.dtos.LibraryOverviewDTO;
import com.calishealth.models.Exercise;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LibraryService {
    private final ExerciseRepository exerciseRepository;
    private final WorkoutRepository workoutRepository;
    private final UserRepository userRepository;
    private final ExerciseMuscleGroupCatalog muscleGroupCatalog;
    private final FitnessLevelRepository fitnessLevels;
    private final SystemNotificationService systemNotifications;
    private final ContentNameGuardService contentNameGuard;

    // Không còn cache bài tập trong RAM. Trước đây mọi bài tạo khi không resolve
    // được user được nhét vào list này và bị trả cho MỌI người gọi API (kể cả
    // guest), vừa rò rỉ dữ liệu vừa không an toàn khi chạy đa luồng.
    // Giờ mọi bài tạo đều phải đăng nhập và được lưu vào DB.

    @Transactional(readOnly = true)
    public ExerciseCounts getExerciseCounts(String userEmail) {
        long healthCount = exerciseRepository.countAcceptedSystemExercisesByType("HEALTH");
        long skillCount = exerciseRepository.countAcceptedSystemExercisesByType("SKILL");
        long memberCount = exerciseRepository.countPublishedCommunityMemberExercises();

        return new ExerciseCounts(healthCount, skillCount, memberCount);
    }

    /**
     * Danh sách level của hệ thống, sắp theo score_min. Level do Content Manager cấu hình động
     * trong Level & Benchmark Criteria nên client lấy từ đây thay vì hard-code.
     */
    @Transactional(readOnly = true)
    public List<FitnessLevelOption> getFitnessLevels() {
        return fitnessLevels.findAll().stream()
                .sorted(Comparator.comparingInt(FitnessLevel::getScoreMin)
                        .thenComparing(FitnessLevel::getName, String.CASE_INSENSITIVE_ORDER))
                .map(level -> new FitnessLevelOption(
                        level.getId(),
                        level.getName(),
                        level.getScoreMin(),
                        level.getScoreMax(),
                        level.getStatus()))
                .toList();
    }

    private String entryLevelLabel(String level) {
        if (level == null || level.isBlank()) {
            return defaultLevelName();
        }
        String normalized = level.toLowerCase(Locale.ROOT);
        return Character.toUpperCase(normalized.charAt(0)) + normalized.substring(1);
    }

    /**
     * Level mặc định khi bài tập chưa gán level: level thấp nhất đang cấu hình trong
     * `fitness_levels` (theo score_min). Không hard-code "Beginner" vì Content Manager có thể
     * tạo level mới hoặc đổi tên level cũ.
     */
    private String defaultLevelName() {
        return fitnessLevels.findAll().stream()
                .filter(level -> "ACTIVE".equalsIgnoreCase(level.getStatus()))
                .min(Comparator.comparingInt(FitnessLevel::getScoreMin)
                        .thenComparing(FitnessLevel::getName, String.CASE_INSENSITIVE_ORDER))
                .map(FitnessLevel::getName)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public LibrarySummaryResponse getSummary(String userEmail) {
        ExerciseCounts exerciseCounts = getExerciseCounts(userEmail);
        // Workout FLEX xuất hiện ở cả tab Health và tab Skill nên số liệu
        // tổng quan cũng tính FLEX vào cả hai bên (khớp với danh sách).
        long healthWorkouts = workoutRepository.countSystemWorkoutsByTypes(List.of("HEALTH", "FLEX"));
        long skillWorkouts = workoutRepository.countSystemWorkoutsByTypes(List.of("SKILL", "FLEX"));
        long customWorkouts = workoutRepository
                .countBySourceAndTemplateStatusAndModerationStatusAndSharedWithCommunityTrue(
                        "CUSTOM", "PUBLISHED", "ACTIVE");

        return new LibrarySummaryResponse(
            exerciseCounts,
            new WorkoutCounts(healthWorkouts, skillWorkouts, customWorkouts)
        );
    }

    /**
     * Số liệu tổng quan của Library.
     *
     * GUEST (chưa đăng nhập) cũng xem được trang Library nên {@code userEmail}
     * có thể null — khi đó các nhóm nội dung do Member tạo (bài tập cá nhân,
     * workout tuỳ chỉnh) trả về 0 vì guest không sở hữu nội dung nào.
     */
    @Transactional(readOnly = true)
    public LibraryOverviewDTO getOverview(String userEmail) {
        Long memberId = null;
        if (userEmail != null && !userEmail.isBlank()) {
            User member = userRepository.findByEmail(userEmail).orElse(null);
            if (member == null) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "The signed-in user no longer exists");
            }
            // Chỉ MEMBER mới sở hữu nội dung cá nhân. Content Manager / Admin
            // vẫn xem được số liệu tổng quan của thư viện (phần nội dung do
            // họ tạo sẽ là 0) thay vì bị chặn 403.
            if (member.getRole() == UserRole.MEMBER) {
                memberId = member.getId();
            }
        }

        return new LibraryOverviewDTO(
                exerciseRepository.countAcceptedSystemExercisesByType("HEALTH"),
                exerciseRepository.countAcceptedSystemExercisesByType("SKILL"),
                memberId == null ? 0L : exerciseRepository.countAcceptedMemberExercisesByAuthorId(memberId),
                workoutRepository.countSystemWorkoutsByTypes(List.of("HEALTH", "FLEX")),
                workoutRepository.countSystemWorkoutsByTypes(List.of("SKILL", "FLEX")),
                memberId == null ? 0L : workoutRepository.countCustomWorkoutsByAuthorId(memberId)
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
                        .filter(e -> isMemberSource(e.source()))
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
                        .filter(e -> isMemberSource(e.source()))
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
        // Bài tập cá nhân luôn thuộc về một member cụ thể nên bắt buộc đăng nhập.
        // Trước đây khi không có phiên, bài tạo được nhét vào list in-memory dùng
        // chung và bị trả cho mọi người gọi API (kể cả guest).
        if (userEmail == null || userEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                    "Sign in to create a custom exercise");
        }
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "The signed-in user no longer exists"));

        String name = req.name() != null ? req.name().trim() : "Untitled Custom Exercise";
        // Tên bài tập không được trùng tuyệt đối với tên của một workout nào.
        contentNameGuard.assertExerciseNameNotUsedByWorkout(name, null);
        // Tên bài tập cũng phải duy nhất trong DB (không phân biệt hoa thường,
        // bỏ khoảng trắng thừa) — kể cả với bài do chính member đó tạo trước đó.
        if (exerciseRepository.existsNotDeletedByNameIgnoreCase(name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Exercise title already exists. Choose a different title.");
        }
        String mg = req.muscleGroup() != null && !req.muscleGroup().isBlank() ? req.muscleGroup().trim() : "Full body";
        muscleGroupCatalog.validate(mg);
        String lvl = resolveLevelName(req.level());
        String equip = req.equipment() != null && !req.equipment().isBlank() ? req.equipment().trim() : "Bodyweight";
        int sets = req.sets() != null && req.sets() > 0 ? req.sets() : 3;
        String reps = req.repsOrDuration() != null && !req.repsOrDuration().isBlank() ? req.repsOrDuration().trim() : "10 reps";
        String desc = req.description() != null ? req.description().trim() : "Member customized calisthenics movement.";
        String details = mg + " • " + sets + " sets • " + reps + " • " + equip;
        Integer defaultReps = parseRepCount(reps);
        Integer duration = parseDurationSeconds(reps);
        String category = duration != null && defaultReps == null ? "HOLD" : "REPS";

        Exercise memberEntry = new Exercise();
        memberEntry.setCode("TMP-" + UUID.randomUUID().toString().replace("-", "").substring(0, 24));
        memberEntry.setName(name);
        memberEntry.setDescription(desc);
        memberEntry.setType("HEALTH");
        memberEntry.setSystem(false);
        memberEntry.setAuthor(user);
        memberEntry.setCreatedBy(user);
        memberEntry.setSource("CUSTOM");
        memberEntry.setStatus("PENDING");
        memberEntry.setActive(false);
        memberEntry.setCategory(category);
        memberEntry.setLevel(lvl);
        memberEntry.setDefaultSets(sets);
        memberEntry.setDefaultReps(defaultReps);
        memberEntry.setDefaultDuration(duration);
        memberEntry.setEquipment(equip);
        memberEntry.setGuide(desc);
        memberEntry.setSaveCount(0);
        Exercise saved = exerciseRepository.save(memberEntry);
        saved.setCode("CU_" + saved.getId());
        muscleGroupCatalog.assign(saved, mg);
        saved = exerciseRepository.save(saved);
        systemNotifications.notifyContentManagersPendingApproval(saved.getName());

        return new ExerciseListItem(
                saved.getId(),
                saved.getCode(),
                name,
                "HEALTH",
                "CUSTOM",
                category,
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
    }

    /**
     * Level do Content Manager quản lý trong Level & Benchmark Criteria nên tên level lấy động
     * từ bảng fitness_levels; không hard-code danh sách level.
     */
    private String resolveLevelName(String level) {
        if (level == null || level.isBlank()) {
            return fitnessLevels.findAll().stream()
                    .min(Comparator.comparingInt(FitnessLevel::getScoreMin)
                            .thenComparing(FitnessLevel::getName, String.CASE_INSENSITIVE_ORDER))
                    .map(FitnessLevel::getName)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "No exercise level is configured"));
        }
        return fitnessLevels.findByNameIgnoreCase(level.trim())
                .map(FitnessLevel::getName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Choose a valid exercise level"));
    }

    private Integer parseRepCount(String repsOrDuration) {
        String normalized = repsOrDuration.toLowerCase(Locale.ROOT);
        String number = normalized.replaceAll("\\D+", "");
        if (number.isBlank()) return null;
        int value = Integer.parseInt(number);
        return normalized.contains("sec") || normalized.contains("min") ? null : value;
    }

    private Integer parseDurationSeconds(String repsOrDuration) {
        String normalized = repsOrDuration.toLowerCase(Locale.ROOT);
        String number = normalized.replaceAll("\\D+", "");
        if (number.isBlank() || (!normalized.contains("sec") && !normalized.contains("min"))) return null;
        int value = Integer.parseInt(number);
        return normalized.contains("min") ? value * 60 : value;
    }

    public ExerciseListItem getExerciseById(String idOrSlug) {
        if (idOrSlug == null || idOrSlug.isBlank()) {
            return getDefaultDiamondPushup();
        }

        try {
            Long numericId = Long.parseLong(idOrSlug);
            // Chỉ trả bài tập HỆ THỐNG đang publish. Nếu lấy bất kỳ bài nào theo id
            // thì bài cá nhân của member (kể cả bài đang chờ duyệt / bị từ chối)
            // sẽ bị lộ qua endpoint này.
            var found = exerciseRepository.findAcceptedSystemById(numericId);
            if (found.isPresent()) {
                return mapExerciseEntityToDto(found.get());
            }
        } catch (NumberFormatException ignored) {}

        List<ExerciseListItem> all = new ArrayList<>(getSeedExercises());
        all.addAll(getSeedMemberExercises());

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

        String source = isMemberSource(e.getSource()) ? "CUSTOM" : "SYSTEM";
        String code = e.getCode();

        return new ExerciseListItem(
            e.getId(),
            code,
            e.getName(),
            e.getType() != null ? e.getType() : "HEALTH",
            source,
            e.getCategory() != null ? e.getCategory() : "REPS",
            mg,
            sets,
            reps,
            e.getGoal() != null ? e.getGoal().name() : "Strength",
            equip,
            e.getDifficultyLevel() != null ? e.getDifficultyLevel() : defaultLevelName(),
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
            "REPS",
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
        List<Exercise> dbEntries = exerciseRepository.findAll().stream()
                .filter(Exercise::isSystem)
                .filter(Exercise::isActive)
                .filter(exercise -> "ACTIVE".equalsIgnoreCase(exercise.getModerationStatus())
                        || "ACCEPTED".equalsIgnoreCase(exercise.getModerationStatus()))
                .toList();
        if (!dbEntries.isEmpty()) {
            for (Exercise e : dbEntries) {
                String typeStr = e.getType() != null ? e.getType() : "HEALTH";
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
                        entryLevelLabel(e.getLevel()),
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

        // 3. Load Member exercises from database (if member is logged in)
        if (userEmail != null && !userEmail.isBlank()) {
            try {
                List<Exercise> memberDbExercises = exerciseRepository.findMemberExercisesByEmail(userEmail);
                for (Exercise me : memberDbExercises) {
                    list.add(mapExerciseEntityToDto(me));
                }
            } catch (Exception ex) {
                // Ignore fallback
            }
        }

        // 4. If no member exercises found yet, provide starter seed member exercises
        long memberCount = list.stream().filter(e -> isMemberSource(e.source())).count();
        if (memberCount == 0) {
            list.addAll(getSeedMemberExercises());
        }

        return list;
    }

    private List<ExerciseListItem> getSeedExercises() {
        return List.of(
            // Health - Top 6 matching Figma mockup screenshot
            new ExerciseListItem(101L, "EX-001", "Jumping jacks", "HEALTH", "SYSTEM", "HOLD", "Full body", 3, "30 sec", "Cardio", "Bodyweight", "Beginner", "Full body • 3 sets • 30 sec", "Classic aerobic calisthenic drill that elevates heart rate and engages the entire body.", null),
            new ExerciseListItem(102L, "EX-002", "Mountain climbers", "HEALTH", "SYSTEM", "HOLD", "Core", 3, "30 sec", "Endurance", "Bodyweight", "Intermediate", "Core, cardio • 3 sets • 30 sec", "Dynamic core and cardio exercise that improves agility and core stabilization.", null),
            new ExerciseListItem(103L, "EX-003", "Burpees", "HEALTH", "SYSTEM", "REPS", "Full body", 3, "10 reps", "Cardio", "Bodyweight", "Advanced", "Full body • 3 sets • 10 reps", "High intensity full-body movement that develops endurance, explosive power, and stamina.", null),
            new ExerciseListItem(104L, "EX-004", "Push-up", "HEALTH", "SYSTEM", "REPS", "Chest", 3, "8–12 reps", "Strength", "Bodyweight", "Beginner", "Chest, triceps • 3 sets • 8–12 reps", "The foundational horizontal pushing exercise building upper chest, shoulders, and triceps.", null),
            new ExerciseListItem(105L, "EX-005", "Pull-up", "HEALTH", "SYSTEM", "REPS", "Back", 3, "5–8 reps", "Strength", "Pull-up bar", "Intermediate", "Back, biceps • 3 sets • 5–8 reps", "The king of bodyweight vertical pulling movements targeting the latissimus dorsi and biceps.", null),
            new ExerciseListItem(106L, "EX-006", "Pistol squat", "HEALTH", "SYSTEM", "REPS", "Legs", 3, "5 reps", "Strength", "Bodyweight", "Advanced", "Legs, glutes • 3 sets • 5 reps", "Single-leg deep squat requiring maximum ankle dorsiflexion, balance, and quad power.", null),

            // Health - Core
            new ExerciseListItem(113L, "EX-013", "Plank", "HEALTH", "SYSTEM", "HOLD", "Core", 3, "45 sec", "Stability", "Bodyweight", "Beginner", "Core • 3 sets • 45 sec • Bodyweight", "Isometric core exercise holding rigid hollow body alignment to protect the lower spine.", null),
            new ExerciseListItem(114L, "EX-014", "Hanging Knee Raise", "HEALTH", "SYSTEM", "REPS", "Core", 3, "12 reps", "Strength", "Pull-up bar", "Intermediate", "Core • 3 sets • 12 reps • Pull-up bar", "Bar-hanging abdominal drill targeting the lower abs and hip flexors.", null),
            new ExerciseListItem(115L, "EX-015", "Hollow Body Hold", "HEALTH", "SYSTEM", "HOLD", "Core", 3, "30 sec", "Stability", "Bodyweight", "Intermediate", "Core • 3 sets • 30 sec • Bodyweight", "Gymnastic staple holding posterior pelvic tilt to solidify bodyweight stability.", null),

            // Health - Arms and Shoulders
            new ExerciseListItem(116L, "EX-016", "Pike Push-up", "HEALTH", "SYSTEM", "REPS", "Arms, Shoulders", 3, "10 reps", "Strength", "Bodyweight", "Intermediate", "Arms, Shoulders • 3 sets • 10 reps • Bodyweight", "Vertical pushing angle transitioning chest drive directly into the anterior deltoids.", null),
            new ExerciseListItem(117L, "EX-017", "Parallel Bar Dips", "HEALTH", "SYSTEM", "REPS", "Arms, Shoulders", 3, "10 reps", "Strength", "Parallel bars", "Intermediate", "Arms, Shoulders • 3 sets • 10 reps • Parallel bars", "High-load bodyweight dip targeting lateral triceps and lower chest fibers.", null),
            new ExerciseListItem(118L, "EX-018", "Bench Dips", "HEALTH", "SYSTEM", "REPS", "Arms, Shoulders", 3, "12 reps", "Strength", "Bench", "Beginner", "Arms, Shoulders • 3 sets • 12 reps • Bench", "Accessible tricep flexion drill for building pushing lock-out strength.", null),

            // Skills (Chuẩn 100% theo Mockup Figma)
            new ExerciseListItem(201L, "SK-001", "Wall handstand hold", "SKILL", "SYSTEM", "HOLD", "Shoulders", 4, "30 sec", "Handstand", "Wall / Floor", "Beginner", "Shoulders, core • 4 sets • 30 sec • Handstand", "Balance drill on hands demanding wrist mobility, shoulder flexion, and overhead stability.", null),
            new ExerciseListItem(202L, "SK-002", "Handstand push-up", "SKILL", "SYSTEM", "REPS", "Shoulders", 3, "5 reps", "Handstand", "Wall / Floor", "Advanced", "Shoulders, triceps • 3 sets • 5 reps • Handstand", "Elite vertical pressing calisthenic skill lifting 100% of body mass overhead.", null),
            new ExerciseListItem(203L, "SK-003", "Explosive pull-up", "SKILL", "SYSTEM", "REPS", "Back", 4, "5 reps", "Muscle-up", "Pull-up bar", "Intermediate", "Back, arms • 4 sets • 5 reps • Muscle-up", "Explosive transition building power for muscle-up.", null),
            new ExerciseListItem(204L, "SK-004", "Straight bar dip", "SKILL", "SYSTEM", "REPS", "Chest", 3, "8 reps", "Muscle-up", "Straight bar", "Intermediate", "Chest, triceps • 3 sets • 8 reps • Muscle-up", "Bar dip drill developing pressing strength above the bar.", null),
            new ExerciseListItem(205L, "SK-005", "Tuck front lever", "SKILL", "SYSTEM", "HOLD", "Back", 4, "10 sec", "Front lever", "Pull-up bar", "Intermediate", "Back, core • 4 sets • 10 sec • Front lever", "Horizontal straight-arm isometric pull engaging extreme latissimus activation.", null),
            new ExerciseListItem(206L, "SK-006", "Advanced tuck front lever", "SKILL", "SYSTEM", "HOLD", "Back", 4, "8 sec", "Front lever", "Pull-up bar", "Advanced", "Back, core • 4 sets • 8 sec • Front lever", "Legendary calisthenics static hold progression.", null)
        );
    }

    private List<ExerciseListItem> getSeedMemberExercises() {
        return List.of(
            new ExerciseListItem(301L, "PER-001", "Custom Archer Push-up", "HEALTH", "CUSTOM", "REPS", "Chest", 3, "10 reps", "Strength", "Bodyweight", "Intermediate", "Chest • 3 sets • 10 reps • Bodyweight", "Member custom progression emphasizing asymmetric horizontal pushing power.", null),
            new ExerciseListItem(302L, "PER-002", "Doorframe Bodyweight Rows", "HEALTH", "CUSTOM", "REPS", "Back", 3, "12 reps", "Strength", "Doorframe", "Beginner", "Back • 3 sets • 12 reps • Doorframe", "Home-calisthenics pulling variation using household doorframe for scapular traction.", null),
            new ExerciseListItem(303L, "PER-003", "Chair Elevated Dips", "HEALTH", "CUSTOM", "REPS", "Arms, Shoulders", 3, "12 reps", "Strength", "Chair", "Beginner", "Arms, Shoulders • 3 sets • 12 reps • Chair", "Accessible triceps dipping variation using stable living room chairs.", null),
            new ExerciseListItem(304L, "PER-004", "Bulgarian Split Squat Variation", "HEALTH", "CUSTOM", "REPS", "Legs", 3, "10 reps", "Strength", "Chair / Bench", "Intermediate", "Legs • 3 sets • 10 reps • Chair / Bench", "Single leg rear-foot elevated drill customized for quad hypertrophy.", null)
        );
    }

    private static boolean isMemberSource(String source) {
        return "MEMBER".equalsIgnoreCase(source) || "CUSTOM".equalsIgnoreCase(source);
    }
}
