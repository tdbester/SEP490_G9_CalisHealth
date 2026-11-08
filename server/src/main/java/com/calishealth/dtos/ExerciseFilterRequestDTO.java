package com.calishealth.dtos;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ExerciseFilterRequestDTO {
    public enum ExerciseType { HEALTH, SKILL }
    public enum ExerciseGoal { LOSE_WEIGHT, BUILD_MUSCLE, STAY_FIT }
    public enum TargetSkill { HANDSTAND, MUSCLE_UP, FRONT_LEVER, PLANCHE }

    private ExerciseType type = ExerciseType.HEALTH;
    private String search;

    /**
     * Tên level lấy động từ bảng fitness_levels (Content Manager tạo/đổi tên level trong
     * Level & Benchmark Criteria), nên không dùng enum cố định ở đây.
     */
    private String level;
    private ExerciseGoal goal;
    private TargetSkill targetSkill;
    private String targetMuscle;

    @Min(0)
    private int page = 0;

    @Min(1)
    @Max(100)
    private int size = 6;
}
