package com.calishealth.service;

import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.models.User;
import com.calishealth.models.WorkoutEntry;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bo sung coverage cho {@link LibraryWorkoutService}: workout khong ton tai, workout cua
 * nguoi khac, workout he thong khong duoc xem nhu cong cong va member khong ton tai.
 */
class LibraryWorkoutServiceGapTest {

    private WorkoutRepository workouts;
    private ExerciseRepository exercises;
    private UserRepository users;
    private LibraryWorkoutService service;

    @BeforeEach
    void setUp() {
        workouts = mock(WorkoutRepository.class);
        exercises = mock(ExerciseRepository.class);
        users = mock(UserRepository.class);
        service = new LibraryWorkoutService(workouts, exercises, users,
                mock(FitnessLevelRepository.class),
                mock(ContentNameGuardService.class), mock(ExerciseUnlockService.class));
        lenient().when(exercises.findAllById(any())).thenReturn(List.of());
    }

    private static User member(long id, String email) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        return user;
    }

    private static WorkoutEntry systemWorkout(long id) {
        WorkoutEntry entry = new WorkoutEntry();
        entry.setId(id);
        entry.setName("Full body");
        entry.setType("HEALTH");
        entry.setTemplateStatus("PUBLISHED");
        entry.setModerationStatus("ACTIVE");
        entry.setSource("SYSTEM");
        entry.setExercises(List.of());
        return entry;
    }

    private static WorkoutEntry communityWorkout(long id, long authorId) {
        WorkoutEntry entry = new WorkoutEntry();
        entry.setId(id);
        entry.setName("Shared");
        entry.setType("HEALTH");
        entry.setTemplateStatus("PUBLISHED");
        entry.setModerationStatus("ACTIVE");
        entry.setSource("CUSTOM");
        entry.setSharedWithCommunity(true);
        User author = new User();
        author.setId(authorId);
        entry.setCreatedBy(author);
        entry.setExercises(List.of());
        return entry;
    }

    @Test
    @DisplayName("getSystemWorkoutDetail: member khong ton tai -> 404")
    void systemWorkoutDetailRejectsUnknownMember() {
        when(workouts.findById(1L)).thenReturn(Optional.of(systemWorkout(1L)));
        when(users.findByEmail("ghost@calishealth.vn")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getSystemWorkoutDetail("ghost@calishealth.vn", 1L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getSystemWorkoutDetail: workout khong ton tai -> 404")
    void systemWorkoutDetailRejectsMissingWorkout() {
        when(workouts.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getSystemWorkoutDetail("member@calishealth.vn", 9L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getSystemWorkoutDetail: member hop le -> tra ve chi tiet")
    void systemWorkoutDetailReturnsDetail() {
        when(workouts.findById(1L)).thenReturn(Optional.of(systemWorkout(1L)));
        when(users.findByEmail("member@calishealth.vn"))
                .thenReturn(Optional.of(member(5L, "member@calishealth.vn")));

        var detail = service.getSystemWorkoutDetail("member@calishealth.vn", 1L);

        assertThat(detail).isNotNull();
        assertThat(detail.title()).isEqualTo("Full body");
    }

    @Test
    @DisplayName("getCommunityWorkoutDetail: workout khong ton tai -> 404")
    void communityWorkoutDetailRejectsMissingWorkout() {
        when(users.findByEmail("member@calishealth.vn"))
                .thenReturn(Optional.of(member(5L, "member@calishealth.vn")));
        when(workouts.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getCommunityWorkoutDetail("member@calishealth.vn", 9L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getCommunityWorkoutDetail: workout he thong -> 404")
    void communityWorkoutDetailRejectsSystemWorkout() {
        when(users.findByEmail("member@calishealth.vn"))
                .thenReturn(Optional.of(member(5L, "member@calishealth.vn")));
        when(workouts.findById(1L)).thenReturn(Optional.of(systemWorkout(1L)));

        assertThatThrownBy(() -> service.getCommunityWorkoutDetail("member@calishealth.vn", 1L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getCommunityWorkoutDetail: workout cong cong -> tra ve chi tiet")
    void communityWorkoutDetailReturnsDetail() {
        when(users.findByEmail("member@calishealth.vn"))
                .thenReturn(Optional.of(member(5L, "member@calishealth.vn")));
        when(workouts.findById(2L)).thenReturn(Optional.of(communityWorkout(2L, 5L)));

        var detail = service.getCommunityWorkoutDetail("member@calishealth.vn", 2L);

        assertThat(detail).isNotNull();
        assertThat(detail.title()).isEqualTo("Shared");
    }

    @Test
    @DisplayName("getWorkoutDetail: workout khong ton tai -> 404")
    void workoutDetailRejectsMissingWorkout() {
        when(users.findByEmail("member@calishealth.vn"))
                .thenReturn(Optional.of(member(5L, "member@calishealth.vn")));
        when(workouts.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getWorkoutDetail("member@calishealth.vn", 9L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getWorkoutDetail: workout cua nguoi khac -> 404")
    void workoutDetailRejectsForeignWorkout() {
        when(users.findByEmail("member@calishealth.vn"))
                .thenReturn(Optional.of(member(5L, "member@calishealth.vn")));
        when(workouts.findById(2L)).thenReturn(Optional.of(communityWorkout(2L, 99L)));

        assertThatThrownBy(() -> service.getWorkoutDetail("member@calishealth.vn", 2L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getWorkoutDetail: workout cua chinh member -> tra ve chi tiet")
    void workoutDetailReturnsOwnedWorkout() {
        when(users.findByEmail("member@calishealth.vn"))
                .thenReturn(Optional.of(member(5L, "member@calishealth.vn")));
        when(workouts.findById(2L)).thenReturn(Optional.of(communityWorkout(2L, 5L)));

        var detail = service.getWorkoutDetail("member@calishealth.vn", 2L);

        assertThat(detail).isNotNull();
        assertThat(detail.title()).isEqualTo("Shared");
    }
}
