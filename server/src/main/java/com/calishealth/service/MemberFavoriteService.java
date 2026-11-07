package com.calishealth.service;

import com.calishealth.dtos.FavoriteItemResponseDTO;
import com.calishealth.dtos.FavoriteToggleResponseDTO;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.models.Exercise;
import com.calishealth.models.MemberFavorite;
import com.calishealth.models.User;
import com.calishealth.models.WorkoutEntry;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.MemberFavoriteRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Chức năng yêu thích (bookmark) cho Member trên cả bài tập lẫn workout.
 *
 * <p>Member đánh dấu sao trong thư viện rồi quay lại màn "Favorites" để tập lại.
 * Màn Favorites gom theo 4 nhóm: exercise/workout của hệ thống và của Member cung cấp.
 */
@Service
@RequiredArgsConstructor
public class MemberFavoriteService {
    private final MemberFavoriteRepository favorites;
    private final UserRepository users;
    private final ExerciseRepository exercises;
    private final WorkoutRepository workouts;

    @Transactional
    public FavoriteToggleResponseDTO toggle(String memberEmail, String itemType, Long itemId) {
        User member = requireMember(memberEmail);
        MemberFavorite.ItemType type = parseItemType(itemType);

        // Chỉ cho yêu thích nội dung tồn tại và nhìn thấy được.
        if (type == MemberFavorite.ItemType.SYSTEM_EXERCISE
                || type == MemberFavorite.ItemType.MEMBER_EXERCISE) {
            requireVisibleExercise(type, itemId);
        } else {
            requireVisibleWorkout(type, itemId);
        }

        boolean nowFavorite;
        if (favorites.existsByMemberIdAndItemTypeAndItemId(member.getId(), type, itemId)) {
            favorites.deleteByMemberIdAndItemTypeAndItemId(member.getId(), type, itemId);
            nowFavorite = false;
        } else {
            MemberFavorite favorite = new MemberFavorite();
            favorite.setMemberId(member.getId());
            favorite.setItemType(type);
            favorite.setItemId(itemId);
            favorites.save(favorite);
            nowFavorite = true;
        }

        int count = adjustSaveCount(type, itemId, nowFavorite);
        return new FavoriteToggleResponseDTO(type.name(), itemId, nowFavorite, count);
    }

    @Transactional(readOnly = true)
    public List<FavoriteItemResponseDTO> list(String memberEmail) {
        User member = requireMember(memberEmail);
        List<MemberFavorite> rows = favorites.findAllByMemberId(member.getId());
        if (rows.isEmpty()) {
            return List.of();
        }

        Map<Long, Exercise> exercisesById = loadExercises(rows);
        Map<Long, WorkoutEntry> workoutsById = loadWorkouts(rows);

        List<FavoriteItemResponseDTO> items = new ArrayList<>(rows.size());
        for (MemberFavorite row : rows) {
            FavoriteItemResponseDTO dto = toDto(row, exercisesById, workoutsById);
            if (dto != null) {
                items.add(dto);
            }
        }
        items.sort(Comparator.comparing(FavoriteItemResponseDTO::createdAt).reversed());
        return items;
    }

    private Map<Long, Exercise> loadExercises(List<MemberFavorite> rows) {
        List<Long> ids = rows.stream()
                .filter(row -> isExercise(row.getItemType()))
                .map(MemberFavorite::getItemId)
                .distinct()
                .toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return exercises.findAllById(ids).stream()
                .collect(Collectors.toMap(Exercise::getId, item -> item));
    }

    private Map<Long, WorkoutEntry> loadWorkouts(List<MemberFavorite> rows) {
        List<Long> ids = rows.stream()
                .filter(row -> !isExercise(row.getItemType()))
                .map(MemberFavorite::getItemId)
                .distinct()
                .toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return workouts.findAllById(ids).stream()
                .collect(Collectors.toMap(WorkoutEntry::getId, item -> item));
    }

