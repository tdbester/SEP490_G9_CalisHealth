package com.calishealth.service;

import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.WorkoutRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/** Bo sung coverage cho cac nhanh "ten rong -> bo qua" cua {@link ContentNameGuardService}. */
class ContentNameGuardServiceExtraCoverageTest {
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
    @DisplayName("Ten null -> khong kiem tra gi ca")
    void nullNameSkipsEveryCheck() {
        assertThatCode(() -> guard.assertExerciseNameNotUsedByWorkout(null, null)).doesNotThrowAnyException();
        assertThatCode(() -> guard.assertExerciseNameNotUsedByExercise(null, null)).doesNotThrowAnyException();
        assertThatCode(() -> guard.assertWorkoutNameNotUsedByExercise(null, null)).doesNotThrowAnyException();
        assertThatCode(() -> guard.assertSystemWorkoutNameNotUsedByWorkout(null, null)).doesNotThrowAnyException();
        assertThatCode(() -> guard.assertMemberWorkoutNameNotUsedByWorkout(null, 7L, null)).doesNotThrowAnyException();

        verify(workouts, never()).existsActiveByNameIgnoreCase(any(), any());
        verify(exercises, never()).existsOtherNotDeletedByNameIgnoreCase(anyLong(), any());
        verify(exercises, never()).existsActiveByNameIgnoreCase(any(), any());
    }

    @Test
    @DisplayName("Ten chi khoang trang -> khong kiem tra gi ca")
    void blankNameSkipsEveryCheck() {
        assertThatCode(() -> guard.assertExerciseNameNotUsedByWorkout("   ", null)).doesNotThrowAnyException();
        assertThatCode(() -> guard.assertExerciseNameNotUsedByExercise("  ", null)).doesNotThrowAnyException();
        assertThatCode(() -> guard.assertWorkoutNameNotUsedByExercise(" ", null)).doesNotThrowAnyException();
        assertThatCode(() -> guard.assertSystemWorkoutNameNotUsedByWorkout("  ", null)).doesNotThrowAnyException();

        verify(workouts, never()).existsActiveByNameIgnoreCase(any(), any());
        verify(exercises, never()).existsOtherNotDeletedByNameIgnoreCase(anyLong(), any());
        verify(exercises, never()).existsActiveByNameIgnoreCase(any(), any());
        verify(workouts, never()).existsActiveSystemByNameIgnoreCase(any(), any());
    }

    @Test
    @DisplayName("Ten workout ca nhan rong -> khong kiem tra gi ca")
    void memberWorkoutWithoutOwnerSkipsCheck() {
        assertThatCode(() -> guard.assertMemberWorkoutNameNotUsedByWorkout("Leg Day", null, null))
                .doesNotThrowAnyException();

        verify(workouts, never()).existsActiveCustomByAuthorAndNameIgnoreCase(anyLong(), any(), any());
    }
}
