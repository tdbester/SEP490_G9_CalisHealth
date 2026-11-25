package com.calishealth.dtos;

import java.math.BigDecimal;
import java.util.List;

/** DTO cho phần cấu hình chấm form (AI Pose Tracking) do Content Manager khai báo. */
public class FormRuleAdminDtos {

    /** Một ngưỡng chấm form cho một khớp. */
    public record FormRuleInput(
            /** Khớp cần theo dõi: KNEE | HIP | ELBOW | SHOULDER | WRIST | ANKLE. */
            String joint,
            /** Góc (độ) ở vị trí trên cùng. */
            BigDecimal angleThreshold,
            /** Góc (độ) ở vị trí đáy. */
            BigDecimal romDepth,
            /** Biên dưới của dải góc "đạt" (bài giữ — plank). */
            BigDecimal minAngle,
            /** Biên trên của dải góc "đạt" (bài giữ — plank). */
            BigDecimal maxAngle,
            /** Trọng số thành phần này trong tổng điểm rep (0..1). */
            BigDecimal weight,
            /** Dung sai cho phép (độ). */
            BigDecimal tolerance
    ) {}

    /** Danh sách ngưỡng khai báo cho một bài tập. */
    public record FormRulesRequest(
            List<FormRuleInput> rules
    ) {}

    /** Một ngưỡng đã lưu, trả về cho màn quản trị. */
    public record FormRuleView(
            Long id,
            String joint,
            BigDecimal angleThreshold,
            BigDecimal romDepth,
            BigDecimal minAngle,
            BigDecimal maxAngle,
            BigDecimal weight,
            BigDecimal tolerance,
            String source
    ) {}

    /** Danh sách ngưỡng của một bài tập. */
    public record FormRulesView(
            String exerciseCode,
            String exerciseName,
            List<FormRuleView> rules
    ) {}

    /** Bộ ngưỡng mẫu để member chọn khi tạo bài tập. */
    public record FormRulePresetView(
            Long id,
            String code,
            String name,
            String category,
            String movementGroup,
            String description
    ) {}

    /** Danh sách bộ ngưỡng mẫu. */
    public record FormRulePresetsView(
            List<FormRulePresetView> presets
    ) {}
}
