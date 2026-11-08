package com.calishealth.dtos;

import java.math.BigDecimal;
import java.util.List;

/** DTO cho màn Real-time AI Pose Tracking (member). */
public class MemberFormRuleDtos {

    /**
     * Một rule form của bài tập: ngưỡng góc khớp, độ sâu ROM và câu nhắc cho voice coach.
     */
    public record FormRuleResponse(
            Long id,
            /** Khớp cần theo dõi: KNEE | HIP | ELBOW | SHOULDER | WRIST | ANKLE. */
            String joint,
            /** Góc tối đa (độ) để coi là đạt. */
            BigDecimal angleThreshold,
            /** Độ sâu ROM (độ) cần đạt để tính rep sạch. */
            BigDecimal romDepth,
            /** Câu nhắc cho voice coach. */
            String feedbackMessage
    ) {}

    /** Danh sách rule của một bài tập. */
    public record FormRulesResponse(
            String exerciseCode,
            List<FormRuleResponse> rules
    ) {}
}
