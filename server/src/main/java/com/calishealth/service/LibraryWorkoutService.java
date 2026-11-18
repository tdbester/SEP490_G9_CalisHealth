package com.calishealth.service;

import com.calishealth.dtos.*;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.exception.RequestValidationException;
import com.calishealth.models.Exercise;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.User;
import com.calishealth.models.WorkoutEntry;
import com.calishealth.models.WorkoutExerciseItem;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import com.calishealth.specification.WorkoutSpecification;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LibraryWorkoutService {
    private final WorkoutRepository workouts;
    private final ExerciseRepository exercises;
    private final UserRepository users;
    private final FitnessLevelRepository fitnessLevels;
    private final ContentNameGuardService contentNameGuard;
    private final ExerciseUnlockService unlockService;

    @Transactional(readOnly = true)
    public PageResponseDTO<WorkoutListItemDTO> getCommunityWorkouts(String memberEmail, WorkoutFilterRequestDTO filter) {
        return getWorkoutPage(memberEmail, filter, true);
    }

    @Transactional(readOnly = true)
    public PageResponseDTO<WorkoutListItemDTO> getMyWorkouts(String memberEmail, WorkoutFilterRequestDTO filter) {
        return getWorkoutPage(memberEmail, filter, false);
    }

    /**
     * Danh sách workout hệ thống (HEALTH / SKILL).
     *
     * Endpoint này mở cho GUEST nên {@code memberEmail} có thể null — khi đó
     * không cần tra user, chỉ cần lọc theo type/level/search.
     *
     * Workout loại FLEX (linh hoạt) hiển thị ở CẢ tab Health và tab Skill,
     * nên mỗi tab lọc theo {HEALTH, FLEX} hoặc {SKILL, FLEX}.
     */
    @Transactional(readOnly = true)
    public PageResponseDTO<WorkoutListItemDTO> getSystemWorkouts(
            String memberEmail,
            String type,
            WorkoutFilterRequestDTO filter
    ) {
        validateFilter(filter);
        String normalizedType = type == null ? "" : type.trim().toUpperCase(Locale.ROOT);
        List<String> types = switch (normalizedType) {
            case "HEALTH" -> List.of("HEALTH", "FLEX");
            case "SKILL" -> List.of("SKILL", "FLEX");
            default -> throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Workout type must be HEALTH or SKILL");
        };

        Page<WorkoutEntry> result = workouts.findAll(
                WorkoutSpecification.withSystemFilters(filter, types),
                PageRequest.of(filter.getPage(), filter.getSize(),
                        Sort.by(Sort.Order.asc("name"), Sort.Order.asc("id"))));

        // Tập bài đang khoá của member — tính MỘT LẦN cho cả trang để tránh N+1 query.
        Set<Long> lockedExerciseIds = lockedExerciseIdsOf(memberEmail, result.getContent());

        return new PageResponseDTO<>(
                result.getContent().stream().map(workout -> toListItem(workout, lockedExerciseIds)).toList(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.hasNext(),
                result.hasPrevious());
    }

    /**
     * Gom tất cả bài đang khoá của member trong danh sách workout.
     *
     * <p>Gọi {@code statesByExercise} đúng một lần rồi lọc ra các bài LOCKED, thay vì
     * gọi {@code isLocked} cho từng bài (mỗi lần đó lại quét cả cây).</p>
     */
    private Set<Long> lockedExerciseIdsOf(String memberEmail, List<WorkoutEntry> workouts) {
        if (memberEmail == null || memberEmail.isBlank() || workouts.isEmpty()) {
            return Set.of();
        }
        User member = users.findByEmail(memberEmail).orElse(null);
        if (member == null) {
            return Set.of();
        }
        Set<Long> exerciseIds = workouts.stream()
                .flatMap(workout -> workout.getExercises().stream())
                .map(item -> item.getExercise() == null ? null : item.getExercise().getId())
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
        if (exerciseIds.isEmpty()) {
            return Set.of();
        }
        Map<Long, String> states = unlockService.statesByExercise(member.getId());
        return exerciseIds.stream()
                .filter(id -> ExerciseUnlockService.STATE_LOCKED.equals(states.get(id)))
                .collect(Collectors.toUnmodifiableSet());
    }

    @Transactional(readOnly = true)
    public WorkoutDetailResponseDTO getSystemWorkoutDetail(String memberEmail, Long workoutId) {
        requireMember(memberEmail);
        WorkoutEntry workout = workouts.findById(workoutId)
                .filter(entry -> entry.isSystem()
                        && entry.isActive()
                        && "ACTIVE".equalsIgnoreCase(entry.getModerationStatus())
                        && Set.of("HEALTH", "SKILL", "FLEX").contains(
                                entry.getType() == null ? "" : entry.getType().toUpperCase(Locale.ROOT)))
                .orElseThrow(() -> new ResourceNotFoundException("System workout not found"));
        return toDetail(workout, lockState(memberEmail, workout));
    }

    private PageResponseDTO<WorkoutListItemDTO> getWorkoutPage(
            String memberEmail,
            WorkoutFilterRequestDTO filter,
            boolean community
    ) {
        User member = requireMember(memberEmail);
        validateFilter(filter);
        Sort sort = "MOST_SAVED".equalsIgnoreCase(filter.getSortBy())
                ? Sort.by(Sort.Order.desc("saveCount"), Sort.Order.desc("createdAt"))
                : Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
        Page<WorkoutEntry> result = workouts.findAll(
                WorkoutSpecification.withFilters(filter, member.getId(), community),
                PageRequest.of(filter.getPage(), filter.getSize(), sort));
        return new PageResponseDTO<>(
                result.getContent().stream().map(this::toListItem).toList(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.hasNext(),
                result.hasPrevious());
    }

    @Transactional(readOnly = true)
    public WorkoutDetailResponseDTO getWorkoutDetail(String memberEmail, Long workoutId) {
        User member = requireMember(memberEmail);
        WorkoutEntry workout = requireOwnedWorkout(member.getId(), workoutId);
        return toDetail(workout);
    }

    @Transactional(readOnly = true)
    public WorkoutDetailResponseDTO getCommunityWorkoutDetail(String memberEmail, Long workoutId) {
        requireMember(memberEmail);
        WorkoutEntry workout = workouts.findById(workoutId)
                .filter(entry -> !entry.isSystem()
                        && entry.isSharedWithCommunity()
                        && "ACTIVE".equalsIgnoreCase(entry.getModerationStatus()))
                .orElseThrow(() -> new ResourceNotFoundException("Community workout not found"));
        return toDetail(workout);
    }

    @Transactional
    public WorkoutDetailResponseDTO createWorkout(String memberEmail, CreateUpdateWorkoutRequestDTO request) {
        User member = requireMember(memberEmail);
        // Tên workout không được trùng tuyệt đối với tên của một bài tập nào.
        contentNameGuard.assertWorkoutNameNotUsedByExercise(request.title(), null);
        // Một member không được có hai workout riêng cùng tên.
        contentNameGuard.assertMemberWorkoutNameNotUsedByWorkout(request.title(), member.getId(), null);
        validateItems(request.items());
        Map<Long, Exercise> selectedExercises = getAllowedExercises(
                member.getId(), request.items().stream().map(WorkoutItemDTO::exerciseId).toList());
        WorkoutEntry workout = new WorkoutEntry();
        workout.setCode("CUS-" + java.util.UUID.randomUUID().toString().replace("-", "")
                .substring(0, 12).toUpperCase(Locale.ROOT));
        workout.setName(request.title().trim());
        workout.setDescription(request.description() == null ? null : request.description().trim());
        workout.setType(resolveWorkoutType(request.type()));
        workout.setSystem(false);
        workout.setCreatedBy(member);
        workout.setSharedWithCommunity(Boolean.TRUE.equals(request.isSharedWithCommunity()));
        workout.setModerationStatus("ACTIVE");
        // Level phải có trước lần insert đầu tiên (cột `level` NOT NULL), nên tính
        // level ngay ở đây thay vì đợi populateWorkout gán sau.
        String resolvedLevel = resolveWorkoutLevel(request.items(), selectedExercises, request.level());
        assertLevelActive(resolvedLevel);
        workout.setLevel(resolvedLevel);
        workouts.saveAndFlush(workout);
        populateWorkout(workout, request.items(), selectedExercises);
        return toDetail(workouts.saveAndFlush(workout));
    }

    @Transactional
    public WorkoutDetailResponseDTO updateWorkout(
            String memberEmail,
            Long workoutId,
            CreateUpdateWorkoutRequestDTO request
    ) {
        User member = requireMember(memberEmail);
        WorkoutEntry workout = requireOwnedWorkout(member.getId(), workoutId);
        // Đổi tên sang tên một bài tập đang dùng thì bị chặn (trùng tuyệt đối).
        // Giữ nguyên tên cũ thì vẫn sửa được (dữ liệu cũ có workout trùng tên bài tập).
        String requestedTitle = request.title().trim();
        boolean titleChanged = !requestedTitle.equalsIgnoreCase(
                workout.getName() == null ? "" : workout.getName().trim());
        if (titleChanged) {
            contentNameGuard.assertWorkoutNameNotUsedByExercise(requestedTitle, null);
            // Một member không được có hai workout riêng cùng tên.
            contentNameGuard.assertMemberWorkoutNameNotUsedByWorkout(requestedTitle, member.getId(), workout.getId());
        }
        validateItems(request.items());
        Map<Long, Exercise> selectedExercises = getAllowedExercises(
                member.getId(), request.items().stream().map(WorkoutItemDTO::exerciseId).toList());
        workout.setName(requestedTitle);
        workout.setDescription(request.description() == null ? null : request.description().trim());
        if (request.type() != null) {
            workout.setType(resolveWorkoutType(request.type()));
        }
        workout.setSharedWithCommunity(Boolean.TRUE.equals(request.isSharedWithCommunity()));
        String resolvedLevel = resolveWorkoutLevel(request.items(), selectedExercises, request.level());
        // Giữ nguyên level cũ vẫn sửa được; chỉ chặn khi đổi sang level đang không active.
        if (resolvedLevel == null || !resolvedLevel.equalsIgnoreCase(workout.getLevel() == null ? "" : workout.getLevel())) {
            assertLevelActive(resolvedLevel);
        }
        workout.setLevel(resolvedLevel);
        populateWorkout(workout, request.items(), selectedExercises);
        WorkoutEntry saved = workouts.saveAndFlush(workout);
        return toDetail(saved);
    }

    @Transactional
    public void deleteWorkout(String memberEmail, Long workoutId) {
        User member = requireMember(memberEmail);
        workouts.delete(requireOwnedWorkout(member.getId(), workoutId));
    }

    @Transactional(readOnly = true)
    public List<AvailableWorkoutExerciseDTO> getAvailableExercises(String memberEmail) {
        User member = requireMember(memberEmail);
        Specification<Exercise> allowed = allowedExerciseSpecification(member.getId());
        return exercises.findAll(allowed, Sort.by(Sort.Order.asc("name"))).stream()
                .map(exercise -> new AvailableWorkoutExerciseDTO(
                        exercise.getId(),
                        exercise.getName(),
                        exercise.getLevel(),
                        exercise.getMuscleGroup(),
                        exercise.getDefaultSets(),
                        exercise.getDefaultReps(),
                        exercise.getDefaultDuration()))
                .toList();
    }

    private Map<Long, Exercise> getAllowedExercises(Long memberId, List<Long> requestedIds) {
        List<Long> uniqueRequestedIds = requestedIds.stream().distinct().toList();
        List<Exercise> found = exercises.findAll(
                allowedExerciseSpecification(memberId).and((root, query, builder) -> root.get("id").in(uniqueRequestedIds)));
        if (found.size() != uniqueRequestedIds.size()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "One or more selected exercises are unavailable or are not accepted");
        }
        return found.stream().collect(Collectors.toMap(Exercise::getId, Function.identity()));
    }

    private Specification<Exercise> allowedExerciseSpecification(Long memberId) {
        return (root, query, builder) -> {
            var system = builder.equal(root.get("source"), "SYSTEM");
            var memberExercise = builder.and(
                    builder.equal(root.get("source"), "CUSTOM"),
                    builder.or(
                            builder.equal(root.get("createdBy").get("id"), memberId),
                            builder.isTrue(root.get("shareWithCommunity"))));
            return builder.and(
                    builder.isTrue(root.get("active")),
                    builder.upper(root.get("moderationStatus")).in("ACTIVE", "ACCEPTED"),
                    builder.or(system, memberExercise));
        };
    }

    /**
     * Level của workout: ưu tiên level member chọn, nếu không chọn thì lấy level cao nhất
     * trong các bài được chọn. Tách riêng để gán level TRƯỚC lần insert đầu tiên
     * (cột `level` NOT NULL) và dùng lại trong {@link #populateWorkout}.
     */
    private String resolveWorkoutLevel(
            List<WorkoutItemDTO> items,
            Map<Long, Exercise> exercisesById,
            String requestedLevel
    ) {
        String highestLevel = null;
        for (WorkoutItemDTO item : items) {
            Exercise exercise = exercisesById.get(item.exerciseId());
            if (exercise == null) {
                continue;
            }
            if (isHigherLevel(exercise.getLevel(), highestLevel)) {
                highestLevel = exercise.getLevel();
            }
        }
        return resolveLevelName(requestedLevel == null || requestedLevel.isBlank()
                ? highestLevel
                : requestedLevel);
    }

    private void populateWorkout(
            WorkoutEntry workout,
            List<WorkoutItemDTO> items,
            Map<Long, Exercise> exercisesById
    ) {
        List<WorkoutItemDTO> ordered = items.stream()
                .sorted(Comparator.comparingInt(WorkoutItemDTO::orderIndex))
                .toList();
        List<Exercise> selectedExercises = ordered.stream()
                .map(item -> exercisesById.get(item.exerciseId()))
                .toList();
        List<WorkoutExerciseItem> selectedItems = ordered.stream()
                .map(item -> {
                    WorkoutExerciseItem workoutItem = new WorkoutExerciseItem();
                    workoutItem.setExercise(exercisesById.get(item.exerciseId()));
                    workoutItem.setSets(item.sets());
                    String countBy = normalizedCountBy(item);
                    workoutItem.setReps("REPS".equals(countBy) ? item.reps() : null);
                    workoutItem.setDurationSeconds("SECONDS".equals(countBy) ? item.duration() : null);
                    workoutItem.setRestSeconds(item.restSeconds());
                    return workoutItem;
                })
                .toList();
        workout.getExercises().clear();
        workouts.flush();
        workout.getExercises().addAll(selectedItems);
        workouts.flush();

        int totalSets = ordered.stream().mapToInt(WorkoutItemDTO::sets).sum();
        long totalSeconds = 0;
        for (int index = 0; index < ordered.size(); index++) {
            WorkoutItemDTO item = ordered.get(index);
            Exercise exercise = selectedExercises.get(index);
            String countBy = normalizedCountBy(item);
            long effortSeconds = "SECONDS".equals(countBy)
                    ? item.duration()
                    : (long) item.reps() * 3;
            totalSeconds += effortSeconds * item.sets()
                    + (long) item.restSeconds() * Math.max(0, item.sets() - 1);
        }
        workout.setTotalSets(totalSets);
        long estimatedMinutes = (long) Math.ceil(totalSeconds / 60.0);
        workout.setEstimatedDuration((int) Math.min(Integer.MAX_VALUE, estimatedMinutes));
    }

    /**
     * Đưa tên level về đúng tên trong bảng fitness_levels (vd "beginner" -> "Beginner") để lọc
     * theo level khớp giữa workout của hệ thống và workout của member.
     *
     * <p>Level do Content Manager quản lý trong Level & Benchmark Criteria nên thứ tự lấy từ
     * score_min của fitness_levels, không hard-code danh sách level.</p>
     */
    private String resolveLevelName(String level) {
        String normalized = level == null ? "" : level.trim();
        if (normalized.isEmpty()) {
            return lowestLevelName();
        }
        return fitnessLevels.findByNameIgnoreCase(normalized)
                .map(FitnessLevel::getName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Choose a valid workout level"));
    }

    /** Level thấp nhất đang cấu hình (score_min nhỏ nhất) — dùng khi workout chưa chọn level. */
    private String lowestLevelName() {
        return fitnessLevels.findAll().stream()
                .min(Comparator.comparingInt(FitnessLevel::getScoreMin)
                        .thenComparing(FitnessLevel::getName, String.CASE_INSENSITIVE_ORDER))
                .map(FitnessLevel::getName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "No exercise level is configured"));
    }

    /**
     * Workout MỚI không được tạo ở level đang bị ẩn (INACTIVE) — giống quy tắc
     * Content Manager áp cho workout hệ thống.
     */
    private void assertLevelActive(String levelName) {
        if (levelName == null || levelName.isBlank()) {
            return;
        }
        boolean active = fitnessLevels.findByNameIgnoreCase(levelName.trim())
                .map(item -> "ACTIVE".equalsIgnoreCase(item.getStatus()))
                .orElse(true);
        if (!active) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Level " + levelName + " is inactive. Choose an active level or activate it in Level & Benchmark Criteria");
        }
    }

    /** Level này cao hơn level kia không, theo thứ tự score_min của fitness_levels. */
    private boolean isHigherLevel(String candidate, String current) {
        if (candidate == null || candidate.isBlank()) {
            return false;
        }
        if (current == null || current.isBlank()) {
            return true;
        }
        int candidateRank = levelRank(candidate);
        int currentRank = levelRank(current);
        if (candidateRank == currentRank) {
            return candidate.compareToIgnoreCase(current) > 0;
        }
        return candidateRank > currentRank;
    }

    /** Thứ hạng của level theo score_min; level không cấu hình thì đứng cuối. */
    private int levelRank(String level) {
        if (level == null || level.isBlank()) {
            return Integer.MIN_VALUE;
        }
        return fitnessLevels.findByNameIgnoreCase(level.trim())
                .map(FitnessLevel::getScoreMin)
                .orElse(Integer.MIN_VALUE);
    }

    private WorkoutDetailResponseDTO toDetail(WorkoutEntry workout) {
        return toDetail(workout, new WorkoutLockState(false, List.of()));
    }

    private WorkoutDetailResponseDTO toDetail(WorkoutEntry workout, WorkoutLockState lockState) {
        List<WorkoutExerciseItemDTO> items = java.util.stream.IntStream.range(0, workout.getExercises().size())
                .mapToObj(index -> {
                    WorkoutExerciseItem item = workout.getExercises().get(index);
                    Exercise exercise = item.getExercise();
                    // Bài đo theo giây khi workout lưu cấu hình duration (bài HOLD).
                    boolean usesDuration = item.getDurationSeconds() != null;
                    return new WorkoutExerciseItemDTO(
                            null,
                            exercise.getId(),
                            exercise.getCode(),
                            exercise.getName(),
                            exercise.isSystem(),
                            exercise.getMuscleGroup(),
                            exercise.getLevel(),
                            index,
                            item.getSets(),
                            item.getReps(),
                            item.getDurationSeconds(),
                            usesDuration ? "SECONDS" : "REPS",
                            usesDuration ? "HOLD" : "REPS",
                            item.getRestSeconds());
                })
                .toList();
        return new WorkoutDetailResponseDTO(
                workout.getId(),
                workout.getName(),
                workout.getDescription(),
                workout.getLevel(),
                workout.getType(),
                workout.isSharedWithCommunity(),
                workout.getSaveCount(),
                workout.getAuthor() == null ? null : workout.getAuthor().getFullName(),
                workout.getCreatedAt(),
                items.size(),
                workout.getTotalSets(),
                workout.getEstimatedDuration(),
                items,
                lockState.locked(),
                lockState.lockedExerciseNames());
    }

    /**
     * Tính cờ khoá cho workout hệ thống: workout chỉ tập được khi TẤT CẢ bài trong
     * nó đã mở khoá trong Exercise Tree.
     *
     * <p>Chỉ áp dụng cho workout hệ thống: workout của member (custom / cộng đồng)
     * luôn tập được vì chính member đã chủ động chọn các bài đó.</p>
     *
     * @param memberEmail email member (null khi guest)
     * @param workout     workout cần kiểm tra
     * @return cặp (locked, tên các bài đang khoá)
     */
    private WorkoutLockState lockState(String memberEmail, WorkoutEntry workout) {
        if (!workout.isSystem() || memberEmail == null || memberEmail.isBlank()) {
            return new WorkoutLockState(false, List.of());
        }
        User member = users.findByEmail(memberEmail).orElse(null);
        if (member == null) {
            return new WorkoutLockState(false, List.of());
        }
        List<Long> exerciseIds = workout.getExercises().stream()
                .map(item -> item.getExercise() == null ? null : item.getExercise().getId())
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        Set<Long> lockedIds = unlockService.lockedExerciseIds(exerciseIds, member.getId());
        if (lockedIds.isEmpty()) {
            return new WorkoutLockState(false, List.of());
        }
        List<String> lockedNames = workout.getExercises().stream()
                .map(item -> item.getExercise())
                .filter(java.util.Objects::nonNull)
                .filter(exercise -> lockedIds.contains(exercise.getId()))
                .map(Exercise::getName)
                .distinct()
                .toList();
        return new WorkoutLockState(true, lockedNames);
    }

    /** Kết quả kiểm tra khoá của workout. */
    private record WorkoutLockState(boolean locked, List<String> lockedExerciseNames) {}

    private WorkoutListItemDTO toListItem(WorkoutEntry workout) {
        return toListItem(workout, Set.of());
    }

    /**
     * @param lockedExerciseIds các bài đang khoá của member — workout chứa bất kỳ bài nào
     *                           trong tập này thì workout đó bị khoá.
     */
    private WorkoutListItemDTO toListItem(WorkoutEntry workout, Set<Long> lockedExerciseIds) {
        boolean locked = !lockedExerciseIds.isEmpty() && workout.getExercises().stream()
                .map(item -> item.getExercise() == null ? null : item.getExercise().getId())
                .anyMatch(lockedExerciseIds::contains);
        return new WorkoutListItemDTO(
                workout.getId(),
                workout.getName(),
                workout.getDescription(),
                workout.getLevel(),
                workout.getType(),
                workout.getAuthor() == null ? null : workout.getAuthor().getFullName(),
                workout.getCreatedAt(),
                workout.getSaveCount(),
                workout.getExercises().size(),
                workout.getTotalSets(),
                workout.getEstimatedDuration(),
                workout.getExercises().stream()
                        .map(item -> item.getExercise().getMuscleGroup())
                        .filter(group -> group != null && !group.isBlank())
                        .distinct()
                        .collect(Collectors.joining(", ")),
                workout.isSharedWithCommunity(),
                locked);
    }

    private WorkoutEntry requireOwnedWorkout(Long memberId, Long workoutId) {
        WorkoutEntry workout = workouts.findById(workoutId)
                .orElseThrow(() -> new ResourceNotFoundException("Workout not found"));
        if (workout.isSystem() || !memberId.equals(workout.getAuthorId())) {
            throw new ResourceNotFoundException("Workout not found");
        }
        return workout;
    }

    private User requireMember(String memberEmail) {
        return users.findByEmail(memberEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Member not found"));
    }

    private void validateFilter(WorkoutFilterRequestDTO filter) {
        if (filter == null || filter.getPage() < 0 || filter.getSize() < 1 || filter.getSize() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid page or size");
        }
        String level = filter.getLevel();
        if (level == null || level.isBlank() || "ALL".equalsIgnoreCase(level.trim())) {
            return;
        }
        // Level lấy từ bảng fitness_levels nên không hard-code danh sách ở đây.
        boolean known = fitnessLevels.findByNameIgnoreCase(level.trim()).isPresent();
        if (!known) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid workout level");
        }
    }

    private void validateItems(List<WorkoutItemDTO> items) {
        if (items == null || items.isEmpty()) {
            throw new RequestValidationException("items", "A workout must contain at least one exercise");
        }
        if (items.stream().anyMatch(item -> item == null)) {
            throw new RequestValidationException("items", "Workout exercises cannot be null");
        }
        Set<Integer> indexes = items.stream().map(WorkoutItemDTO::orderIndex).collect(Collectors.toSet());
        if (indexes.size() != items.size() || indexes.stream().anyMatch(index -> index < 0)) {
            throw new RequestValidationException("items", "Exercise order must be unique and non-negative");
        }
        for (int index = 0; index < items.size(); index++) {
            WorkoutItemDTO item = items.get(index);
            String countBy = normalizedCountBy(item);
            if (item.sets() < 1 || item.sets() > 100
                    || item.restSeconds() < 10 || item.restSeconds() > 180
                    || (item.reps() != null && item.reps() < 1)
                    || (item.duration() != null && item.duration() < 1)
                    || ("REPS".equals(countBy) && item.reps() == null)
                    || ("SECONDS".equals(countBy) && item.duration() == null)) {
                throw new RequestValidationException(
                        "items[" + index + "]",
                        "Invalid exercise configuration: sets must be from 1 to 100, reps/duration must be at least 1, and rest time must be from 10 to 180 seconds"
                );
            }
        }
    }

    private String normalizedCountBy(WorkoutItemDTO item) {
        String countBy = item.countBy() == null ? "REPS" : item.countBy().trim().toUpperCase(Locale.ROOT);
        if (!"REPS".equals(countBy) && !"SECONDS".equals(countBy)) {
            throw new RequestValidationException("items.countBy", "countBy phải là REPS hoặc SECONDS");
        }
        return countBy;
    }

    private String resolveWorkoutType(String type) {
        if (type == null || type.isBlank()) {
            return "CUSTOM";
        }
        return "NONE".equalsIgnoreCase(type.trim())
                ? null
                : type.trim().toUpperCase(Locale.ROOT);
    }
}
