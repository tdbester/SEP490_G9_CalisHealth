package com.calishealth.service;

import com.calishealth.dtos.ExerciseDtos.ExerciseResponse;
import com.calishealth.models.Exercise;
import com.calishealth.repository.ExerciseModerationHistoryRepository;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.ExerciseTreeEdgeRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Kiểm thử phần "cắt quyền xem" cho GUEST ở API công khai.
 *
 * <p>GUEST chỉ được xem DANH SÁCH bài tập / workout. Các nội dung chi tiết
 * (hướng dẫn thực hiện, video demo, ảnh giải phẫu) phải bị gỡ khỏi payload
 * của endpoint công khai, nếu không giao diện đang chặn ở UI chỉ là "ảo".
 */
class GuestExerciseVisibilityTest {

    private ExerciseRepository exerciseRepository;
    private ExerciseService exerciseService;

    @BeforeEach
    void setUp() {
        exerciseRepository = mock(ExerciseRepository.class);
        exerciseService = new ExerciseService(
                exerciseRepository,
                mock(ExerciseModerationHistoryRepository.class),
                mock(UserRepository.class),
                mock(JdbcTemplate.class),
                mock(MediaRegistryService.class),
                mock(ExerciseTreeEdgeRepository.class),
                mock(FitnessLevelRepository.class),
                mock(ExerciseMuscleGroupCatalog.class),
                mock(SystemNotificationService.class),
                mock(ExercisePhysiologyService.class),
                mock(ContentNameGuardService.class));
    }

    private static Exercise activeExercise() {
        Exercise exercise = new Exercise();
        exercise.setId(5L);
        exercise.setCode("EX_5");
        exercise.setName("Push-up");
        exercise.setType("HEALTH");
        exercise.setCategory("REPS");
        exercise.setLevel("Beginner");
        exercise.setModerationStatus("ACTIVE");
        exercise.setActive(true);
        exercise.setUpdatedAt(LocalDateTime.now());
        exercise.setExecutionSteps("1. Place hands on the floor.\n2. Lower the chest.");
        exercise.setVideoUrl("/media/exercise-demos/pushup.mp4");
        exercise.setAnatomyImageUrl("/media/exercise-anatomy/pushup.png");
        return exercise;
    }

    @Test
    @DisplayName("Bản rút gọn cho guest bỏ hướng dẫn, video demo và ảnh giải phẫu")
    void guestSafeResponseDropsDetailOnlyContent() {
        ExerciseResponse full = new ExerciseResponse(
                "EX_5", "PUSH", "Push-up", "Health", "Mô tả", "REPS", "Chest", "Beginner",
                "1. Place hands on the floor.", "/media/exercise-demos/pushup.mp4",
                "/media/exercise-anatomy/pushup.png", "SYSTEM", "Content Manager",
                10, 30, true, LocalDateTime.now(), LocalDateTime.now(), "PASSED",
                3, true, true, null);

        ExerciseResponse guest = exerciseService.toGuestSafe(full);

        assertThat(guest.guide()).isNull();
        assertThat(guest.demoVideoUrl()).isNull();
        assertThat(guest.anatomyImageUrl()).isNull();
        assertThat(guest.physiology()).isNull();
        // Vẫn giữ đủ thông tin để hiển thị DANH SÁCH.
        assertThat(guest.code()).isEqualTo("EX_5");
        assertThat(guest.name()).isEqualTo("Push-up");
        assertThat(guest.muscleGroup()).isEqualTo("Chest");
        assertThat(guest.level()).isEqualTo("Beginner");
    }

    @Test
    @DisplayName("Endpoint công khai không trả video demo / ảnh giải phẫu / hướng dẫn cho guest")
    void publicExerciseListLeaksNoDetailContent() {
        when(exerciseRepository.findAll()).thenReturn(List.of(activeExercise()));

        // Endpoint /api/public/library/exercises dùng findAll() rồi mới cắt bằng toGuestSafe().
        List<ExerciseResponse> guestList = exerciseService.findAll().stream()
                .map(exerciseService::toGuestSafe)
                .toList();

        assertThat(guestList).hasSize(1);
        ExerciseResponse item = guestList.get(0);
        assertThat(item.guide()).isNull();
        assertThat(item.demoVideoUrl()).isNull();
        assertThat(item.anatomyImageUrl()).isNull();
    }

    @Test
    @DisplayName("Chi tiết công khai vẫn trả nội dung đầy đủ cho người đã đăng nhập")
    void publicExerciseDetailKeepsContentForAuthenticatedUsers() {
        when(exerciseRepository.findByCode("EX_5")).thenReturn(Optional.of(activeExercise()));

        ExerciseResponse detail = exerciseService.findByCode("EX_5");

        assertThat(detail.guide()).isNotBlank();
        assertThat(detail.demoVideoUrl()).isEqualTo("/media/exercise-demos/pushup.mp4");
        assertThat(detail.anatomyImageUrl()).isEqualTo("/media/exercise-anatomy/pushup.png");
    }
}
