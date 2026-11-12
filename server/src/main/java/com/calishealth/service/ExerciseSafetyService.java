package com.calishealth.service;

import com.calishealth.dtos.ExercisePhysiologyDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Kiểm tra an toàn cho AI Support.
 *
 * <p>Hai lớp bảo vệ:
 * <ol>
 *   <li><b>Red flag y tế</b> — câu hỏi mô tả triệu chứng chấn thương/bệnh lý thì
 *       KHÔNG gọi AI, trả lời trực tiếp hướng member tới bác sĩ.</li>
 *   <li><b>Chống chỉ định</b> — câu hỏi có nhắc tới bệnh nền nằm trong danh sách
 *       chống chỉ định của bài tập thì gắn cảnh báo vào câu trả lời.</li>
 * </ol>
 *
 * <p>Bài tập do Member tải lên không có hồ sơ sinh lý (chỉ bài SYSTEM mới có),
 * nên lớp bảo vệ thứ hai chỉ áp dụng cho bài của hệ thống.
 */
@Service
@RequiredArgsConstructor
public class ExerciseSafetyService {

    /**
     * Từ khoá nhận diện bệnh nền (mã trong {@code contraindications}) -> từ khoá
     * tiếng Anh + tiếng Việt có thể xuất hiện trong câu hỏi của member.
     */
    private static final Map<String, List<String>> CONDITION_KEYWORDS = buildConditionKeywords();

    /**
     * Từ khoá nhận diện bệnh nền cho từng mã chống chỉ định.
     */
    private static Map<String, List<String>> buildConditionKeywords() {
        Map<String, List<String>> map = new LinkedHashMap<>();
        map.put("hypertension", List.of("hypertension", "high blood pressure", "cao huyết áp", "huyết áp cao"));
        map.put("glaucoma", List.of("glaucoma", "bị glaukom", "glaucom"));
        map.put("asthma", List.of("asthma", "hen", "hen suyễn", "suyễn"));
        map.put("pregnancy", List.of("pregnan", "mang thai", "có thai", "bầu bụ"));
        map.put("osteoporosis", List.of("osteoporosis", "loãng xương"));
        map.put("cardiac_condition", List.of("cardiac", "heart condition", "tim mạch", "bệnh tim", "suy tim"));
        map.put("wrist_pain", List.of("wrist pain", "đau cổ tay", "cổ tay đau", "viêm cổ tay"));
        map.put("elbow_pain", List.of("elbow pain", "đau khuỷu", "khuỷu tay đau", "viêm khuỷu"));
        map.put("shoulder_pain", List.of("shoulder pain", "đau vai", "vai đau", "viêm vai"));
        map.put("shoulder_impingement", List.of("impingement", "chèn vai", "va chạm vai"));
        map.put("knee_pain", List.of("knee pain", "đau gối", "gối đau", "viêm gối"));
        map.put("lower_back_pain", List.of("lower back pain", "back pain", "đau lưng", "lưng đau", "thoát đĩa"));
        return map;
    }

    /**
     * Kiểm tra red flag y tế trong câu hỏi.
     *
     * @param question câu hỏi của member
     * @return thông điệp hướng dẫn tới chuyên gia, hoặc null nếu không có red flag
     */
    public String redFlagMessage(String question) {
        String[] detected = MedicalRedFlagDetector.detect(question);
        return detected == null ? null : detected[1];
    }

    /**
     * Tìm các chống chỉ định của bài tập mà câu hỏi của member đã nhắc tới.
     *
     * @param profile  hồ sơ sinh lý của bài (null -> không có)
     * @param question câu hỏi của member
     * @return danh sách tên bệnh bị nhắc tới (có thể rỗng)
     */
    public List<String> matchedContraindications(ExercisePhysiologyDTO profile, String question) {
        if (profile == null || question == null || question.isBlank()) {
            return List.of();
        }
        List<String> contraindications = profile.contraindications();
        if (contraindications == null || contraindications.isEmpty()) {
            return List.of();
        }
        String lower = MedicalRedFlagDetector.normalize(question);
        List<String> matched = new ArrayList<>();
        for (String raw : contraindications) {
            if (raw == null || raw.isBlank()) {
                continue;
            }
            String code = raw.trim().toLowerCase(Locale.ROOT);
            List<String> keywords = CONDITION_KEYWORDS.get(code);
            List<String> candidates = keywords != null ? keywords : List.of(code.replace('_', ' '));
            for (String keyword : candidates) {
                String normalizedKeyword = MedicalRedFlagDetector.normalize(keyword);
                if (!normalizedKeyword.isBlank() && lower.contains(normalizedKeyword)) {
                    matched.add(displayName(raw.trim()));
                    break;
                }
            }
        }
        return matched;
    }

    /**
     * Tên hiển thị cho tình trạng sức khoẻ.
     *
     * <p>Mã cũ (VD: {@code hypertension}) được dịch sang tiếng Việt; tên do CM
     * tự nhập thì giữ nguyên.
     */
    private String displayName(String value) {
        return switch (value.toLowerCase(Locale.ROOT)) {
            case "hypertension" -> "cao huyết áp";
            case "glaucoma" -> "bệnh glaucom";
            case "asthma" -> "hen suyễn";
            case "pregnancy" -> "có thai";
            case "osteoporosis" -> "loãng xương";
            case "cardiac_condition" -> "bệnh tim mạch";
            case "wrist_pain" -> "đau cổ tay";
            case "elbow_pain" -> "đau khuỷu tay";
            case "shoulder_pain" -> "đau vai";
            case "shoulder_impingement" -> "chèn vai";
            case "knee_pain" -> "đau gối";
            case "lower_back_pain" -> "đau lưng";
            default -> value;
        };
    }
}