    private FavoriteItemResponseDTO toDto(
            MemberFavorite row,
            Map<Long, Exercise> exercisesById,
            Map<Long, WorkoutEntry> workoutsById
    ) {
        if (isExercise(row.getItemType())) {
            Exercise exercise = exercisesById.get(row.getItemId());
            if (exercise == null) {
                return null;
            }
            return new FavoriteItemResponseDTO(
                    row.getId(),
                    row.getItemType().name(),
                    exercise.getId(),
                    exercise.getName(),
                    exercise.getLevel(),
                    exercise.getAuthor() == null ? null : exercise.getAuthor().getFullName(),
                    exercise.isSystem() ? "SYSTEM" : "CUSTOM",
                    exercise.getMuscleGroup(),
                    0,
                    0,
                    exercise.getCode(),
                    "HOLD".equalsIgnoreCase(exercise.getCategory()) ? "HOLD" : "REPS",
                    exercise.getDefaultSets(),
                    exercise.getDefaultReps(),
                    exercise.getDefaultDuration(),
                    row.getCreatedAt());
        }

        WorkoutEntry workout = workoutsById.get(row.getItemId());
        if (workout == null) {
            return null;
        }
        return new FavoriteItemResponseDTO(
                row.getId(),
                row.getItemType().name(),
                workout.getId(),
                workout.getName(),
                workout.getLevel(),
                workout.getAuthor() == null ? null : workout.getAuthor().getFullName(),
                workout.isSystem() ? "SYSTEM" : "CUSTOM",
                workout.getExercises().stream()
                        .map(item -> item.getExercise().getMuscleGroup())
                        .filter(group -> group != null && !group.isBlank())
                        .distinct()
                        .collect(Collectors.joining(", ")),
                workout.getExercises().size(),
                workout.getEstimatedDuration() == null ? 0 : workout.getEstimatedDuration(),
                workout.getCode(),
                null,
                workout.getTotalSets(),
                null,
                null,
                row.getCreatedAt());
    }

    private static boolean isExercise(MemberFavorite.ItemType type) {
        return type == MemberFavorite.ItemType.SYSTEM_EXERCISE
                || type == MemberFavorite.ItemType.MEMBER_EXERCISE;
    }

    /**
     * Bài tập của hệ thống: phải tồn tại và đang hoạt động.
     * Bài tập của Member: phải tồn tại, đã được duyệt và chia sẻ cộng đồng
     * (bài cá nhân của chính member vẫn được phép yêu thích).
     */
    private void requireVisibleExercise(MemberFavorite.ItemType type, Long exerciseId) {
        Exercise exercise = exercises.findById(exerciseId)
                .orElseThrow(() -> new ResourceNotFoundException("Exercise not found"));
        if (type == MemberFavorite.ItemType.SYSTEM_EXERCISE) {
            if (!exercise.isSystem() || !exercise.isActive()) {
                throw new ResourceNotFoundException("System exercise not found");
            }
            return;
        }
        if (exercise.isSystem()) {
            throw new ResourceNotFoundException("Member exercise not found");
        }
    }

    private void requireVisibleWorkout(MemberFavorite.ItemType type, Long workoutId) {
        WorkoutEntry workout = workouts.findById(workoutId)
                .orElseThrow(() -> new ResourceNotFoundException("Workout not found"));
        if (type == MemberFavorite.ItemType.SYSTEM_WORKOUT) {
            if (!workout.isSystem() || !workout.isActive()) {
                throw new ResourceNotFoundException("System workout not found");
            }
            return;
        }
        if (workout.isSystem()) {
            throw new ResourceNotFoundException("Member workout not found");
        }
    }

    /**
     * Đồng bộ cột `save_count` của nội dung gốc với số lượt yêu thích.
     * Bộ đếm này đã tồn tại từ trước (dùng cho bài community) nên ta tiếp tục dùng
     * chung để không phải thêm cột mới.
     */
    private int adjustSaveCount(MemberFavorite.ItemType type, Long itemId, boolean increment) {
        int delta = increment ? 1 : -1;
        if (isExercise(type)) {
            Exercise exercise = exercises.findById(itemId).orElse(null);
            if (exercise == null) {
                return 0;
            }
            int next = Math.max(0, (exercise.getSaveCount() == null ? 0 : exercise.getSaveCount()) + delta);
            exercise.setSaveCount(next);
            exercises.saveAndFlush(exercise);
            return next;
        }
        WorkoutEntry workout = workouts.findById(itemId).orElse(null);
        if (workout == null) {
            return 0;
        }
        int next = Math.max(0, (workout.getSaveCount() == null ? 0 : workout.getSaveCount()) + delta);
        workout.setSaveCount(next);
        workouts.saveAndFlush(workout);
        return next;
    }

    private MemberFavorite.ItemType parseItemType(String itemType) {
        if (itemType == null || itemType.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Favorite item type is required");
        }
        try {
            return MemberFavorite.ItemType.valueOf(itemType.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Favorite item type must be SYSTEM_EXERCISE, MEMBER_EXERCISE, SYSTEM_WORKOUT or MEMBER_WORKOUT");
        }
    }

    private User requireMember(String memberEmail) {
        return users.findByEmail(memberEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Member not found"));
    }
}
