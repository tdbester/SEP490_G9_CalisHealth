package com.calishealth.dtos;

import java.math.BigDecimal;
import java.util.List;

/** DTO cho gợi ý ngưỡng chấm form khi member tạo bài tập custom. */
public class FormRuleSuggestionDtos {

    /** Một ngưỡng được gợi ý, kèm số bài đã dùng ngưỡng tương tự. */
    public record SuggestedRule(
            String joint,
            BigDecimal angleThreshold,
            BigDecimal romDepth,
            BigDecimal minAngle,
            BigDecimal maxAngle,
            BigDecimal weight,
            BigDecimal tolerance,
            /** Số bài trong cùng nhóm đang dùng ngưỡng tương tự. */
            int similarCount
    ) {}

    /**
     * Kết quả gợi ý cho 1 nhóm chuyển động.
     *
     * @param movementGroup nhóm chuyển động vừa suy ra (PUSH | PULL | LEGS | CORE)
     * @param category loại bài (REPS | HOLD)
     * @param suggestions các ngưỡng được gợi ý, đã sắp xếp theo số bài tương tự
     * @param sampleSize số bài đã dùng để tính trung bình
     */
    public record SuggestionResponse(
            String movementGroup,
            String category,
            List<SuggestedRule> suggestions,
            int sampleSize
    ) {}
}
