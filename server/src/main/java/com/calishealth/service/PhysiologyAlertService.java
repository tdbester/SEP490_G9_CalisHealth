package com.calishealth.service;

import com.calishealth.dtos.ExercisePhysiologyDTO;
import com.calishealth.dtos.PhysiologyAlertDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Đánh giá luật cảnh báo sinh lý (bảng {@code physiology_alert_rules}, migration V76).
 *
 * <p>Mỗi luật đã seed sẵn kèm trích dẫn bằng chứng. Luật được chọn theo hồ sơ
 * sinh lý của bài tập — ví dụ bài co tĩnh làm huyết áp tĩnh tăng sẽ khớp luật
 * {@code R1_STATIC_ACCUMULATION}.
 *
 * <p>Luật chỉ mang tính <b>cảnh báo thông tin</b>, không phải chẩn đoán. Nội dung
 * được đưa vào prompt của AI Support để huấn luyện viên giải thích đúng cơ chế
 * sinh lý, đồng thời hiển thị cho member ở popup hỏi đáp.
 */
@Service
@RequiredArgsConstructor
public class PhysiologyAlertService {

    /**
     * Số bài co tĩnh tối thiểu để kích hoạt luật "tích lũy bài giữ tĩnh".
     *
     * <p>Khớp với {@code condition_desc} của R1 trong migration V76.
     */
    private static final int STATIC_ACCUMULATION_THRESHOLD = 3;

    private final JdbcTemplate jdbcTemplate;

    /**
     * Danh sách luật cảnh báo đang bật.
     *
     * @return luật theo mức nghiêm trọng (DANGER trước, rồi WARN, rồi INFO)
     */
    @Transactional(readOnly = true)
    public List<PhysiologyAlertDTO> listActiveRules() {
        try {
            return jdbcTemplate.query(
                    "SELECT rule_code, title, severity, message_template"
                            + " FROM physiology_alert_rules WHERE active = TRUE"
                            + " ORDER BY FIELD(severity, 'DANGER', 'WARN', 'INFO'), rule_code",
                    (rs, rowNum) -> new PhysiologyAlertDTO(
                            rs.getString("rule_code"),
                            rs.getString("title"),
                            rs.getString("severity"),
                            rs.getString("message_template")));
        } catch (Exception ex) {
            // Bảng V76 chưa migrate ở môi trường cũ -> không có luật nào.
            return List.of();
        }
    }

    /**
     * Chọn các luật cảnh báo khớp với hồ sơ sinh lý của bài tập.
     *
     * @param profile hồ sơ sinh lý của bài (null -> không có luật nào khớp)
     * @return danh sách luật đã điền placeholder, theo mức nghiêm trọng giảm dần
     */
    @Transactional(readOnly = true)
    public List<PhysiologyAlertDTO> evaluate(ExercisePhysiologyDTO profile) {
        return evaluate(profile, 1);
    }

    /**
     * Chọn các luật cảnh báo khớp với hồ sơ sinh lý của bài tập, có tính ngữ
     * cảnh buổi tập.
     *
     * @param profile      hồ sơ sinh lý của bài (null -> không có luật nào khớp)
     * @param staticCount  số bài co tĩnh (ISOMETRIC/STATIC) trong buổi tập
     * @return danh sách luật đã điền placeholder, theo mức nghiêm trọng giảm dần
     */
    @Transactional(readOnly = true)
    public List<PhysiologyAlertDTO> evaluate(ExercisePhysiologyDTO profile, int staticCount) {
        if (profile == null) {
            return List.of();
        }
        int effectiveStaticCount = Math.max(staticCount, 1);
        List<PhysiologyAlertDTO> matched = new ArrayList<>();
        for (PhysiologyAlertDTO rule : listActiveRules()) {
            if (matches(rule.ruleCode(), profile, effectiveStaticCount)) {
                matched.add(fillPlaceholders(rule, profile, effectiveStaticCount));
            }
        }
        return matched;
    }

