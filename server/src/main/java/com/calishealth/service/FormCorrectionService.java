package com.calishealth.service;

import com.calishealth.dtos.FormCorrectionDtos.CorrectionRule;
import com.calishealth.dtos.FormCorrectionDtos.CorrectionTip;
import com.calishealth.dtos.FormCorrectionDtos.FormCorrectionPlanResponse;
import com.calishealth.models.Exercise;
import com.calishealth.models.FormRule;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FormRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Màn "Form correction" (Figma 549:992).
 *
 * Trả về kế hoạch sửa form cho một bài tập:
 *  - Các ngưỡng chấm form đang áp dụng (lấy từ {@code form_rules}) để member
 *    biết AI đang so với mốc nào.
 *  - Danh sách bước sửa ("How to fix") — ưu tiên lấy từ câu nhắc do Content
 *    Manager khai báo, bổ sung các mẹo chung theo khớp.
 */
@Service
@RequiredArgsConstructor
public class FormCorrectionService {

    /** Số bước sửa tối đa (Figma hiển thị 3 bước). */
    private static final int MAX_TIPS = 3;

    /**
     * Thư viện mẹo sửa theo khớp.
     *
     * Kiến thức chung về calisthenics, không phụ thuộc bài cụ thể — dùng để bổ sung
     * khi Content Manager chưa viết câu nhắc cho khớp đó.
     * Mỗi mục gồm: { hành động, giải thích thêm }.
     */
    private static final Map<String, List<String[]>> JOINT_TIPS = Map.of(
            "KNEE", List.of(
                    new String[]{"Push knees outward along your toes",
                            "Track each knee over the middle of your foot during the whole rep."},
                    new String[]{"Widen your stance a little and push your feet apart",
                            "A slightly wider stance gives your knees room to travel outward."}),
            "HIP", List.of(
                    new String[]{"Squeeze glutes as you stand",
                            "Drive through your heels so your hips do not shoot up too early."},
                    new String[]{"Sit between your hips, not on them",
                            "Imagine sitting back into a bench behind you to hit the depth target."}),
            "ELBOW", List.of(
                    new String[]{"Tuck your elbows closer to your ribs",
                            "Keep the upper arm almost parallel to your torso."},
                    new String[]{"Point your elbows down and back",
                            "That keeps the shoulders away from your ears at the hardest position."}),
            "SHOULDER", List.of(
                    new String[]{"Keep your shoulders down and away from your ears",
                            "A rounded back shifts the load onto the wrong joints."},
                    new String[]{"Brace your core before every rep",
                            "A stable trunk keeps the shoulders stacked over the hips."}),
            "WRIST", List.of(
                    new String[]{"Stack your wrists directly under your shoulders",
                            "Shift your weight slightly forward instead of leaning in."},
                    new String[]{"Warm up your wrists before the set",
                            "Slow wrist circles keep the joint mobile under load."}),
            "ANKLE", List.of(
                    new String[]{"Keep your weight on the balls of your feet",
                            "Let your heels float instead of lifting the whole foot."},
                    new String[]{"Keep your heels closer to the floor",
                            "Raised heels tilt the knees forward and break the alignment."}));

    /** Mẹo về nhịp độ — dùng để lấp đầy danh sách khi thiếu mẹo theo khớp. */
    private static final List<String[]> TEMPO_TIPS = List.of(
            new String[]{"Lower slowly for 3 seconds, thighs parallel",
                    "A slow eccentric keeps the joints inside the target range."},
            new String[]{"Pause for a second at the hardest position",
                    "The pause lets the AI tracker confirm your depth before you push up."});

