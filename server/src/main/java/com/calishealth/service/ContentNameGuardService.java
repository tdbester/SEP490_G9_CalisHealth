package com.calishealth.service;

import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.WorkoutRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Chặn trùng tên giữa BÀI TẬP (exercise) và WORKOUT.
 *
 * <p>Hai loại nội dung này cùng nằm trong thư viện và cùng được tìm kiếm /
 * hiển thị cạnh nhau, nên một tên bị dùng cho cả hai sẽ gây nhầm lẫn (ví dụ
 * bấm vào "Push-up" không biết đang mở bài tập hay workout). Vì vậy tên
 * tuyệt đối (không phân biệt hoa thường, bỏ khoảng trắng thừa ở hai đầu) của
 * một bài tập không được trùng với tên của một workout nào đang tồn tại, và
 * ngược lại.</p>
 *
 * <p>So sánh bỏ qua bản ghi đã bị xoá mềm (moderation_status = DELETED) để
 * tên cũ không chặn nội dung mới.</p>
 */
@Service
@RequiredArgsConstructor
public class ContentNameGuardService {
    private final ExerciseRepository exercises;
    private final WorkoutRepository workouts;

    /**
     * Kiểm tra tên bài tập mới (đang tạo/sửa) có trùng tên workout nào không.
     *
     * @param name          tên bài tập mới
     * @param excludeWorkoutId id workout đang sửa (bỏ qua chính nó), null khi tạo mới
     */
    public void assertExerciseNameNotUsedByWorkout(String name, Long excludeWorkoutId) {
        if (name == null || name.isBlank()) {
            return;
        }
        if (workouts.existsActiveByNameIgnoreCase(name.trim(), excludeWorkoutId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This title is already used by a workout. Choose a different title.");
        }
    }

    /**
     * Kiểm tra tên workout mới (đang tạo/sửa) có trùng tên bài tập nào không.
     *
     * @param name            tên workout mới
     * @param excludeExerciseId id bài tập đang sửa (bỏ qua chính nó), null khi tạo mới
     */
    public void assertWorkoutNameNotUsedByExercise(String name, Long excludeExerciseId) {
        if (name == null || name.isBlank()) {
            return;
        }
        if (exercises.existsActiveByNameIgnoreCase(name.trim(), excludeExerciseId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This title is already used by an exercise. Choose a different title.");
        }
    }
}
