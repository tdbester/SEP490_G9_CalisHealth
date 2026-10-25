package com.calishealth.controllers;

import com.calishealth.dtos.ExerciseDtos.CreateWorkoutRequest;
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
}
