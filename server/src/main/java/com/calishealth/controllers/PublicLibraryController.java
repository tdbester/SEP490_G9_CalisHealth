package com.calishealth.controllers;

import com.calishealth.dtos.ExerciseDtos.ExerciseResponse;
import com.calishealth.dtos.ExerciseDtos.WorkoutResponse;
import com.calishealth.security.SessionIdentity;
import com.calishealth.service.ExerciseService;
import com.calishealth.service.WorkoutService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/public/library")
@RequiredArgsConstructor
public class PublicLibraryController {
    private final ExerciseService exercises;
    private final WorkoutService workouts;

    /**
     * Danh sách bài tập công khai.
     *
     * <p>GUEST chỉ được xem danh sách: các trường "chi tiết" (các bước thực
     * hiện, video demo, ảnh giải phẫu) bị gỡ khỏi payload vì giao diện chỉ
     * mở màn chi tiết cho người đã đăng nhập. Nếu không gỡ, GUEST có thể gọi
     * thẳng endpoint này bằng DevTools và lấy được nội dung bị chặn ở UI.
     */
    @GetMapping("/exercises")
    public List<ExerciseResponse> listExercises(Authentication authentication) {
        boolean guest = SessionIdentity.isGuest(authentication);
        return exercises.findAll().stream()
                .filter(ExerciseResponse::active)
                .map(item -> guest ? exercises.toGuestSafe(item) : item)
                .toList();
    }

    /**
     * Chi tiết một bài tập theo mã.
     *
     * <p>GUEST không được xem nội dung chi tiết (hướng dẫn thực hiện, video
     * demo, ảnh giải phẫu) nên response trả về bản rút gọn.
     */
    @GetMapping("/exercises/{code}")
    public ExerciseResponse getExercise(@PathVariable String code, Authentication authentication) {
        ExerciseResponse exercise = exercises.findByCode(code);
        if (!exercise.active()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Exercise or skill not found");
        }
        return SessionIdentity.isGuest(authentication) ? exercises.toGuestSafe(exercise) : exercise;
    }

    @GetMapping("/workouts")
    public List<WorkoutResponse> listWorkouts() {
        return workouts.findAll().stream()
                .filter(WorkoutResponse::active)
                .toList();
    }
}
