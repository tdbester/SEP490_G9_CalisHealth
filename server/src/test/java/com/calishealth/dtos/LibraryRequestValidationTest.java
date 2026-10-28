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

        assertTrue(violations.contains("title:Tên bài tập không được để trống"));
        assertTrue(violations.contains("description:Mô tả không quá 300 ký tự"));
        assertTrue(violations.contains("level:Vui lòng chọn cấp độ bài tập"));
        assertTrue(violations.contains("guideSteps[0].<list element>:Bước hướng dẫn không được để trống"));
    }

    @Test
    void validatesWorkoutFieldsAndNestedItems() {
        CreateUpdateWorkoutRequestDTO request = new CreateUpdateWorkoutRequestDTO(
                "  ",
                "n".repeat(201),
                false,
                List.of(new WorkoutItemDTO(1L, 0, 101, 0, null, "REPS", 121))
        );

        Set<String> violations = validator.validate(request).stream()
                .map(violation -> violation.getPropertyPath() + ":" + violation.getMessage())
                .collect(Collectors.toSet());

        assertTrue(violations.contains("title:Tên giáo trình không được để trống"));
        assertTrue(violations.contains("description:Ghi chú không quá 200 ký tự"));
        assertTrue(violations.contains("items[0].sets:Số hiệp tối đa là 100"));
        assertTrue(violations.contains("items[0].reps:Số lần lặp tối thiểu là 1"));
        assertTrue(violations.contains("items[0].restSeconds:Thời gian nghỉ tối đa là 120 giây"));
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
                        && violation.getMessage().equals("Giáo trình phải chứa ít nhất 1 bài tập")));
    }
}
