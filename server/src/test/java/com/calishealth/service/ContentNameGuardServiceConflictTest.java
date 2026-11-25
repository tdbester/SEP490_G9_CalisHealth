package com.calishealth.service;

import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.WorkoutRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bo sung coverage cho {@link ContentNameGuardService}: cac nhanh "trung ten -> 409".
 */
class ContentNameGuardServiceConflictTest {

    private ExerciseRepository exercises;
    private WorkoutRepository workouts;
    private ContentNameGuardService guard;

    @BeforeEach
    void setUp() {
        exercises = mock(ExerciseRepository.class);
        workouts = mock(WorkoutRepository.class);
        guard = new ContentNameGuardService(exercises, workouts);
    }

    @Test
    @DisplayName("Ten bai tap trung ten workout -> 409")
    void exerciseNameClashingWithWorkoutIsRejected() {
        when(workouts.existsActiveByNameIgnoreCase(any(), any())).thenReturn(true);

        assertThatThrownBy(() -> guard.assertExerciseNameNotUsedByWorkout("Push-up", null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("Ten bai tap trung ten bai tap khac -> 409")
    void exerciseNameClashingWithExerciseIsRejected() {
        when(exercises.existsOtherNotDeletedByNameIgnoreCase(anyLong(), any())).thenReturn(true);

        assertThatThrownBy(() -> guard.assertExerciseNameNotUsedByExercise("Push-up", null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("Ten workout trung ten bai tap -> 409")
    void workoutNameClashingWithExerciseIsRejected() {
        when(exercises.existsActiveByNameIgnoreCase(any(), any())).thenReturn(true);

        assertThatThrownBy(() -> guard.assertWorkoutNameNotUsedByExercise("Push-up", null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("Ten workout he thong trung ten workout he thong -> 409")
    void systemWorkoutNameClashingIsRejected() {
        when(workouts.existsActiveSystemByNameIgnoreCase(any(), any())).thenReturn(true);

        assertThatThrownBy(() -> guard.assertSystemWorkoutNameNotUsedByWorkout("Leg Day", null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("Ten workout ca nhan trung ten trong cua member -> 409")
    void memberWorkoutNameClashingIsRejected() {
        when(workouts.existsActiveCustomByAuthorAndNameIgnoreCase(anyLong(), any(), any())).thenReturn(true);

        assertThatThrownBy(() -> guard.assertMemberWorkoutNameNotUsedByWorkout("Leg Day", 7L, null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));
    }
}
