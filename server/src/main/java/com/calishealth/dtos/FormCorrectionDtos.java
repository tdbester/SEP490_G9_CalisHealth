package com.calishealth.dtos;

import java.math.BigDecimal;
import java.util.List;

/** DTO cho màn "Form correction" — member xem chi tiết lỗi form và cách sửa. */
public class FormCorrectionDtos {

    /**
     * Một rule form của bài tập (lấy từ bảng {@code form_rules}).
     *
     * @param joint           khớp cần theo dõi (KNEE | HIP | ELBOW | ...)
     * @param targetAngle     góc tối đa (độ) ở vị trí trên cùng
     * @param romDepth        góc (độ) ở vị trí đáy
     * @param minAngle        biên dưới của dải góc "đạt" (bài giữ — plank)
     * @param maxAngle        biên trên của dải góc "đạt" (bài giữ — plank)
     * @param weight          trọng số thành phần này trong tổng điểm rep
     * @param tolerance       dung sai cho phép (độ)
     */
    public record CorrectionRule(
            String joint,
            BigDecimal targetAngle,
            BigDecimal romDepth,
            BigDecimal minAngle,
            BigDecimal maxAngle,
            BigDecimal weight,
            BigDecimal tolerance
    ) {}

    /**
     * Một bước sửa form.
     *
     * @param joint  khớp mà bước sửa này tác động tới (KNEE | HIP | ELBOW | ...)
     * @param title  hành động ngắn (vd: "Push knees outward along your toes")
     * @param detail giải thích thêm cho bước đó
     */
    public record CorrectionTip(
            String joint,
            String title,
            String detail
    ) {}

    /**
     * Kế hoạch sửa form cho một bài tập.
     *
     * @param exerciseCode mã bài tập
     * @param exerciseName tên bài tập
     * @param rules        các ngưỡng chấm form đang áp dụng cho bài này
     * @param howToFix     các bước sửa form (tối đa 3 bước như Figma)
     */
    public record FormCorrectionPlanResponse(
            String exerciseCode,
            String exerciseName,
            List<CorrectionRule> rules,
            List<CorrectionTip> howToFix
    ) {}
}
