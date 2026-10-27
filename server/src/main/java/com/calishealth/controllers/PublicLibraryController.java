package com.calishealth.controllers;

import com.calishealth.dtos.ExerciseDtos.ExerciseResponse;
import com.calishealth.dtos.ExerciseDtos.WorkoutResponse;
import com.calishealth.service.ExerciseService;
import com.calishealth.service.WorkoutService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/library")
@RequiredArgsConstructor
public class PublicLibraryController {
    private final ExerciseService exercises;
    private final WorkoutService workouts;

    @GetMapping("/exercises")
    public List<ExerciseResponse> listExercises() {
        return exercises.findAll().stream()
                .filter(ExerciseResponse::active)
                .toList();
    }

    @GetMapping("/workouts")
    public List<WorkoutResponse> listWorkouts() {
        return workouts.findAll().stream()
                .filter(WorkoutResponse::active)
                .toList();
    }
}
