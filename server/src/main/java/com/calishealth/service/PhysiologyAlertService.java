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
        if (profile == null) {
            return List.of();
        }
        List<PhysiologyAlertDTO> matched = new ArrayList<>();
        for (PhysiologyAlertDTO rule : listActiveRules()) {
            if (matches(rule.ruleCode(), profile)) {
                matched.add(fillPlaceholders(rule, profile));
            }
        }
        return matched;
    }

    /**
     * Luật có khớp với hồ sơ sinh lý không.
     *
     * <p>Điều kiện được diễn đạt lại từ {@code condition_desc} trong DB cho đúng
     * với dữ liệu đã seed.
     */
    private boolean matches(String ruleCode, ExercisePhysiologyDTO profile) {
        if (ruleCode == null) {
            return false;
        }
        return switch (ruleCode) {
            // Buổi tập có bài co tĩnh, hoặc bài được đánh dấu nguy cơ tăng vọt huyết áp.
            case "R1_STATIC_ACCUMULATION" ->
                    isStatic(profile) || "SPIKE_RISK".equalsIgnoreCase(profile.bloodPressureEffect());
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
     * Điền placeholder trong thông điệp luật (VD: {@code {joint}}).
     *
     * @param rule    luật gốc
     * @param profile hồ sơ sinh lý của bài
     */
    private PhysiologyAlertDTO fillPlaceholders(PhysiologyAlertDTO rule, ExercisePhysiologyDTO profile) {
        String message = rule.messageTemplate() == null ? "" : rule.messageTemplate();
        message = message.replace("{joint}", jointLabel(profile.primaryJoint()));
        message = message.replace("{static_count}", "1");
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
