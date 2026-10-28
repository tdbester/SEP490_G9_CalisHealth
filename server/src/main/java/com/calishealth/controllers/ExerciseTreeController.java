package com.calishealth.controllers;

import com.calishealth.dtos.ExerciseTreeResponseDTO;
import com.calishealth.models.Exercise;
import com.calishealth.service.ExerciseTreeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/library/exercise-tree")
@RequiredArgsConstructor
public class ExerciseTreeController {
    private final ExerciseTreeService exerciseTreeService;

    @GetMapping
    public ResponseEntity<ExerciseTreeResponseDTO> getTree(
            @RequestParam(defaultValue = "PUSH") Exercise.MovementGroup movementGroup,
            @RequestParam(defaultValue = "EASY_TO_HARD") ExerciseTreeService.TreeOrder order,
            Authentication authentication
    ) {
        return ResponseEntity.ok(exerciseTreeService.getTree(
                movementGroup,
                order,
                authentication.getName()));
    }
}
