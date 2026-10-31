package com.calishealth.service;

import com.calishealth.dtos.*;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.exception.RequestValidationException;
import com.calishealth.models.Exercise;
import com.calishealth.models.User;
import com.calishealth.models.WorkoutEntry;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import com.calishealth.specification.WorkoutSpecification;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
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
    private final JdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    public PageResponseDTO<WorkoutListItemDTO> getCommunityWorkouts(String memberEmail, WorkoutFilterRequestDTO filter) {
        return getWorkoutPage(memberEmail, filter, true);
    }

    @Transactional(readOnly = true)
    public PageResponseDTO<WorkoutListItemDTO> getMyWorkouts(String memberEmail, WorkoutFilterRequestDTO filter) {
        return getWorkoutPage(memberEmail, filter, false);
    }

    @Transactional(readOnly = true)
    public PageResponseDTO<WorkoutListItemDTO> getSystemWorkouts(
            String memberEmail,
            String type,
            WorkoutFilterRequestDTO filter
    ) {
        requireMember(memberEmail);
        validateFilter(filter);
        String normalizedType = type == null ? "" : type.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("HEALTH", "SKILL").contains(normalizedType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Workout type must be HEALTH or SKILL");
        }

        Page<WorkoutEntry> result = workouts.findAll(
                WorkoutSpecification.withSystemFilters(filter, normalizedType),
                PageRequest.of(filter.getPage(), filter.getSize(),
                        Sort.by(Sort.Order.asc("name"), Sort.Order.asc("id"))));
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
    public WorkoutDetailResponseDTO getSystemWorkoutDetail(String memberEmail, Long workoutId) {
        requireMember(memberEmail);
        WorkoutEntry workout = workouts.findById(workoutId)
                .filter(entry -> entry.isSystem()
                        && entry.isActive()
                        && "ACCEPTED".equalsIgnoreCase(entry.getStatus())
                        && Set.of("HEALTH", "SKILL").contains(
                                entry.getType() == null ? "" : entry.getType().toUpperCase(Locale.ROOT)))
                .orElseThrow(() -> new ResourceNotFoundException("System workout not found"));
        return toDetail(workout);
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
                        && "ACCEPTED".equalsIgnoreCase(entry.getStatus()))
                .orElseThrow(() -> new ResourceNotFoundException("Community workout not found"));
        return toDetail(workout);
    }

    @Transactional
    public WorkoutDetailResponseDTO createWorkout(String memberEmail, CreateUpdateWorkoutRequestDTO request) {
        User member = requireMember(memberEmail);
        validateItems(request.items());
        Map<Long, Exercise> selectedExercises = getAllowedExercises(
                member.getId(), request.items().stream().map(WorkoutItemDTO::exerciseId).toList());
        WorkoutEntry workout = new WorkoutEntry();
        workout.setCode("CUS-" + java.util.UUID.randomUUID().toString().replace("-", "")
                .substring(0, 12).toUpperCase(Locale.ROOT));
        workout.setName(request.title().trim());
        workout.setDescription(request.description() == null ? null : request.description().trim());
        workout.setType("CUSTOM");
        workout.setSystem(false);
        workout.setCreatedBy(member);
        workout.setAuthorId(member.getId());
        workout.setLevel("BEGINNER");
        workout.setSharedWithCommunity(Boolean.TRUE.equals(request.isSharedWithCommunity()));
        workout.setStatus("ACCEPTED");
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
        validateItems(request.items());
        Map<Long, Exercise> selectedExercises = getAllowedExercises(
                member.getId(), request.items().stream().map(WorkoutItemDTO::exerciseId).toList());
        workout.setName(request.title().trim());
        workout.setDescription(request.description() == null ? null : request.description().trim());
        workout.setSharedWithCommunity(Boolean.TRUE.equals(request.isSharedWithCommunity()));
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
            var system = builder.isTrue(root.get("system"));
            var memberExercise = builder.and(
                    builder.isFalse(root.get("system")),
                    builder.or(
                            builder.equal(root.get("author").get("id"), memberId),
                            builder.isTrue(root.get("shareWithCommunity"))));
            return builder.and(
                    builder.isTrue(root.get("active")),
                    builder.equal(root.get("status"), "ACCEPTED"),
                    builder.or(system, memberExercise));
        };
    }

    private void populateWorkout(
            WorkoutEntry workout,
            List<WorkoutItemDTO> items,
            Map<Long, Exercise> exercisesById
    ) {
        List<WorkoutItemDTO> ordered = items.stream()
                .sorted(Comparator.comparingInt(WorkoutItemDTO::orderIndex))
                .toList();
        List<Exercise> selected = ordered.stream()
                .map(item -> exercisesById.get(item.exerciseId()))
                .toList();
        workout.getExercises().clear();
        workouts.flush();
        workout.getExercises().addAll(selected);
        workouts.flush();

        int totalSets = ordered.stream().mapToInt(WorkoutItemDTO::sets).sum();
        long totalSeconds = 0;
        int maximumLevel = 0;
        for (int index = 0; index < ordered.size(); index++) {
            WorkoutItemDTO item = ordered.get(index);
            Exercise exercise = selected.get(index);
            String countBy = normalizedCountBy(item);
            long effortSeconds = "SECONDS".equals(countBy)
                    ? item.duration()
                    : (long) item.reps() * 3;
            totalSeconds += effortSeconds * item.sets()
                    + (long) item.restSeconds() * Math.max(0, item.sets() - 1);
            maximumLevel = Math.max(maximumLevel, levelRank(exercise.getLevel()));
        }
        workout.setTotalSets(totalSets);
        long estimatedMinutes = (long) Math.ceil(totalSeconds / 60.0);
        workout.setEstimatedDuration((int) Math.min(Integer.MAX_VALUE, estimatedMinutes));
        workout.setLevel(switch (maximumLevel) {
            case 3 -> "ADVANCED";
            case 2 -> "INTERMEDIATE";
            default -> "BEGINNER";
        });

        for (int index = 0; index < ordered.size(); index++) {
            WorkoutItemDTO item = ordered.get(index);
            String countBy = normalizedCountBy(item);
            int updated = jdbcTemplate.update("""
                    UPDATE workout_exercises
                    SET order_index = ?, sets = ?, reps = ?, duration = ?, count_by = ?, rest_seconds = ?
                    WHERE workout_id = ? AND display_order = ?
                    """,
                    index,
                    item.sets(),
                    "REPS".equals(countBy) ? item.reps() : null,
                    "SECONDS".equals(countBy) ? item.duration() : null,
                    countBy,
                    item.restSeconds(),
                    workout.getId(),
                    index);
            if (updated == 0 && jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM workout_exercises WHERE workout_id = ? AND display_order = ?",
                    Integer.class,
                    workout.getId(),
                    index) != 1) {
                throw new IllegalStateException("Could not persist workout exercise configuration");
            }
        }
    }

    private WorkoutDetailResponseDTO toDetail(WorkoutEntry workout) {
        List<WorkoutExerciseItemDTO> items = jdbcTemplate.query("""
                SELECT we.id, we.exercise_id, e.name, e.is_system, e.muscle_group, e.level,
                       we.order_index, we.sets, we.reps, we.duration, we.count_by, we.rest_seconds
                FROM workout_exercises we
                JOIN exercises e ON e.id = we.exercise_id
                WHERE we.workout_id = ?
                ORDER BY we.order_index ASC, we.display_order ASC
                """, (row, rowNum) -> new WorkoutExerciseItemDTO(
                row.getLong("id"),
                row.getLong("exercise_id"),
                row.getString("name"),
                row.getBoolean("is_system"),
                row.getString("muscle_group"),
                row.getString("level"),
                row.getInt("order_index"),
                row.getInt("sets"),
                (Integer) row.getObject("reps"),
                (Integer) row.getObject("duration"),
                row.getString("count_by"),
                row.getInt("rest_seconds")), workout.getId());
        return new WorkoutDetailResponseDTO(
                workout.getId(),
                workout.getName(),
                workout.getDescription(),
                workout.getLevel(),
                workout.isSharedWithCommunity(),
                workout.getSaveCount(),
                workout.getAuthor() == null ? null : workout.getAuthor().getFullName(),
                workout.getCreatedAt(),
                items.size(),
                workout.getTotalSets(),
                workout.getEstimatedDuration(),
                items);
    }

    private WorkoutListItemDTO toListItem(WorkoutEntry workout) {
        return new WorkoutListItemDTO(
                workout.getId(),
                workout.getName(),
                workout.getDescription(),
                workout.getLevel(),
                workout.getAuthor() == null ? null : workout.getAuthor().getFullName(),
                workout.getCreatedAt(),
                workout.getSaveCount(),
                workout.getExercises().size(),
                workout.getTotalSets(),
                workout.getEstimatedDuration(),
                workout.getExercises().stream()
                        .map(Exercise::getMuscleGroup)
                        .filter(group -> group != null && !group.isBlank())
                        .distinct()
                        .collect(Collectors.joining(", ")),
                workout.isSharedWithCommunity());
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
        if (filter.getLevel() != null && !filter.getLevel().isBlank()
                && !Set.of("ALL", "BEGINNER", "INTERMEDIATE", "ADVANCED")
                .contains(filter.getLevel().trim().toUpperCase(Locale.ROOT))) {
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

    private int levelRank(String level) {
        return switch (level == null ? "" : level.toUpperCase(Locale.ROOT)) {
            case "BEGINNER" -> 1;
            case "INTERMEDIATE" -> 2;
            case "ADVANCED" -> 3;
            default -> 0;
        };
    }
}