    /**
     * Luật có khớp với hồ sơ sinh lý không.
     *
     * <p>Điều kiện được diễn đạt lại từ {@code condition_desc} trong DB cho đúng
     * với dữ liệu đã seed.
     *
     * @param staticCount số bài co tĩnh trong buổi tập
     */
    private boolean matches(String ruleCode, ExercisePhysiologyDTO profile, int staticCount) {
        if (ruleCode == null) {
            return false;
        }
        return switch (ruleCode) {
            // Buổi tập có từ 3 bài co tĩnh trở lên, HOẶC có bài được đánh dấu
            // SPIKE_RISK. Một bài co tĩnh đơn lẻ KHÔNG đủ điều kiện "tích lũy"
            // nên không kích hoạt luật mức DANGER.
            case "R1_STATIC_ACCUMULATION" ->
                    "SPIKE_RISK".equalsIgnoreCase(profile.bloodPressureEffect())
                            || (isStatic(profile) && staticCount >= STATIC_ACCUMULATION_THRESHOLD);
            // Tải gân nặng -> gân cần >= 24 giờ để phục hồi.
            case "R2_TENDON_RECOVERY" -> profile.tendonLoad() != null && profile.tendonLoad() >= 4;
            // Bài dễ gây khó tiêu.
            case "R4_DIGESTIVE_DISCOMFORT" ->
                    "MODERATE".equalsIgnoreCase(profile.giRisk()) || "HIGH".equalsIgnoreCase(profile.giRisk());
            // Luật tải tập cần lịch sử 7/28 ngày -> không suy ra từ hồ sơ một bài.
            default -> false;
        };
    }

    /** Bài co tĩnh / giữ tĩnh. */
    private boolean isStatic(ExercisePhysiologyDTO profile) {
        String type = profile.contractionType();
        return "ISOMETRIC".equalsIgnoreCase(type) || "STATIC".equalsIgnoreCase(type);
    }

    /**
     * Đếm số bài co tĩnh trong buổi tập gần nhất của member.
     *
     * <p>Dùng cho luật {@code R1_STATIC_ACCUMULATION}: luật này mô tả hiện tượng
     * <b>tích lũy</b> nhiều bài co tĩnh trong một buổi, nên phải biết số bài thực
     * tế mới điền được placeholder {@code {static_count}} và quyết định mức cảnh
     * báo.
     *
     * @param userId id member
     * @return số bài co tĩnh trong buổi tập gần nhất (0 nếu chưa có dữ liệu)
     */
    @Transactional(readOnly = true)
    public int countStaticExercisesInLatestSession(Long userId) {
        if (userId == null) {
            return 0;
        }
        try {
            Integer count = jdbcTemplate.queryForObject(
                    """
                    SELECT COUNT(DISTINCT ser.exercise_id)
                    FROM workout_sessions ws
                    JOIN member_profiles mp ON mp.id = ws.member_profile_id
                    JOIN session_exercise_results ser ON ser.workout_session_id = ws.id
                    JOIN exercise_physiology_profiles p ON p.exercise_id = ser.exercise_id
                    WHERE mp.user_id = ?
                      AND ws.session_date = (
                          SELECT MAX(w2.session_date)
                          FROM workout_sessions w2
                          JOIN member_profiles mp2 ON mp2.id = w2.member_profile_id
                          WHERE mp2.user_id = ?
                      )
                      AND UPPER(p.contraction_type) IN ('ISOMETRIC', 'STATIC')
                    """,
                    Integer.class,
                    userId,
                    userId);
            return count == null ? 0 : count;
        } catch (Exception ex) {
            // Bảng chưa có dữ liệu -> coi như buổi tập chưa có bài co tĩnh nào.
            return 0;
        }
    }

    /**
     * Điền placeholder trong thông điệp luật (VD: {@code {joint}}).
     *
     * @param rule        luật gốc
     * @param profile     hồ sơ sinh lý của bài
     * @param staticCount số bài co tĩnh trong buổi tập
     */
    private PhysiologyAlertDTO fillPlaceholders(
            PhysiologyAlertDTO rule,
            ExercisePhysiologyDTO profile,
            int staticCount) {
        String message = rule.messageTemplate() == null ? "" : rule.messageTemplate();
        message = message.replace("{joint}", jointLabel(profile.primaryJoint()));
        message = message.replace("{static_count}", String.valueOf(staticCount));
        message = message.replace("{ratio_pct}", "—");
        return new PhysiologyAlertDTO(rule.ruleCode(), rule.title(), rule.severity(), message);
    }

    /** Tên khớp hiển thị cho member. */
    private String jointLabel(String joint) {
        if (joint == null || joint.isBlank()) {
            return "khớp";
        }
        return switch (joint.trim().toUpperCase(Locale.ROOT)) {
            case "WRIST" -> "cổ tay";
            case "ELBOW" -> "khuỷu tay";
            case "SHOULDER" -> "vai";
            case "SPINE" -> "cột sống";
            case "HIP" -> "hông";
            case "KNEE" -> "gối";
            case "ANKLE" -> "cổ chân";
            default -> joint.toLowerCase(Locale.ROOT);
        };
    }
}
