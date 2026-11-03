package com.calishealth.controllers;

import com.calishealth.dtos.ExerciseDtos.ExerciseResponse;
import com.calishealth.dtos.ExerciseDtos.WorkoutResponse;
import com.calishealth.service.ExerciseService;
import com.calishealth.service.WorkoutService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.server.ResponseStatusException;
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

    @GetMapping("/exercises/{code}")
    public ExerciseResponse getExercise(@PathVariable String code) {
        ExerciseResponse exercise = exercises.findByCode(code);
        if (!exercise.active()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Exercise or skill not found");
        }
        return exercise;
    }

    @GetMapping("/workouts")
    public List<WorkoutResponse> listWorkouts() {
        return workouts.findAll().stream()
                .filter(WorkoutResponse::active)
                .toList();
    }
}
