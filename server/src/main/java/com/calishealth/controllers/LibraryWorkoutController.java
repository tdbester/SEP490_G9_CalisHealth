package com.calishealth.controllers;

import com.calishealth.dtos.CreateUpdateWorkoutRequestDTO;
import com.calishealth.dtos.PageResponseDTO;
import com.calishealth.dtos.WorkoutDetailResponseDTO;
import com.calishealth.dtos.WorkoutFilterRequestDTO;
import com.calishealth.dtos.WorkoutListItemDTO;
import com.calishealth.dtos.AvailableWorkoutExerciseDTO;
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
@PreAuthorize("hasRole('MEMBER')")
public class LibraryWorkoutController {
    private final LibraryWorkoutService workoutService;

    @GetMapping("/custom-workouts")
    public ResponseEntity<PageResponseDTO<WorkoutListItemDTO>> community(
            @Valid @ModelAttribute WorkoutFilterRequestDTO filter,
            Authentication authentication
    ) {
        return ResponseEntity.ok(workoutService.getCommunityWorkouts(authentication.getName(), filter));
    }

    @GetMapping("/custom-workouts/{id}")
    public ResponseEntity<WorkoutDetailResponseDTO> communityDetail(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(workoutService.getCommunityWorkoutDetail(authentication.getName(), id));
    }

    @GetMapping("/my-workouts")
    public ResponseEntity<PageResponseDTO<WorkoutListItemDTO>> mine(
            @Valid @ModelAttribute WorkoutFilterRequestDTO filter,
            Authentication authentication
    ) {
        return ResponseEntity.ok(workoutService.getMyWorkouts(authentication.getName(), filter));
    }

    @GetMapping("/my-workouts/{id}")
    public ResponseEntity<WorkoutDetailResponseDTO> detail(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(workoutService.getWorkoutDetail(authentication.getName(), id));
    }

    @PostMapping("/my-workouts")
    public ResponseEntity<WorkoutDetailResponseDTO> create(
            @Valid @RequestBody CreateUpdateWorkoutRequestDTO request,
            Authentication authentication
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(workoutService.createWorkout(authentication.getName(), request));
    }

    @PutMapping("/my-workouts/{id}")
    public ResponseEntity<WorkoutDetailResponseDTO> update(
            @PathVariable Long id,
            @Valid @RequestBody CreateUpdateWorkoutRequestDTO request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(workoutService.updateWorkout(authentication.getName(), id, request));
    }

    @DeleteMapping("/my-workouts/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
        workoutService.deleteWorkout(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/workout-exercises/available")
    public ResponseEntity<List<AvailableWorkoutExerciseDTO>> available(Authentication authentication) {
        return ResponseEntity.ok(workoutService.getAvailableExercises(authentication.getName()));
    }
}
