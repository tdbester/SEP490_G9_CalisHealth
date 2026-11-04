package com.calishealth.controllers;

import com.calishealth.dtos.ExerciseFilterRequestDTO;
import com.calishealth.dtos.ExerciseItemResponseDTO;
import com.calishealth.dtos.PageResponseDTO;
import com.calishealth.dtos.SystemExerciseDetailResponseDTO;
import com.calishealth.service.ExerciseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/library/exercises")
@RequiredArgsConstructor
public class LibraryExerciseController {
    private final ExerciseService exerciseService;

    @GetMapping
    public ResponseEntity<PageResponseDTO<ExerciseItemResponseDTO>> getSystemExercises(
            @Valid @ModelAttribute ExerciseFilterRequestDTO filterRequest
    ) {
        return ResponseEntity.ok(exerciseService.getSystemExercises(filterRequest));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SystemExerciseDetailResponseDTO> getSystemExerciseDetail(
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(exerciseService.getSystemExerciseDetail(id));
    }
}
