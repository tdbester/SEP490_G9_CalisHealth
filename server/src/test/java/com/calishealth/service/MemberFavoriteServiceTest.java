package com.calishealth.service;

import com.calishealth.dtos.FavoriteItemResponseDTO;
import com.calishealth.dtos.FavoriteToggleResponseDTO;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.models.Exercise;
import com.calishealth.models.MemberFavorite;
import com.calishealth.models.User;
import com.calishealth.models.WorkoutEntry;
import com.calishealth.models.WorkoutExerciseItem;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.MemberFavoriteRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MemberFavoriteServiceTest {
    @Mock private MemberFavoriteRepository favorites;
    @Mock private UserRepository users;
    @Mock private ExerciseRepository exercises;
    @Mock private WorkoutRepository workouts;
    @InjectMocks private MemberFavoriteService service;

    private static final String EMAIL = "member@example.test";

    private static User member() {
        User user = new User();
        user.setId(7L);
        user.setEmail(EMAIL);
        return user;
    }

    private static Exercise exercise(long id, String name, boolean system, boolean active, String category) {
        Exercise exercise = new Exercise();
        exercise.setId(id);
        exercise.setName(name);
        exercise.setCode("CODE-" + id);
        exercise.setType(Exercise.EntryType.HEALTH);
        exercise.setSystem(system);
        exercise.setActive(active);
        exercise.setCategory(category);
        exercise.setLevel("Beginner");
        exercise.setMuscleGroup("Chest");
        exercise.setDefaultSets(3);
        exercise.setDefaultReps(10);
        exercise.setDefaultDuration(30);
        return exercise;
    }

    private static WorkoutEntry workout(long id, String name, boolean system, boolean active) {
        WorkoutEntry workout = new WorkoutEntry();
        workout.setId(id);
        workout.setName(name);
        workout.setCode("W-" + id);
        workout.setSystem(system);
        workout.setTemplateStatus(active ? "PUBLISHED" : "DRAFT");
        workout.setLevel("Beginner");
        workout.setTotalSets(3);
        return workout;
    }

    private static MemberFavorite favorite(long id, MemberFavorite.ItemType type, long itemId, LocalDateTime at) {
        MemberFavorite row = new MemberFavorite();
        row.setId(id);
        row.setMemberId(7L);
        row.setItemType(type);
        row.setItemId(itemId);
        row.setCreatedAt(at);
        return row;
    }

    // ---------------------------------------------------------------- toggle

    @Test
    @DisplayName("Toggle bài tập hệ thống lần đầu -> thêm vào yêu thích")
    void toggleAddsSystemExercise() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(exercises.findById(1L)).thenReturn(Optional.of(exercise(1L, "Push-up", true, true, "REPS")));
        when(favorites.existsByMemberIdAndItemTypeAndItemId(7L, MemberFavorite.ItemType.SYSTEM_EXERCISE, 1L))
                .thenReturn(false);
        when(favorites.save(any(MemberFavorite.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(favorites.countByItemTypeAndItemId(MemberFavorite.ItemType.SYSTEM_EXERCISE, 1L)).thenReturn(1L);

        FavoriteToggleResponseDTO response = service.toggle(EMAIL, "SYSTEM_EXERCISE", 1L);

        assertEquals("SYSTEM_EXERCISE", response.itemType());
        assertEquals(1L, response.itemId());
        assertTrue(response.favorite());
        assertEquals(1, response.count());
        verify(favorites).save(any(MemberFavorite.class));
    }

    @Test
    @DisplayName("Toggle lần hai -> bỏ yêu thích")
    void toggleRemovesExistingFavorite() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(exercises.findById(1L)).thenReturn(Optional.of(exercise(1L, "Push-up", true, true, "REPS")));
        when(favorites.existsByMemberIdAndItemTypeAndItemId(7L, MemberFavorite.ItemType.SYSTEM_EXERCISE, 1L))
                .thenReturn(true);
        when(favorites.countByItemTypeAndItemId(MemberFavorite.ItemType.SYSTEM_EXERCISE, 1L)).thenReturn(0L);

        FavoriteToggleResponseDTO response = service.toggle(EMAIL, "SYSTEM_EXERCISE", 1L);

        assertFalse(response.favorite());
        assertEquals(0, response.count());
        verify(favorites).deleteByMemberIdAndItemTypeAndItemId(7L, MemberFavorite.ItemType.SYSTEM_EXERCISE, 1L);
        verify(favorites, never()).save(any(MemberFavorite.class));
    }

    @Test
    @DisplayName("Toggle bài tập của Member")
    void toggleAddsMemberExercise() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(exercises.findById(2L)).thenReturn(Optional.of(exercise(2L, "My Exercise", false, true, "REPS")));
        when(favorites.existsByMemberIdAndItemTypeAndItemId(7L, MemberFavorite.ItemType.MEMBER_EXERCISE, 2L))
                .thenReturn(false);
        when(favorites.save(any(MemberFavorite.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(favorites.countByItemTypeAndItemId(MemberFavorite.ItemType.MEMBER_EXERCISE, 2L)).thenReturn(3L);

        FavoriteToggleResponseDTO response = service.toggle(EMAIL, "member_exercise", 2L);

        assertTrue(response.favorite());
        assertEquals(3, response.count());
    }

    @Test
    @DisplayName("Toggle workout hệ thống")
    void toggleAddsSystemWorkout() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(workouts.findById(3L)).thenReturn(Optional.of(workout(3L, "Full Body", true, true)));
        when(favorites.existsByMemberIdAndItemTypeAndItemId(7L, MemberFavorite.ItemType.SYSTEM_WORKOUT, 3L))
                .thenReturn(false);
        when(favorites.save(any(MemberFavorite.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(favorites.countByItemTypeAndItemId(MemberFavorite.ItemType.SYSTEM_WORKOUT, 3L)).thenReturn(2L);

        FavoriteToggleResponseDTO response = service.toggle(EMAIL, "SYSTEM_WORKOUT", 3L);

        assertTrue(response.favorite());
        assertEquals(2, response.count());
    }

    @Test
    @DisplayName("Toggle workout của Member")
    void toggleAddsMemberWorkout() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(workouts.findById(4L)).thenReturn(Optional.of(workout(4L, "My Workout", false, true)));
        when(favorites.existsByMemberIdAndItemTypeAndItemId(7L, MemberFavorite.ItemType.MEMBER_WORKOUT, 4L))
                .thenReturn(false);
        when(favorites.save(any(MemberFavorite.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(favorites.countByItemTypeAndItemId(MemberFavorite.ItemType.MEMBER_WORKOUT, 4L)).thenReturn(1L);

        FavoriteToggleResponseDTO response = service.toggle(EMAIL, "MEMBER_WORKOUT", 4L);

        assertTrue(response.favorite());
        assertEquals(1, response.count());
    }

    // ------------------------------------------------------- toggle lỗi

    @Test
    @DisplayName("Toggle với itemType rỗng -> 400")
    void toggleRejectsBlankItemType() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class, () -> service.toggle(EMAIL, "  ", 1L));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Toggle với itemType không hợp lệ -> 400")
    void toggleRejectsUnknownItemType() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class, () -> service.toggle(EMAIL, "GYMNAST", 1L));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Toggle với itemType null -> 400")
    void toggleRejectsNullItemType() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class, () -> service.toggle(EMAIL, null, 1L));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Member không tồn tại -> 404")
    void toggleRejectsUnknownMember() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.toggle(EMAIL, "SYSTEM_EXERCISE", 1L));
    }

    @Test
    @DisplayName("Bài tập không tồn tại -> 404")
    void toggleRejectsUnknownExercise() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(exercises.findById(9L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.toggle(EMAIL, "SYSTEM_EXERCISE", 9L));
    }

    @Test
    @DisplayName("Bài tập hệ thống đã bị vô hiệu -> 404")
    void toggleRejectsInactiveSystemExercise() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(exercises.findById(9L)).thenReturn(Optional.of(exercise(9L, "Old", true, false, "REPS")));

        assertThrows(ResourceNotFoundException.class, () -> service.toggle(EMAIL, "SYSTEM_EXERCISE", 9L));
    }

    @Test
    @DisplayName("Bài tập của hệ thống không được coi là bài của Member -> 404")
    void toggleRejectsSystemExerciseAsMemberExercise() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(exercises.findById(9L)).thenReturn(Optional.of(exercise(9L, "System", true, true, "REPS")));

        assertThrows(ResourceNotFoundException.class, () -> service.toggle(EMAIL, "MEMBER_EXERCISE", 9L));
    }

    @Test
    @DisplayName("Workout không tồn tại -> 404")
    void toggleRejectsUnknownWorkout() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(workouts.findById(9L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.toggle(EMAIL, "SYSTEM_WORKOUT", 9L));
    }

    @Test
    @DisplayName("Workout hệ thống đã bị vô hiệu -> 404")
    void toggleRejectsInactiveSystemWorkout() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(workouts.findById(9L)).thenReturn(Optional.of(workout(9L, "Old", true, false)));

        assertThrows(ResourceNotFoundException.class, () -> service.toggle(EMAIL, "SYSTEM_WORKOUT", 9L));
    }

    @Test
    @DisplayName("Workout của hệ thống không được coi là workout của Member -> 404")
    void toggleRejectsSystemWorkoutAsMemberWorkout() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(workouts.findById(9L)).thenReturn(Optional.of(workout(9L, "System", true, true)));

        assertThrows(ResourceNotFoundException.class, () -> service.toggle(EMAIL, "MEMBER_WORKOUT", 9L));
    }

    // ------------------------------------------------------------------ list

    @Test
    @DisplayName("Member chưa có yêu thích nào -> danh sách rỗng")
    void listReturnsEmptyWhenNoFavorites() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(favorites.findAllByMemberId(7L)).thenReturn(List.of());

        assertTrue(service.list(EMAIL).isEmpty());
    }

    @Test
    @DisplayName("Danh sách yêu thích: bài tập hệ thống -> đủ trường hiển thị")
    void listMapsSystemExercise() {
        User author = new User();
        author.setFullName("Coach Mai");
        Exercise pushUp = exercise(1L, "Push-up", true, true, "REPS");
        pushUp.setAuthor(author);

        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(favorites.findAllByMemberId(7L)).thenReturn(List.of(
                favorite(10L, MemberFavorite.ItemType.SYSTEM_EXERCISE, 1L, LocalDateTime.of(2026, 1, 2, 3, 4))));
        when(exercises.findAllById(List.of(1L))).thenReturn(List.of(pushUp));

        List<FavoriteItemResponseDTO> items = service.list(EMAIL);

        assertEquals(1, items.size());
        FavoriteItemResponseDTO item = items.get(0);
        assertEquals(10L, item.id());
        assertEquals("SYSTEM_EXERCISE", item.itemType());
        assertEquals("Push-up", item.title());
        assertEquals("Beginner", item.level());
        assertEquals("Coach Mai", item.authorName());
        assertEquals("SYSTEM", item.source());
        assertEquals("Chest", item.meta());
        assertEquals(0, item.totalItems());
        assertEquals(0, item.estimatedDuration());
        assertEquals("CODE-1", item.code());
        assertEquals("REPS", item.category());
        assertEquals(3, item.defaultSets());
        assertEquals(10, item.defaultReps());
        assertEquals(30, item.defaultDuration());
    }

    @Test
    @DisplayName("Bài tập category HOLD -> trường category là HOLD")
    void listMapsHoldCategory() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(favorites.findAllByMemberId(7L)).thenReturn(List.of(
                favorite(10L, MemberFavorite.ItemType.SYSTEM_EXERCISE, 1L, LocalDateTime.now())));
        when(exercises.findAllById(List.of(1L)))
                .thenReturn(List.of(exercise(1L, "Plank", true, true, "hold")));

        assertEquals("HOLD", service.list(EMAIL).get(0).category());
    }

    @Test
    @DisplayName("Bài tập của Member không có tác giả -> authorName null, source CUSTOM")
    void listMapsMemberExerciseWithoutAuthor() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(favorites.findAllByMemberId(7L)).thenReturn(List.of(
                favorite(11L, MemberFavorite.ItemType.MEMBER_EXERCISE, 2L, LocalDateTime.now())));
        when(exercises.findAllById(List.of(2L)))
                .thenReturn(List.of(exercise(2L, "My Exercise", false, true, "REPS")));

        FavoriteItemResponseDTO item = service.list(EMAIL).get(0);

        assertNull(item.authorName());
        assertEquals("CUSTOM", item.source());
    }

    @Test
    @DisplayName("Danh sách yêu thích: workout -> gom nhóm cơ và số bài tập")
    void listMapsWorkout() {
        WorkoutEntry fullBody = workout(3L, "Full Body", true, true);
        fullBody.setEstimatedDuration(45);

        WorkoutExerciseItem first = new WorkoutExerciseItem();
        first.setExercise(exercise(1L, "Push-up", true, true, "REPS"));
        WorkoutExerciseItem second = new WorkoutExerciseItem();
        second.setExercise(exercise(2L, "Squat", true, true, "REPS"));
        fullBody.setExercises(List.of(first, second));

        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(favorites.findAllByMemberId(7L)).thenReturn(List.of(
                favorite(12L, MemberFavorite.ItemType.SYSTEM_WORKOUT, 3L, LocalDateTime.now())));
        when(workouts.findAllById(List.of(3L))).thenReturn(List.of(fullBody));

        FavoriteItemResponseDTO item = service.list(EMAIL).get(0);

        assertEquals("Full Body", item.title());
        assertEquals("SYSTEM", item.source());
        assertEquals("Chest", item.meta());
        assertEquals(2, item.totalItems());
        assertEquals(45, item.estimatedDuration());
        assertEquals("W-3", item.code());
        assertNull(item.category());
        assertEquals(3, item.defaultSets());
        assertNull(item.defaultReps());
        assertNull(item.defaultDuration());
    }

    @Test
    @DisplayName("Workout không có thời lượng ước tính -> 0 phút")
    void listMapsWorkoutWithoutDuration() {
        WorkoutEntry custom = workout(4L, "Custom", false, true);
        custom.setExercises(List.of());

        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(favorites.findAllByMemberId(7L)).thenReturn(List.of(
                favorite(13L, MemberFavorite.ItemType.MEMBER_WORKOUT, 4L, LocalDateTime.now())));
        when(workouts.findAllById(List.of(4L))).thenReturn(List.of(custom));

        FavoriteItemResponseDTO item = service.list(EMAIL).get(0);

        assertEquals("CUSTOM", item.source());
        assertEquals(0, item.totalItems());
        assertEquals(0, item.estimatedDuration());
        assertEquals("", item.meta());
    }

    @Test
    @DisplayName("Yêu thích trỏ tới nội dung đã bị xoá -> bỏ qua khỏi danh sách")
    void listSkipsMissingContent() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(favorites.findAllByMemberId(7L)).thenReturn(List.of(
                favorite(14L, MemberFavorite.ItemType.SYSTEM_EXERCISE, 99L, LocalDateTime.now())));
        when(exercises.findAllById(List.of(99L))).thenReturn(List.of());

        assertTrue(service.list(EMAIL).isEmpty());
    }

    @Test
    @DisplayName("Danh sách được sắp xếp mới nhất trước")
    void listSortsByCreatedAtDescending() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(favorites.findAllByMemberId(7L)).thenReturn(List.of(
                favorite(1L, MemberFavorite.ItemType.SYSTEM_EXERCISE, 1L, LocalDateTime.of(2026, 1, 1, 0, 0)),
                favorite(2L, MemberFavorite.ItemType.SYSTEM_EXERCISE, 2L, LocalDateTime.of(2026, 6, 1, 0, 0))));
        when(exercises.findAllById(List.of(1L, 2L))).thenReturn(List.of(
                exercise(1L, "Old", true, true, "REPS"),
                exercise(2L, "New", true, true, "REPS")));

        List<FavoriteItemResponseDTO> items = service.list(EMAIL);

        assertEquals(2, items.size());
        assertEquals("New", items.get(0).title());
        assertEquals("Old", items.get(1).title());
    }

    @Test
    @DisplayName("List với member không tồn tại -> 404")
    void listRejectsUnknownMember() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.list(EMAIL));
    }

    @Test
    @DisplayName("Chỉ có yêu thích workout -> không truy vấn bảng exercises")
    void listSkipsExerciseQueryWhenOnlyWorkouts() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(favorites.findAllByMemberId(7L)).thenReturn(List.of(
                favorite(15L, MemberFavorite.ItemType.SYSTEM_WORKOUT, 3L, LocalDateTime.now())));
        when(workouts.findAllById(List.of(3L))).thenReturn(List.of(workout(3L, "W", true, true)));

        service.list(EMAIL);

        verify(exercises, never()).findAllById(any());
        verify(workouts).findAllById(List.of(3L));
    }

    @Test
    @DisplayName("Chỉ có yêu thích bài tập -> không truy vấn bảng workouts")
    void listSkipsWorkoutQueryWhenOnlyExercises() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(favorites.findAllByMemberId(7L)).thenReturn(List.of(
                favorite(16L, MemberFavorite.ItemType.SYSTEM_EXERCISE, 1L, LocalDateTime.now())));
        when(exercises.findAllById(List.of(1L))).thenReturn(List.of(exercise(1L, "E", true, true, "REPS")));

        service.list(EMAIL);

        verify(workouts, never()).findAllById(any());
        verify(exercises).findAllById(List.of(1L));
    }

    @Test
    @DisplayName("Toggle lưu đúng memberId / itemType / itemId vào bản ghi")
    void togglePersistsCorrectFields() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(exercises.findById(1L)).thenReturn(Optional.of(exercise(1L, "Push-up", true, true, "REPS")));
        when(favorites.existsByMemberIdAndItemTypeAndItemId(7L, MemberFavorite.ItemType.SYSTEM_EXERCISE, 1L))
                .thenReturn(false);
        when(favorites.save(any(MemberFavorite.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(favorites.countByItemTypeAndItemId(MemberFavorite.ItemType.SYSTEM_EXERCISE, 1L)).thenReturn(1L);

        service.toggle(EMAIL, "SYSTEM_EXERCISE", 1L);

        ArgumentCaptor<MemberFavorite> captor = ArgumentCaptor.forClass(MemberFavorite.class);
        verify(favorites).save(captor.capture());
        MemberFavorite saved = captor.getValue();
        assertEquals(7L, saved.getMemberId());
        assertEquals(MemberFavorite.ItemType.SYSTEM_EXERCISE, saved.getItemType());
        assertEquals(1L, saved.getItemId());
    }

    @Test
    @DisplayName("Toggle workout hệ thống lưu đúng loại SYSTEM_WORKOUT")
    void togglePersistsSystemWorkoutType() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
        when(workouts.findById(3L)).thenReturn(Optional.of(workout(3L, "W", true, true)));
        when(favorites.existsByMemberIdAndItemTypeAndItemId(
                eq(7L), eq(MemberFavorite.ItemType.SYSTEM_WORKOUT), anyLong())).thenReturn(false);
        when(favorites.save(any(MemberFavorite.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(favorites.countByItemTypeAndItemId(MemberFavorite.ItemType.SYSTEM_WORKOUT, 3L)).thenReturn(1L);

        service.toggle(EMAIL, "SYSTEM_WORKOUT", 3L);

        ArgumentCaptor<MemberFavorite> captor = ArgumentCaptor.forClass(MemberFavorite.class);
        verify(favorites).save(captor.capture());
        assertEquals(MemberFavorite.ItemType.SYSTEM_WORKOUT, captor.getValue().getItemType());
    }
}
