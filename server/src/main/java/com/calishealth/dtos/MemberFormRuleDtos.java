package com.calishealth.dtos;

import java.math.BigDecimal;
import java.util.List;

/** DTO cho màn Real-time AI Pose Tracking (member). */
public class MemberFormRuleDtos {

    /**
     * Một rule form của bài tập: ngưỡng góc khớp, độ sâu ROM và câu nhắc cho voice coach.
     *
     * <p>Rule đọc được theo 2 kiểu:
     * <ul>
     *   <li><b>2 ngưỡng</b>: {@code angleThreshold} (trên cùng) + {@code romDepth} (đáy)
     *       — dùng cho bài đếm rep (push-up, squat).</li>
     *   <li><b>Dải</b>: {@code minAngle}..{@code maxAngle} — dùng cho bài giữ (plank).</li>
     * </ul>
     * Client tự fallback về {@code angleThreshold}/{@code romDepth} khi
     * {@code minAngle}/{@code maxAngle} rỗng nên rule cũ vẫn chạy đúng.
     */
    public record FormRuleResponse(
            Long id,
            /** Khớp cần theo dõi: KNEE | HIP | ELBOW | SHOULDER | WRIST | ANKLE. */
            String joint,
            /** Góc tối đa (độ) ở vị trí trên cùng — vượt ngưỡng này là đã duỗi hết. */
            BigDecimal angleThreshold,
            /** Góc (độ) ở vị trí đáy — xuống tới ngưỡng này mới tính là đủ sâu. */
            BigDecimal romDepth,
            /** Biên dưới của dải góc "đạt" (bài giữ — plank). */
            BigDecimal minAngle,
            /** Biên trên của dải góc "đạt" (bài giữ — plank). */
            BigDecimal maxAngle,
            /** Trọng số thành phần này trong tổng điểm rep (0..1). */
            BigDecimal weight,
            /** Dung sai cho phép (độ) — bán kính vùng dung quanh ngưỡng. */
            BigDecimal tolerance,
            /** Nguồn gốc rule: DEFAULT | CONTENT_MANAGER | MEMBER. */
            String source
    ) {}

    /** Danh sách rule của một bài tập. */
    public record FormRulesResponse(
            String exerciseCode,
            List<FormRuleResponse> rules
    ) {}
}
