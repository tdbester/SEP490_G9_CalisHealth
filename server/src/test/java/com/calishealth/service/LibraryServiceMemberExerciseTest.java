package com.calishealth.service;

import com.calishealth.dtos.LibraryDtos.CreateMemberExerciseRequest;
import com.calishealth.models.Exercise;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Kiểm thử {@link LibraryService} cho các endpoint thư viện legacy.
 *
 * <p>Tập trung vào các lỗ an toàn dữ liệu đã sửa:
 * <ul>
 *   <li>Không cho GUEST tạo bài tập (trước đây bài tạo được nhét vào list
 *       in-memory dùng chung và bị trả cho mọi người).</li>
 *   <li>Chặn trùng tên tuyệt đối với bài tập đã có trong DB.</li>
 * </ul>
 */
class LibraryServiceMemberExerciseTest {

    private ExerciseRepository exercises;
    private WorkoutRepository workouts;
    private UserRepository users;
    private ExerciseMuscleGroupCatalog muscleGroups;
    private FitnessLevelRepository levels;
    private SystemNotificationService notifications;
    private ContentNameGuardService nameGuard;
    private LibraryService service;

    @BeforeEach
    void setUp() {
        exercises = mock(ExerciseRepository.class);
        workouts = mock(WorkoutRepository.class);
        users = mock(UserRepository.class);
        muscleGroups = mock(ExerciseMuscleGroupCatalog.class);
        levels = mock(FitnessLevelRepository.class);
        notifications = mock(SystemNotificationService.class);
        nameGuard = mock(ContentNameGuardService.class);
        service = new LibraryService(
                exercises, workouts, users, muscleGroups, levels, notifications, nameGuard);
    }

    private static CreateMemberExerciseRequest request(String name) {
        return new CreateMemberExerciseRequest(
                name, "Chest", "Beginner", "REPS", "Bodyweight", 3, "10 reps", "Mô tả bài tập");
    }

    private static com.calishealth.models.FitnessLevel level(String name) {
        var level = new com.calishealth.models.FitnessLevel();
        level.setName(name);
        return level;
    }

    @Test
    @DisplayName("Guest không tạo được bài tập và không ghi gì vào DB")
    void rejectsGuestCreatingMemberExercise() {
        assertThatThrownBy(() -> service.createMemberExercise(request("Bài của guest"), null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.UNAUTHORIZED));

        verify(exercises, never()).save(any());
    }

    @Test
    @DisplayName("Email rỗng cũng bị từ chối")
    void rejectsBlankEmail() {
        assertThatThrownBy(() -> service.createMemberExercise(request("Bài"), "   "))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    @DisplayName("Tên trùng bài đã có trong DB bị từ chối (409)")
    void rejectsDuplicateTitle() {
        User member = new User();
        member.setId(7L);
        member.setRole(UserRole.MEMBER);
        when(users.findByEmail("member@example.com")).thenReturn(Optional.of(member));
        when(exercises.existsNotDeletedByNameIgnoreCase("Push-up")).thenReturn(true);

        assertThatThrownBy(() -> service.createMemberExercise(request("Push-up"), "member@example.com"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));

        verify(exercises, never()).save(any());
    }

    @Test
    @DisplayName("Bài hợp lệ được lưu vào DB với tên/code chuẩn")
    void persistsValidMemberExercise() {
        User member = new User();
        member.setId(7L);
        member.setRole(UserRole.MEMBER);
        when(users.findByEmail("member@example.com")).thenReturn(Optional.of(member));
        when(exercises.existsNotDeletedByNameIgnoreCase(anyString())).thenReturn(false);
        when(levels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner")));
        when(exercises.save(any())).thenAnswer(invocation -> {
            Exercise saved = invocation.getArgument(0);
            saved.setId(99L);
            return saved;
        });

        var item = service.createMemberExercise(request("Bài mới của tôi"), "member@example.com");

        assertThat(item.id()).isEqualTo(99L);
        assertThat(item.code()).isEqualTo("CU_99");
        assertThat(item.name()).isEqualTo("Bài mới của tôi");
        verify(exercises, org.mockito.Mockito.atLeastOnce()).save(any());
        verify(notifications).notifyContentManagersPendingApproval("Bài mới của tôi");
    }

    @Test
    @DisplayName("getExerciseById chỉ trả bài hệ thống đã publish")
    void getExerciseByIdOnlyReturnsPublishedSystemExercise() {
        when(exercises.findAcceptedSystemById(12L)).thenReturn(Optional.empty());
        when(exercises.findById(12L)).thenReturn(Optional.of(new Exercise()));

        // Bài id 12 không phải bài hệ thống đã publish -> không được trả về,
        // và không được rơi về bất kỳ bài nào khác trong DB.
        var item = service.getExerciseById("12");
        assertThat(item.id()).isNotEqualTo(12L);
        verify(exercises, never()).findById(eq(12L));
    }
}
