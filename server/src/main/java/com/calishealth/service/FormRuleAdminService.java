package com.calishealth.service;

import com.calishealth.dtos.FormRuleAdminDtos.FormRuleInput;
import com.calishealth.dtos.FormRuleAdminDtos.FormRulesRequest;
import com.calishealth.dtos.FormRuleAdminDtos.FormRulesView;
import com.calishealth.dtos.FormRuleAdminDtos.FormRuleView;
import com.calishealth.models.Exercise;
import com.calishealth.models.FormRule;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FormRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Quản lý cấu hình chấm form (AI Pose Tracking) cho bài tập.
 *
 * <p>Content Manager khai báo ngưỡng cho từng khớp; member cũng có thể khai báo
 * khi tạo bài custom. Mỗi lần khai báo sẽ thay thế toàn bộ rule cũ của bài.
 */
@Service
@RequiredArgsConstructor
public class FormRuleAdminService {

    /** Nguồn gốc rule do Content Manager khai báo. */
    public static final String SOURCE_CONTENT_MANAGER = "CONTENT_MANAGER";

    /** Nguồn gốc rule do member khai báo. */
    public static final String SOURCE_MEMBER = "MEMBER";

    /** Khớp được phép theo dõi. */
    private static final List<String> ALLOWED_JOINTS =
            List.of("KNEE", "HIP", "ELBOW", "SHOULDER", "WRIST", "ANKLE");

    /** Giá trị mặc định khi không khai báo trọng số. */
    private static final BigDecimal DEFAULT_WEIGHT = new BigDecimal("0.30");

    /** Giá trị mặc định khi không khai báo dung sai (độ). */
    private static final BigDecimal DEFAULT_TOLERANCE = new BigDecimal("15");

    private final ExerciseRepository exercises;
    private final FormRuleRepository formRules;

    /** Đọc toàn bộ rule của một bài tập. */
    @Transactional(readOnly = true)
    public FormRulesView getFormRules(String exerciseCode) {
        Exercise exercise = requireExercise(exerciseCode);
        List<FormRuleView> rules = formRules.findByExerciseCode(exerciseCode).stream()
                .map(this::toView)
                .toList();
        return new FormRulesView(exercise.getCode(), exercise.getName(), rules);
    }

    /** Thay toàn bộ rule của một bài tập bằng bộ rule mới. */
    @Transactional
    public FormRulesView replaceFormRules(String exerciseCode, FormRulesRequest request, String source) {
        Exercise exercise = requireExercise(exerciseCode);
        List<FormRuleInput> inputs = request == null || request.rules() == null
                ? List.of()
                : request.rules();
        validateRules(inputs);

        formRules.deleteByExerciseId(exercise.getId());
        List<FormRule> saved = new ArrayList<>();
        for (FormRuleInput input : inputs) {
            FormRule rule = new FormRule();
            rule.setJoint(input.joint().trim().toUpperCase(Locale.ROOT));
            rule.setAngleThreshold(input.angleThreshold());
            rule.setRomDepth(input.romDepth());
            rule.setMinAngle(input.minAngle());
            rule.setMaxAngle(input.maxAngle());
            rule.setWeight(input.weight() == null ? DEFAULT_WEIGHT : input.weight());
            rule.setTolerance(input.tolerance() == null ? DEFAULT_TOLERANCE : input.tolerance());
            rule.setSource(source);
            rule.setExercise(exercise);
            saved.add(formRules.save(rule));
        }
        return new FormRulesView(exercise.getCode(), exercise.getName(),
                saved.stream().map(this::toView).toList());
    }

    private FormRuleView toView(FormRule rule) {
        return new FormRuleView(
                rule.getId(),
                rule.getJoint(),
                rule.getAngleThreshold(),
                rule.getRomDepth(),
                rule.getMinAngle(),
                rule.getMaxAngle(),
                rule.getWeight(),
                rule.getTolerance(),
                rule.getSource());
    }

    private Exercise requireExercise(String exerciseCode) {
        if (exerciseCode == null || exerciseCode.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Exercise code is required");
        }
        return exercises.findByCode(exerciseCode)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Exercise not found"));
    }

    private void validateRules(List<FormRuleInput> inputs) {
        if (inputs.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Add at least one form rule");
        }
        if (inputs.size() > 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Too many form rules");
        }
        for (FormRuleInput input : inputs) {
            String joint = input.joint() == null ? "" : input.joint().trim().toUpperCase(Locale.ROOT);
            if (!ALLOWED_JOINTS.contains(joint)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Unknown joint: " + input.joint());
            }
            validateRange(input.angleThreshold(), "angleThreshold");
            validateRange(input.romDepth(), "romDepth");
            validateRange(input.minAngle(), "minAngle");
            validateRange(input.maxAngle(), "maxAngle");
            validateRange(input.tolerance(), "tolerance");
            if (input.minAngle() != null && input.maxAngle() != null
                    && input.minAngle().compareTo(input.maxAngle()) > 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "minAngle must not be greater than maxAngle");
            }
            if (input.weight() != null
                    && (input.weight().compareTo(BigDecimal.ZERO) < 0
                    || input.weight().compareTo(BigDecimal.ONE) > 0)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Weight must be between 0 and 1");
            }
            boolean hasTwoThresholds = input.angleThreshold() != null || input.romDepth() != null;
            boolean hasRange = input.minAngle() != null || input.maxAngle() != null;
            if (!hasTwoThresholds && !hasRange) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Each rule needs either top/bottom angles or a min/max range");
            }
        }
    }

    private void validateRange(BigDecimal value, String field) {
        if (value == null) return;
        if (value.compareTo(BigDecimal.ZERO) < 0 || value.compareTo(new BigDecimal("180")) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    field + " must be between 0 and 180");
        }
    }
}
