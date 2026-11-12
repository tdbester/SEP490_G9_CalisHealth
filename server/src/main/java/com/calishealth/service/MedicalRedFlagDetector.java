package com.calishealth.service;

import java.util.List;
import java.util.Locale;

/**
 * Phát hiện "red flag" y tế trong câu hỏi của member.
 *
 * <p>AI Support chỉ là huấn luyện viên về kỹ thuật tập — KHÔNG BAO GIỜ chẩn đoán
 * hay tư vấn y tế. Khi member mô tả triệu chứng có thể liên quan tới chấn thương
 * hoặc bệnh lý (đau ngực, chóng mặt, tê bại, khó thở...), hệ thống phải chặn lại
 * và hướng member tới chuyên gia y tế thay vì để AI trả lời.
 *
 * <p>Danh sách từ khoá bao gồm cả tiếng Việt lẫn tiếng Anh vì member dùng song
 * ngữ trong câu hỏi.
 */
public final class MedicalRedFlagDetector {

    /**
     * Nhóm triệu chứng nguy hiểm -> thông điệp hướng dẫn tương ứng.
     *
     * <p>Mỗi nhóm dùng {@code key: từ khoá} ngăn cách bằng dấu {@code |}.
     */
    private static final List<String[]> RED_FLAG_KEYWORDS = List.of(
            new String[]{
                    "cardiac",
                    "chest pain|chest tightness|chest pressure|heart racing|palpitation|"
                            + "đau ngực|tức ngực|đau tim|tim đập nhanh|đánh trống ngực",
                    "Các triệu chứng ở ngực hoặc tim mạch cần được bác sĩ đánh giá trực tiếp. "
                            + "Hãy dừng tập ngay và đi khám bác sĩ."
            },
            new String[]{
                    "neuro",
                    "dizzy|dizziness|fainting|fainted|blackout|numbness|numb|tingle|"
                            + "tingling|sharp pain shooting|pins and needles|"
                            + "chóng mặt|choáng mặt|ngất|ngất xỉu|tê|tê bại|tê rùi|đau nhói",
                    "Các triệu chứng như chóng mặt, ngất, tê bại hoặc đau nhói lan xuống "
                            + "cần được bác sĩ đánh giá trực tiếp. Hãy dừng tập ngay và đi khám bác sĩ."
            },
            new String[]{
                    "breathing",
                    "shortness of breath|cannot breathe|can't breathe|difficulty breathing|"
                            + "wheezing|blood in sputum|"
                            + "khó thở|không thở được|thở khó|thở rít|ho ra máu",
                    "Khó thở hoặc ho ra máu là dấu hiệu cần bác sĩ đánh giá ngay. "
                            + "Hãy dừng tập và đi khám bác sĩ."
            },
            new String[]{
                    "joint_injury",
                    "joint dislocation|dislocated|fracture|broken bone|tendon rupture|"
                            + "popped something|swelling|swollen|deformity|"
                            + "trật khớp|gãy xương|đứt gân|sưng to|sưng viêm|biến dạng",
                    "Sưng, trật khớp hoặc nghi gãy xương cần được bác sĩ đánh giá trực tiếp "
                            + "trước khi bạn tập lại. Hãy dừng bài này và đi khám bác sĩ."
            },
            new String[]{
                    "systemic",
                    "fever|weight loss|night sweats|persistent pain|sharp pain in|"
                            + "sốt|giảm cân|đổ mồ hôi ban đêm|đau kéo dài|đau âm ỉ",
                    "Đau kéo dài kèm sốt hoặc giảm cân cần được bác sĩ đánh giá trực tiếp. "
                            + "Hãy dừng tập và đi khám bác sĩ."
            });

    private MedicalRedFlagDetector() {
    }

    /**
     * Kiểm tra câu hỏi của member có chứa triệu chứng red flag không.
     *
     * @param question câu hỏi đã trim (null/rỗng -> false)
     * @return true nếu câu hỏi mô tả triệu chứng cần bác sĩ đánh giá
     */
    public static boolean containsRedFlag(String question) {
        return detect(question) != null;
    }

    /**
     * Tìm nhóm triệu chứng red flag đầu tiên khớp với câu hỏi.
     *
     * @param question câu hỏi của member
     * @return mảng {@code [mã nhóm, thông điệp hướng dẫn]} hoặc null nếu không có
     */
    public static String[] detect(String question) {
        if (question == null || question.isBlank()) {
            return null;
        }
        String lower = question.toLowerCase(Locale.ROOT);
        for (String[] group : RED_FLAG_KEYWORDS) {
            for (String keyword : group[1].split("\\|")) {
                String trimmed = keyword.trim();
                if (!trimmed.isEmpty() && lower.contains(trimmed)) {
                    return new String[]{group[0], group[2]};
                }
            }
        }
        return null;
    }
}
