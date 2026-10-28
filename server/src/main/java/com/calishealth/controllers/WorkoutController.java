package com.calishealth.controllers;

import com.calishealth.dtos.ExerciseDtos.CreateWorkoutRequest;
import com.calishealth.dtos.ExerciseDtos.ExerciseStatusRequest;
import com.calishealth.dtos.ExerciseDtos.WorkoutResponse;
import com.calishealth.service.WorkoutService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/content/workouts")
@RequiredArgsConstructor
public class WorkoutController {
    private final WorkoutService workouts;

    @GetMapping
    public List<WorkoutResponse> list() {
        return workouts.findAll();
    }

    @GetMapping("/{code}")
    public WorkoutResponse get(@PathVariable String code) {
        return workouts.findByCode(code);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WorkoutResponse create(@RequestBody CreateWorkoutRequest request, Authentication authentication) {
        return workouts.create(request, authentication.getName());
    }

    @PutMapping("/{code}")
    public WorkoutResponse update(@PathVariable String code, @RequestBody CreateWorkoutRequest request) {
        return workouts.update(code, request);
    }

    @DeleteMapping("/{code}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String code) {
        workouts.deleteByCode(code);
    }

    @PatchMapping("/{code}/status")
    public WorkoutResponse updateStatus(
            @PathVariable String code,
            @RequestBody ExerciseStatusRequest request
    ) {
        return workouts.updateStatus(code, request.active());
    }
}