    /**
     * Mẹo riêng cho bài giữ (HOLD — plank, handstand...).
     *
     * Bài này đo theo thời gian giữ đúng tư thế nên mẹo "hạ xuống chậm" của bài
     * REPS không áp dụng được.
     */
    private static final List<String[]> HOLD_TIPS = List.of(
            new String[]{"Keep your body in one straight line",
                    "Your head, spine and heels should form a single line from the side."},
            new String[]{"Squeeze your glutes to stop your hips from sagging",
                    "Tighten the glutes so the pelvis stays level with the shoulders."},
            new String[]{"Push the floor away with your hands",
                    "Spread the fingers and press through the palms to keep the upper back stable."});

    private final ExerciseRepository exercises;
    private final FormRuleRepository formRules;

    /**
     * Lấy kế hoạch sửa form của một bài tập.
     *
     * @param exerciseCode mã bài tập
     * @param failedJoints các khớp tracker vừa phát hiện lỗi (vd: KNEE, HIP) —
     *                    dùng để ưu tiên bước sửa đúng với lỗi vừa gặp.
     */
    @Transactional(readOnly = true)
    public FormCorrectionPlanResponse plan(String exerciseCode, List<String> failedJoints) {
        Exercise exercise = exercises.findByCode(exerciseCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Exercise not found"));
        List<FormRule> rules = formRules.findByExerciseCode(exerciseCode);

        List<CorrectionRule> ruleResponses = rules.stream()
                .map(rule -> new CorrectionRule(
                        rule.getJoint(),
                        rule.getAngleThreshold(),
                        rule.getRomDepth(),
                        rule.getFeedbackMessage()))
                .toList();

        return new FormCorrectionPlanResponse(
                exercise.getCode(),
                exercise.getName(),
                ruleResponses,
                buildTips(rules, failedJoints, isHoldExercise(exercise)));
    }

    /**
     * Bài tập giữ theo thời gian (plank, handstand...) hay bài đếm lần (squat).
     *
     * @param exercise bài tập
     * @return true nếu là bài HOLD
     */
    private boolean isHoldExercise(Exercise exercise) {
        String category = exercise.getCategory();
        return category != null && "HOLD".equalsIgnoreCase(category.trim());
    }

    /**
     * Dựng danh sách bước sửa.
     *
     * Thứ tự ưu tiên:
     *  1. Câu nhắc của Content Manager cho khớp vừa bị lỗi.
     *  2. Mẹo chung theo khớp vừa bị lỗi.
     *  3. Mẹo chung theo các khớp khác đang được theo dõi.
     *  4. Mẹo theo nhóm bài (giữ hay đếm lần) để lấp đầy danh sách.
     *
     * @param rules        các rule form của bài
     * @param failedJoints các khớp vừa bị lỗi
     * @param isHold       bài giữ theo thời gian hay không
     */
    private List<CorrectionTip> buildTips(List<FormRule> rules, List<String> failedJoints, boolean isHold) {
        List<CorrectionTip> tips = new ArrayList<>();
        List<String> titles = new ArrayList<>();

        // 1. Câu nhắc của Content Manager cho khớp vừa bị lỗi.
        for (String joint : failedJoints) {
            if (tips.size() >= MAX_TIPS) break;
            FormRule rule = findRule(rules, joint);
            if (rule == null) continue;
            String feedback = rule.getFeedbackMessage();
            if (feedback == null || feedback.isBlank()) continue;
            if (isDuplicate(titles, feedback)) continue;
            tips.add(new CorrectionTip(rule.getJoint(), feedback, ""));
            titles.add(feedback);
        }

        // 2. Mẹo chung theo khớp vừa bị lỗi (chỉ với bài đếm lần — mẹo squat
        //    không áp dụng cho bài giữ tư thế).
        if (!isHold) {
            for (String joint : failedJoints) {
                if (tips.size() >= MAX_TIPS) break;
                addJointTips(tips, titles, joint);
            }
        }

        // 3. Mẹo chung theo các khớp khác đang được theo dõi.
        if (!isHold) {
            for (FormRule rule : rules) {
                if (tips.size() >= MAX_TIPS) break;
                addJointTips(tips, titles, rule.getJoint());
            }
        }

        // 4. Mẹo theo nhóm bài để lấp đầy danh sách.
        for (String[] item : (isHold ? HOLD_TIPS : TEMPO_TIPS)) {
            if (tips.size() >= MAX_TIPS) break;
            if (isDuplicate(titles, item[0])) continue;
            tips.add(new CorrectionTip("", item[0], item[1]));
            titles.add(item[0]);
        }

        return tips.stream().limit(MAX_TIPS).toList();
    }

    /**
     * Thêm các mẹo chung của một khớp (nếu chưa có mẹo trùng nội dung).
     *
     * @param tips      danh sách bước sửa đang dựng
     * @param titles    các tiêu đề đã dùng (để tránh trùng)
     * @param joint     khớp cần lấy mẹo
     */
    private void addJointTips(List<CorrectionTip> tips, List<String> titles, String joint) {
        if (joint == null) return;
        String key = joint.trim().toUpperCase(Locale.ROOT);
        for (String[] item : JOINT_TIPS.getOrDefault(key, List.of())) {
            if (tips.size() >= MAX_TIPS) return;
            if (isDuplicate(titles, item[0])) continue;
            tips.add(new CorrectionTip(key, item[0], item[1]));
            titles.add(item[0]);
        }
    }

    /**
     * Tìm rule của một khớp trong danh sách rule của bài.
     *
     * @param rules danh sách rule
     * @param joint khớp cần tìm
     * @return rule tương ứng hoặc null
     */
    private FormRule findRule(List<FormRule> rules, String joint) {
        if (joint == null) return null;
        String target = joint.trim().toUpperCase(Locale.ROOT);
        return rules.stream()
                .filter(rule -> rule.getJoint() != null)
                .filter(rule -> rule.getJoint().trim().toUpperCase(Locale.ROOT).equals(target))
                .findFirst()
                .orElse(null);
    }

    /**
     * Kiểm tra 2 tiêu đề có mang nội dung giống nhau không.
     *
     * So trùng theo tỉ lệ từ khóa chung — tránh trường hợp câu nhắc của Content
     * Manager và mẹo chung nói cùng một ý.
     *
     * @param titles các tiêu đề đã dùng
     * @param candidate tiêu đề mới
     * @return true nếu trùng ý
     */
    private boolean isDuplicate(List<String> titles, String candidate) {
        for (String title : titles) {
            if (similar(title, candidate)) return true;
        }
        return false;
    }

    /**
     * Hai câu có trùng ý khi chúng dùng chung phần lớn từ khóa.
     *
     * @param left  câu 1
     * @param right câu 2
     * @return true nếu trùng ý
     */
    private boolean similar(String left, String right) {
        Set<String> a = keywords(left);
        Set<String> b = keywords(right);
        if (a.isEmpty() || b.isEmpty()) return false;
        Set<String> common = new LinkedHashSet<>(a);
        common.retainAll(b);
        int smaller = Math.min(a.size(), b.size());
        return smaller > 0 && (double) common.size() / smaller >= 0.6;
    }

    /**
     * Tách câu thành từ khóa (bỏ từ ngắn và từ dừng).
     *
     * @param text câu cần tách
     * @return tập từ khóa
     */
    private Set<String> keywords(String text) {
        Set<String> words = new LinkedHashSet<>();
        if (text == null) return words;
        for (String word : text.toLowerCase(Locale.ROOT).split("[^a-z0-9]+")) {
            if (word.length() >= 4 && !STOP_WORDS.contains(word)) {
                words.add(word);
            }
        }
        return words;
    }

    /** Từ dừng tiếng Anh thường gặp trong câu nhắc form. */
    private static final Set<String> STOP_WORDS = Set.of(
            "your", "with", "that", "this", "from", "they", "them", "then",
            "when", "while", "before", "after", "each", "every", "into",
            "onto", "over", "under", "keep", "make", "sure", "you", "are",
            "the", "and", "for", "not", "out", "off", "its", "their", "also");
}
