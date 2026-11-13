package com.calishealth.controllers;

import com.calishealth.dtos.CreateUpdateWorkoutRequestDTO;
import com.calishealth.dtos.PageResponseDTO;
import com.calishealth.dtos.WorkoutDetailResponseDTO;
import com.calishealth.dtos.WorkoutFilterRequestDTO;
import com.calishealth.dtos.WorkoutListItemDTO;
import com.calishealth.dtos.AvailableWorkoutExerciseDTO;
import com.calishealth.security.SessionIdentity;
import com.calishealth.service.LibraryWorkoutService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/library")
@RequiredArgsConstructor
public class LibraryWorkoutController {
    private final LibraryWorkoutService workoutService;

    /**
     * Email của người đang đăng nhập, hoặc null khi là GUEST (chưa đăng nhập).
     * Endpoint danh sách workout hệ thống mở cho guest nên không được phép
     * gọi authentication.getName() trực tiếp — token "anonymousUser" sẽ làm
     * requireMember() ném lỗi 404.
     */
    private static String emailOf(Authentication authentication) {
        return SessionIdentity.emailOf(authentication);
    }

    @GetMapping("/custom-workouts")
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<PageResponseDTO<WorkoutListItemDTO>> community(
            @Valid @ModelAttribute WorkoutFilterRequestDTO filter,
            Authentication authentication
    ) {
        return ResponseEntity.ok(workoutService.getCommunityWorkouts(authentication.getName(), filter));
    }

    /**
     * Danh sách workout hệ thống (HEALTH / SKILL) — công khai để GUEST xem
     * được. Mỗi bài khi bấm vào xem chi tiết vẫn bị chặn ở frontend.
     */
    @GetMapping("/system-workouts")
    public ResponseEntity<PageResponseDTO<WorkoutListItemDTO>> system(
            @RequestParam String type,
            @Valid @ModelAttribute WorkoutFilterRequestDTO filter,
            Authentication authentication
    ) {
        return ResponseEntity.ok(workoutService.getSystemWorkouts(emailOf(authentication), type, filter));
    }

    @GetMapping("/system-workouts/{id}")
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<WorkoutDetailResponseDTO> systemDetail(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(workoutService.getSystemWorkoutDetail(authentication.getName(), id));
    }

    @GetMapping("/custom-workouts/{id}")
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<WorkoutDetailResponseDTO> communityDetail(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(workoutService.getCommunityWorkoutDetail(authentication.getName(), id));
    }

    @GetMapping("/my-workouts")
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<PageResponseDTO<WorkoutListItemDTO>> mine(
            @Valid @ModelAttribute WorkoutFilterRequestDTO filter,
            Authentication authentication
    ) {
        return ResponseEntity.ok(workoutService.getMyWorkouts(authentication.getName(), filter));
    }

    @GetMapping("/my-workouts/{id}")
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<WorkoutDetailResponseDTO> detail(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(workoutService.getWorkoutDetail(authentication.getName(), id));
    }

    @PostMapping("/my-workouts")
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<WorkoutDetailResponseDTO> create(
            @Valid @RequestBody CreateUpdateWorkoutRequestDTO request,
            Authentication authentication
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(workoutService.createWorkout(authentication.getName(), request));
    }

    @PutMapping("/my-workouts/{id}")
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<WorkoutDetailResponseDTO> update(
            @PathVariable Long id,
            @Valid @RequestBody CreateUpdateWorkoutRequestDTO request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(workoutService.updateWorkout(authentication.getName(), id, request));
    }

    @DeleteMapping("/my-workouts/{id}")
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
        workoutService.deleteWorkout(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/workout-exercises/available")
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<List<AvailableWorkoutExerciseDTO>> available(Authentication authentication) {
        return ResponseEntity.ok(workoutService.getAvailableExercises(authentication.getName()));
    }
}
