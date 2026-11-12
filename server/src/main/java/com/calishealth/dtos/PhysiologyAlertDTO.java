package com.calishealth.dtos;

/**
 * Một luật cảnh báo sinh lý (bảng {@code physiology_alert_rules}, migration V76).
 *
 * <p>Luật được seed sẵn kèm trích dẫn bằng chứng. Mỗi luật mô tả một tình huống
 * mà member có thể gặp khi tập bài cụ thể (ví dụ: tích lũy bài giữ tĩnh trong một
 * buổi làm huyết áp tĩnh tăng rõ rệt).
 *
 * @param ruleCode        mã luật (VD: {@code R1_STATIC_ACCUMULATION})
 * @param title           tiêu đề luật
 * @param severity        mức cảnh báo (INFO | WARN | DANGER)
 * @param messageTemplate thông điệp hiển thị cho member
 */
public record PhysiologyAlertDTO(
        String ruleCode,
        String title,
        String severity,
        String messageTemplate
) {
}
