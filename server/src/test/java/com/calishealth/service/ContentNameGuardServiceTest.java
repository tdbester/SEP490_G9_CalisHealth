package com.calishealth.service;

import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.WorkoutRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Kiểm thử {@code ContentNameGuardService} — chặn trùng tên nội dung.
 *
 * <p>Quan trọng nhất là phạm vi kiểm tra: workout hệ thống chỉ đụng workout hệ
 * thống, workout cá nhân chỉ đụng workout cá nhân CỦA CHÍNH member đó. Nếu
 * không giới hạn phạm vi thì mọi member sẽ bị chặn khi trùng tên với người
 * khác — hoặc workout hệ thống bị chặn vì một member tạo bài cùng tên.</p>
 */
class ContentNameGuardServiceTest {

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
    @DisplayName("Tên workout hệ thống trùng workout hệ thống khác thì bị chặn 409")
    void systemWorkoutNameMustBeUniqueAmongSystemWorkouts() {
        when(workouts.existsActiveSystemByNameIgnoreCase(eq("Full Body"), eq(null))).thenReturn(true);

        assertThatThrownBy(() -> guard.assertSystemWorkoutNameNotUsedByWorkout("Full Body", null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("Tên trùng nhưng khác hoa thường/thừa khoảng trắng vẫn bị chặn")
    void systemWorkoutNameIsTrimmedAndCaseInsensitive() {
        // Service chỉ trim; so khớp không phân biệt hoa thường do SQL (lower(trim(...))).
        when(workouts.existsActiveSystemByNameIgnoreCase(eq("Full Body"), eq(null))).thenReturn(true);

        assertThatThrownBy(() -> guard.assertSystemWorkoutNameNotUsedByWorkout("  Full Body  ", null))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("Workout hệ thống không bị chặn vì workout cá nhân của member trùng tên")
    void systemWorkoutIgnoresMemberCustomWorkouts() {
        when(workouts.existsActiveSystemByNameIgnoreCase(any(), any())).thenReturn(false);

        assertThatCode(() -> guard.assertSystemWorkoutNameNotUsedByWorkout("Full Body", null))
                .doesNotThrowAnyException();
        // Không được hỏi cả nhóm workout cá nhân.
        verify(workouts, never()).existsActiveCustomByAuthorAndNameIgnoreCase(anyLong(), any(), any());
    }

    @Test
    @DisplayName("Workout cá nhân trùng tên của chính member đó thì bị chặn 409")
    void memberWorkoutNameMustBeUniqueWithinOwnScope() {
        when(workouts.existsActiveCustomByAuthorAndNameIgnoreCase(eq(7L), eq("Leg Day"), eq(null)))
                .thenReturn(true);

        assertThatThrownBy(() -> guard.assertMemberWorkoutNameNotUsedByWorkout("Leg Day", 7L, null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("Hai member khác nhau được phép dùng cùng một tên workout cá nhân")
    void memberWorkoutNameIsScopedToOwner() {
        when(workouts.existsActiveCustomByAuthorAndNameIgnoreCase(eq(7L), eq("Leg Day"), eq(null)))
                .thenReturn(false);

        assertThatCode(() -> guard.assertMemberWorkoutNameNotUsedByWorkout("Leg Day", 7L, null))
                .doesNotThrowAnyException();
        verify(workouts).existsActiveCustomByAuthorAndNameIgnoreCase(7L, "Leg Day", null);
    }

    @Test
    @DisplayName("Sửa workout cá nhân thì chính nó bị bỏ qua khi so trùng tên")
    void memberWorkoutExcludesItselfOnUpdate() {
        when(workouts.existsActiveCustomByAuthorAndNameIgnoreCase(eq(7L), eq("Leg Day"), eq(99L)))
                .thenReturn(false);

        assertThatCode(() -> guard.assertMemberWorkoutNameNotUsedByWorkout("Leg Day", 7L, 99L))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Tên rỗng thì không kiểm tra gì cả")
    void blankNameSkipsCheck() {
        assertThatCode(() -> guard.assertSystemWorkoutNameNotUsedByWorkout("   ", null))
                .doesNotThrowAnyException();
        assertThatCode(() -> guard.assertMemberWorkoutNameNotUsedByWorkout("", 7L, null))
                .doesNotThrowAnyException();
        verify(workouts, never()).existsActiveSystemByNameIgnoreCase(any(), any());
    }

    @Test
    @DisplayName("Tên bài tập trùng tên workout thì bị chặn")
    void exerciseNameMustNotClashWithWorkoutName() {
        when(workouts.existsActiveByNameIgnoreCase(eq("Push-up"), eq(null))).thenReturn(true);

        assertThatThrownBy(() -> guard.assertExerciseNameNotUsedByWorkout("Push-up", null))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("Tên workout trùng tên bài tập thì bị chặn")
    void workoutNameMustNotClashWithExerciseName() {
        when(exercises.existsActiveByNameIgnoreCase(eq("Push-up"), eq(null))).thenReturn(true);

        assertThatThrownBy(() -> guard.assertWorkoutNameNotUsedByExercise("Push-up", null))
                .isInstanceOf(ResponseStatusException.class);
    }
}
