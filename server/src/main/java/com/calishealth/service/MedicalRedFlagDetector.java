package com.calishealth.service;

import java.text.Normalizer;
import java.util.List;
import java.util.regex.Pattern;

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
 *
 * <p><b>Cách so khớp:</b> cả câu hỏi và từ khoá đều được chuẩn hoá về dạng
 * không dấu, chỉ chữ cái/số và tách thành từ. Nhờ vậy:
 * <ul>
 *   <li>Câu gõ thiếu dấu ("toi bi chong mat") vẫn bị bắt.</li>
 *   <li>Từ khoá ngắn không khớp nhầm với từ khác ("tê" KHÔNG khớp "tên").</li>
 * </ul>
 */
public final class MedicalRedFlagDetector {

    /**
     * Nhóm triệu chứng nguy hiểm -> thông điệp hướng dẫn tương ứng.
     *
     * <p>Mỗi nhóm dùng {@code key: từ khoá} ngăn cách bằng dấu {@code |}.
     *
     * <p>Từ khoá viết dạng nhiều từ khi cần (VD {@code "tê tay"}, {@code "tê chân"})
     * để tránh khớp nhầm với từ chứa chuỗi đó (VD {@code "tê"} khớp "tên").
     */
    private static final List<String[]> RED_FLAG_KEYWORDS = List.of(
            new String[]{
                    "cardiac",
                    "chest pain|chest hurts|chest tightness|chest pressure|heart racing|"
                            + "palpitation|heart attack|pain in my chest|"
                            + "đau ngực|tức ngực|đau tim|tim đập nhanh|đánh trống ngực",
                    "Các triệu chứng ở ngực hoặc tim mạch cần được bác sĩ đánh giá trực tiếp. "
                            + "Hãy dừng tập ngay và đi khám bác sĩ."
            },
            new String[]{
                    "neuro",
                    "dizzy|dizziness|fainting|fainted|blackout|numbness|numb|tingle|"
                            + "tingling|sharp pain shooting|pins and needles|"
                            + "chóng mặt|choáng mặt|ngất|ngất xỉu|"
                            + "tê|tê tay|tê chân|tê bại|tê rùi|tê dại|đau nhói",
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

    /** Một nhóm triệu chứng: mã nhóm, thông điệp hướng dẫn và các mẫu từ khoá đã chuẩn hoá. */
    private record RedFlagGroup(String code, String message, Pattern[] patterns) {
    }

    /** Từ khoá đã chuẩn hoá + biểu thức chính quy (ranh giới từ). */
    private static final List<RedFlagGroup> NORMALIZED_KEYWORDS = RED_FLAG_KEYWORDS.stream()
            .map(group -> new RedFlagGroup(
                    group[0],
                    group[2],
                    buildPatterns(group[1])))
            .toList();

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
        String normalizedQuestion = normalize(question);
        if (normalizedQuestion.isBlank()) {
            return null;
        }
        for (RedFlagGroup group : NORMALIZED_KEYWORDS) {
            for (Pattern pattern : group.patterns()) {
                if (pattern.matcher(normalizedQuestion).find()) {
                    return new String[]{group.code(), group.message()};
                }
            }
        }
        return null;
    }

    /**
     * Chuẩn hoá chuỗi: bỏ dấu tiếng Việt, đổi chữ hoa thành thường, chỉ giữ chữ
     * cái/số và gom khoảng trắng thành một dấu cách duy nhất.
     *
     * <p>Lưu ý: chữ {@code đ} (U+0111) KHÔNG có dạng phân rã chuẩn (NFD), nên phải
     * chuyển thủ công về {@code d} trước. Nếu không, {@code "đau ngực"} sẽ thành
     * {@code "au nguc"} và không bao giờ khớp với câu hỏi gõ không dấu.
     */
    static String normalize(String value) {
        if (value == null) {
            return "";
        }
        String withPlainD = value.replace('đ', 'd').replace('Đ', 'D');
        String decomposed = Normalizer.normalize(withPlainD, Normalizer.Form.NFD);
        String withoutDiacritics = decomposed.replaceAll("\\p{M}", "");
        return withoutDiacritics.toLowerCase(java.util.Locale.ROOT)
                .replaceAll("[^a-z0-9\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    /**
     * Dựng biểu thức chính quy cho từng từ khoá trong nhóm.
     *
     * <p>Dùng ranh giới từ ({@code \b}) nên "tê" chỉ khớp đúng từ "tê", không
     * khớp với "tên"/"tế".
     */
    private static Pattern[] buildPatterns(String keywordList) {
        return java.util.Arrays.stream(keywordList.split("\\|"))
                .map(String::trim)
                .filter(keyword -> !keyword.isEmpty())
                .map(keyword -> {
                    String normalized = normalize(keyword);
                    if (normalized.isEmpty()) {
                        return null;
                    }
                    return Pattern.compile("(?<![a-z0-9])" + Pattern.quote(normalized) + "(?![a-z0-9])");
                })
                .filter(java.util.Objects::nonNull)
                .toArray(Pattern[]::new);
    }
}
