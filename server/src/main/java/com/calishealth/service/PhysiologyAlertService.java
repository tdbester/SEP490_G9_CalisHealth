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
import java.util.Map;
import java.util.Optional;

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

    /**
     * Ngưỡng kích hoạt luật {@code R3_ACUTE_CHRONIC_LOAD}.
     *
     * <p>Khớp với {@code condition_desc} của R3 trong migration V76: ACR vượt 1.5.
     * Vùng an toàn 0.8-1.3 được khuyến nghị; từ 1.5 trở lên gắn với nguy cơ cao hơn.</p>
     */
    private static final double ACUTE_CHRONIC_RATIO_THRESHOLD = 1.5;

    /**
     * Số buổi tập hoàn thành tối thiểu trong 28 ngày để tính được mẫu số đáng tin.
     *
     * <p>Dưới ngưỡng này, "trung bình 4 tuần" được tính từ quá ít dữ liệu nên tỉ lệ
     * dễ bị nhiễu (một buổi tập duy nhất cũng ra tỉ lệ khá cao) — khi đó không
     * kích hoạt cảnh báo.</p>
     */
    private static final int MIN_SESSIONS_FOR_ACR = 4;

    /** Số tuần dùng làm mẫu số (chronic) của tỉ lệ acute:chronic. */
    private static final int CHRONIC_WEEKS = 4;

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
        return evaluate(profile, staticCount, null);
    }

    /**
     * Chọn các luật cảnh báo khớp với hồ sơ sinh lý của bài tập, có tính ngữ
     * cảnh buổi tập VÀ lịch sử tải tập của member.
     *
     * <p>Luật {@code R3_ACUTE_CHRONIC_LOAD} không suy ra được từ hồ sơ một bài
     * mà cần lịch sử 7 ngày / 28 ngày của member, nên chỉ khớp khi có
     * {@code userId} và đủ dữ liệu buổi tập.</p>
     *
     * @param profile      hồ sơ sinh lý của bài (null -> không có luật nào khớp)
     * @param staticCount  số bài co tĩnh (ISOMETRIC/STATIC) trong buổi tập
     * @param userId       id member (null -> bỏ qua luật dựa trên lịch sử tập)
     * @return danh sách luật đã điền placeholder, theo mức nghiêm trọng giảm dần
     */
    @Transactional(readOnly = true)
    public List<PhysiologyAlertDTO> evaluate(ExercisePhysiologyDTO profile, int staticCount, Long userId) {
        if (profile == null) {
            return List.of();
        }
        int effectiveStaticCount = Math.max(staticCount, 1);
        // Tỉ lệ tải cấp/chronic (ACR) của member: null khi chưa đủ dữ liệu.
        Double acuteChronicRatio = userId == null ? null : acuteChronicRatio(userId).orElse(null);
        List<PhysiologyAlertDTO> matched = new ArrayList<>();
        for (PhysiologyAlertDTO rule : listActiveRules()) {
            if (matches(rule.ruleCode(), profile, effectiveStaticCount, acuteChronicRatio)) {
                matched.add(fillPlaceholders(rule, profile, effectiveStaticCount, acuteChronicRatio));
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
     * @param acuteChronicRatio tỉ lệ tải 7 ngày / trung bình tuần 28 ngày (null nếu thiếu dữ liệu)
     */
    private boolean matches(String ruleCode,
                            ExercisePhysiologyDTO profile,
                            int staticCount,
                            Double acuteChronicRatio) {
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
            // Tải tập 7 ngày gần đây cao hơn >= 1.5 lần trung bình tuần của 4 tuần.
            case "R3_ACUTE_CHRONIC_LOAD" ->
                    acuteChronicRatio != null && acuteChronicRatio >= ACUTE_CHRONIC_RATIO_THRESHOLD;
            // Bài dễ gây khó tiêu.
            case "R4_DIGESTIVE_DISCOMFORT" ->
                    "MODERATE".equalsIgnoreCase(profile.giRisk()) || "HIGH".equalsIgnoreCase(profile.giRisk());
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
     * Tính tỉ lệ tải cấp/chronic (ACR) của member.
     *
     * <p>ACR = (tổng tải 7 ngày gần nhất) / (trung bình tải của một tuần trong
     * 28 ngày). Tải tập được đo bằng "rep-equivalent" (số rep + số giây tập /
     * 10) — hệ thống chưa thu thập RPE nên không dùng session-RPE.</p>
     *
     * <p>Chỉ trả về tỉ lệ khi member đã có đủ buổi tập hoàn thành trong 28 ngày,
     * nếu không tỉ lệ sẽ bị nhiễu nặng và cảnh báo thành nhiễu trắng.</p>
     *
     * @param userId id member
     * @return tỉ lệ ACR, hoặc rỗng khi thiếu dữ liệu
     */
    @Transactional(readOnly = true)
    public Optional<Double> acuteChronicRatio(Long userId) {
        if (userId == null) {
            return Optional.empty();
        }
        try {
            Map<String, Object> row = jdbcTemplate.queryForMap(
                    """
                    SELECT COALESCE(SUM(CASE
                              WHEN ws.session_date >= CURRENT_DATE - INTERVAL 6 DAY
                              THEN ws.total_reps + FLOOR(ws.active_seconds / 10)
                              ELSE 0 END), 0) AS acute_load,
                           COALESCE(SUM(ws.total_reps + FLOOR(ws.active_seconds / 10)), 0) AS total_load,
                           COUNT(*) AS session_count
                    FROM workout_sessions ws
                    JOIN member_profiles mp ON mp.id = ws.member_profile_id
                    WHERE mp.user_id = ?
                      AND ws.status = 'COMPLETED'
                      AND ws.finished_at IS NOT NULL
                      AND ws.session_date >= CURRENT_DATE - INTERVAL 27 DAY
                    """,
                    userId);
            long sessionCount = toLong(row.get("session_count"));
            if (sessionCount < MIN_SESSIONS_FOR_ACR) {
                return Optional.empty();
            }
            long acuteLoad = toLong(row.get("acute_load"));
            long totalLoad = toLong(row.get("total_load"));
            // Mẫu số = trung bình tải của MỘT TUẦN trong 4 tuần.
            double chronicWeeklyLoad = totalLoad / (double) CHRONIC_WEEKS;
            if (chronicWeeklyLoad <= 0) {
                return Optional.empty();
            }
            return Optional.of(acuteLoad / chronicWeeklyLoad);
        } catch (Exception ex) {
            // Bảng chưa migrate hoặc chưa có dữ liệu -> không kích hoạt luật.
            return Optional.empty();
        }
    }

    private static long toLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        return 0L;
    }

    /**
     * Điền placeholder trong thông điệp luật (VD: {@code {joint}}).
     *
     * @param rule        luật gốc
     * @param profile     hồ sơ sinh lý của bài
     * @param staticCount số bài co tĩnh trong buổi tập
     * @param acuteChronicRatio tỉ lệ ACR của member (null nếu không có)
     */
    private PhysiologyAlertDTO fillPlaceholders(
            PhysiologyAlertDTO rule,
            ExercisePhysiologyDTO profile,
            int staticCount,
            Double acuteChronicRatio) {
        String message = rule.messageTemplate() == null ? "" : rule.messageTemplate();
        message = message.replace("{joint}", jointLabel(profile.primaryJoint()));
        message = message.replace("{static_count}", String.valueOf(staticCount));
        message = message.replace("{ratio_pct}", ratioPercent(acuteChronicRatio));
        return new PhysiologyAlertDTO(rule.ruleCode(), rule.title(), rule.severity(), message);
    }

    /**
     * Phần trăm mà tải 7 ngày cao hơn trung bình 4 tuần.
     *
     * <p>ACR 1.5 -> "+50%", ACR 2.0 -> "+100%".</p>
     */
    private static String ratioPercent(Double acuteChronicRatio) {
        if (acuteChronicRatio == null || acuteChronicRatio.isNaN() || acuteChronicRatio.isInfinite()) {
            return "—";
        }
        long percent = Math.round((acuteChronicRatio - 1.0) * 100.0);
        return (percent >= 0 ? "+" : "") + percent + "%";
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
