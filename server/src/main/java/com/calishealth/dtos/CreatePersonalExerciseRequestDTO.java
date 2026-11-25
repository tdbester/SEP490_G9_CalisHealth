package com.calishealth.dtos;

import com.calishealth.models.Exercise;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreatePersonalExerciseRequestDTO(
        @NotBlank(message = "Exercise title is required")
        @Size(max = 50, message = "Exercise title must not exceed 50 characters")
        String title,
        @Size(max = 300, message = "Description must not exceed 300 characters")
        String description,
        @NotBlank(message = "Please select an exercise level")
        String level,
        @NotEmpty(message = "Add at least one instruction step")
        List<@NotBlank(message = "Instruction steps cannot be blank") @Size(max = 250) String> guideSteps,
        @NotBlank @Size(max = 120) String targetMuscle,
        @Min(1) @Max(20) Integer defaultSets,
        @Min(1) @Max(1000) Integer defaultReps,
        @Min(1) @Max(3600) Integer defaultDuration,
        Boolean shareWithCommunity,
        Boolean keepCurrentVideo,
        @Pattern(regexp = "reps_sets|duration", message = "Count type is invalid")
        String countType,
        @Min(1) @Max(20) Integer sets,
        @Min(1) @Max(1000) Integer reps,
        @Min(1) @Max(3600) Integer duration,
        /** Nhóm chuyển động: PUSH | PULL | LEGS | CORE — dùng để gợi ý ngưỡng chấm form. */
        @Pattern(regexp = "PUSH|PULL|LEGS|CORE", message = "Movement group is invalid")
        String movementGroup,
        /** Ngưỡng chấm form do member khai báo (rỗng = không chấm bằng AI). */
        List<FormRuleAdminDtos.FormRuleInput> formRules
) {

    /**
     * Constructor tương thích ngược — bài tạo trước khi có nhóm chuyển động
     * và ngưỡng chấm form thì không cần khai báo 2 trường mới.
     */
    public CreatePersonalExerciseRequestDTO(
            String title,
            String description,
            String level,
            List<String> guideSteps,
            String targetMuscle,
            Integer defaultSets,
            Integer defaultReps,
            Integer defaultDuration,
            Boolean shareWithCommunity,
            Boolean keepCurrentVideo,
            String countType,
            Integer sets,
            Integer reps,
            Integer duration
    ) {
        this(title, description, level, guideSteps, targetMuscle, defaultSets, defaultReps,
                defaultDuration, shareWithCommunity, keepCurrentVideo, countType, sets, reps,
                duration, null, null);
    }
}
