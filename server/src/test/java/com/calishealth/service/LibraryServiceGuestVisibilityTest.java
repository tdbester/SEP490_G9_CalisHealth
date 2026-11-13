package com.calishealth.service;

import com.calishealth.models.Exercise;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Kiểm thử endpoint thư viện legacy {@code GET /api/library/exercises} (mở cho GUEST).
 *
 * <p>GUEST chỉ được xem DANH SÁCH — link video demo phải được gỡ khỏi payload
 * để guest không thể tự gọi API và mở xem "Watch Exercise Demo".
 */
class LibraryServiceGuestVisibilityTest {

    private ExerciseRepository exercises;
    private LibraryService service;

    @BeforeEach
    void setUp() {
        exercises = mock(ExerciseRepository.class);
        service = new LibraryService(
                exercises,
                mock(WorkoutRepository.class),
                mock(UserRepository.class),
                mock(ExerciseMuscleGroupCatalog.class),
                mock(FitnessLevelRepository.class),
                mock(SystemNotificationService.class),
                mock(ContentNameGuardService.class));
    }

    private static Exercise systemExerciseWithVideo() {
        Exercise exercise = new Exercise();
        exercise.setId(31L);
        exercise.setCode("EX_31");
        exercise.setName("Dips");
        exercise.setType("HEALTH");
        exercise.setCategory("REPS");
        exercise.setLevel("Intermediate");
        exercise.setSource("SYSTEM");
        exercise.setActive(true);
        exercise.setModerationStatus("ACTIVE");
        exercise.setVideoUrl("/media/exercise-demos/dips.mp4");
        return exercise;
    }

    @Test
    @DisplayName("Guest không nhận được link video demo trong danh sách bài tập")
    void guestExerciseListOmitsDemoVideoUrl() {
        when(exercises.findAll()).thenReturn(List.of(systemExerciseWithVideo()));

        var page = service.getExercises("all", "all", "all", "all", null, null, 1, 10, null);

        assertThat(page.items()).isNotEmpty();
        assertThat(page.items())
                .allSatisfy(item -> assertThat(item.demoVideoUrl()).isNull());
    }

    @Test
    @DisplayName("Người đã đăng nhập vẫn nhận được link video demo trong danh sách")
    void signedInMemberStillReceivesDemoVideoUrl() {
        when(exercises.findAll()).thenReturn(List.of(systemExerciseWithVideo()));

        var page = service.getExercises("all", "all", "all", "all", null, null, 1, 10, "member@example.com");

        assertThat(page.items())
                .anySatisfy(item -> assertThat(item.demoVideoUrl()).isEqualTo("/media/exercise-demos/dips.mp4"));
    }
}
