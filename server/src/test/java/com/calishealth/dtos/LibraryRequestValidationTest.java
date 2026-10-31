package com.calishealth.dtos;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertTrue;

class LibraryRequestValidationTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void validatesPersonalExerciseFieldsAndGuideSteps() {
        CreatePersonalExerciseRequestDTO request = new CreatePersonalExerciseRequestDTO(
                "   ",
                "d".repeat(301),
                null,
                List.of("  "),
                "Full body",
                3,
                10,
                null,
                true,
                false,
                null,
                null,
                null,
                null
        );

        Set<String> violations = validator.validate(request).stream()
                .map(violation -> violation.getPropertyPath() + ":" + violation.getMessage())
                .collect(Collectors.toSet());

        assertTrue(violations.contains("title:Exercise title is required"));
        assertTrue(violations.contains("description:Description must not exceed 300 characters"));
        assertTrue(violations.contains("level:Please select an exercise level"));
        assertTrue(violations.contains("guideSteps[0].<list element>:Instruction steps cannot be blank"));
    }

    @Test
    void validatesWorkoutFieldsAndNestedItems() {
        CreateUpdateWorkoutRequestDTO request = new CreateUpdateWorkoutRequestDTO(
                "  ",
                "n".repeat(201),
                false,
                List.of(new WorkoutItemDTO(1L, 0, 101, 0, null, "REPS", 181))
        );

        Set<String> violations = validator.validate(request).stream()
                .map(violation -> violation.getPropertyPath() + ":" + violation.getMessage())
                .collect(Collectors.toSet());

        assertTrue(violations.contains("title:Workout title is required"));
        assertTrue(violations.contains("description:Description must not exceed 200 characters"));
        assertTrue(violations.contains("items[0].sets:Sets must not exceed 100"));
        assertTrue(violations.contains("items[0].reps:Reps must be at least 1"));
        assertTrue(violations.contains("items[0].restSeconds:Rest time must not exceed 180 seconds"));
    }

    @Test
    void requiresAtLeastOneWorkoutItem() {
        CreateUpdateWorkoutRequestDTO request = new CreateUpdateWorkoutRequestDTO(
                "Workout",
                null,
                false,
                List.of()
        );

        assertTrue(validator.validate(request).stream()
                .anyMatch(violation -> violation.getPropertyPath().toString().equals("items")
                        && violation.getMessage().equals("A workout must contain at least one exercise")));
    }

    @Test
    void acceptsWorkoutRestTimeUpTo180Seconds() {
        CreateUpdateWorkoutRequestDTO request = new CreateUpdateWorkoutRequestDTO(
                "Workout",
                null,
                false,
                List.of(new WorkoutItemDTO(1L, 0, 3, 10, null, "REPS", 180))
        );

        assertTrue(validator.validate(request).stream()
                .noneMatch(violation -> violation.getPropertyPath().toString().equals("items[0].restSeconds")));
    }
}
