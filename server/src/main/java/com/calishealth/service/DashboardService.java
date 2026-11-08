package com.calishealth.service;

import com.calishealth.service.MuscleGroupStatsService.MuscleGroupStat;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class DashboardService {
    private final JdbcTemplate jdbcTemplate;
    private final MuscleGroupStatsService muscleGroupStatsService;
    private final JsonMapper jsonMapper = JsonMapper.builder().build();

    public ObjectNode getDashboard(String email) {
        ObjectNode response = jsonMapper.createObjectNode();
        response.set("muscleGroups", muscleGroups());
        response.set("skills", skills());
        response.set("community", community());
        response.set("healthMetrics", healthMetrics(email));
        return response;
    }

    private ArrayNode muscleGroups() {
        // Muscle Focus đọc thẳng từ catalog `muscle_groups` của Library (bảng nối
        // exercise_muscle_groups) qua MuscleGroupStatsService, dùng chung nguồn với
        // sidebar MUSCLE GROUP của trang Library.
        // Chỉ đếm bài HEALTH vì bấm vào card sẽ mở tab Health đã lọc sẵn nhóm cơ đó;
        // bài SKILL đã có khu "Skills" riêng ngay bên dưới.
        List<MuscleGroupStat> rows = muscleGroupStatsService.findAll();
        ArrayNode result = jsonMapper.createArrayNode();
        rows.stream()
                .filter(row -> row.healthCount() > 0)
                .forEach(row -> result.addObject()
                        .put("id", row.code())
                        .put("name", row.name())
                        .put("count", row.healthCount())
                        .put("icon", row.icon())
                        .put("tone", row.tone()));
        return result;
    }

    private ArrayNode skills() {
        // Carousel "Skills" lấy 2 bài tượng trưng cho mỗi đích đến
        // (handstand / muscle-up / front lever / planche): bậc dễ nhất làm điểm bắt đầu
        // và bậc kế tiếp để thấy lộ trình. Bước 1 khử trùng theo tên vì seed có nhiều
        // bài trùng (vd. "Tuck front lever" xuất hiện 2 lần), bước 2 mới xếp hạng trong
        // từng nhóm. Không có target_skill thì bỏ qua, nếu không carousel sẽ tràn toàn
        // bài tập skill rời rạc.
        List<SkillRow> rows = jdbcTemplate.query(
                """
                SELECT picked.id, picked.name, picked.difficulty_level,
                       CASE
                           WHEN picked.guide_text IS NULL OR picked.guide_text = '' THEN 0
                           ELSE 1 + LENGTH(picked.guide_text)
                               - LENGTH(REPLACE(picked.guide_text, CHAR(10), ''))
                       END AS step_count
                FROM (
                    SELECT dedup.id, dedup.name, dedup.difficulty_level, dedup.target_skill,
                           dedup.guide_text,
                           ROW_NUMBER() OVER (
                               PARTITION BY dedup.target_skill
                               ORDER BY (dedup.guide_text IS NULL),
                                        -- Level do Content Manager cấu hình động trong fitness_levels,
                                        -- nên thứ tự bậc lấy theo score_min thay vì danh sách level cố định.
                                        COALESCE((SELECT MIN(fl.score_min)
                                                  FROM fitness_levels fl
                                                  WHERE UPPER(fl.name) = UPPER(dedup.difficulty_level)),
                                                 2147483647),
                                        dedup.id
                           ) AS rank_in_skill
                    FROM (
                        SELECT e.id, e.name, e.difficulty_level, e.target_skill,
                               COALESCE(
                                   NULLIF(TRIM(e.execution_steps), ''),
                                   NULLIF(TRIM(e.instructions), '')
                               ) AS guide_text,
                               ROW_NUMBER() OVER (
                                   PARTITION BY e.target_skill, LOWER(e.name)
                                   ORDER BY (COALESCE(NULLIF(TRIM(e.execution_steps), ''),
                                                      NULLIF(TRIM(e.instructions), '')) IS NULL),
                                            e.id
                               ) AS rank_in_name
                        FROM exercises e
                        WHERE e.type = 'SKILL'
                          AND e.source = 'SYSTEM'
                          AND e.active = TRUE
                          AND UPPER(e.moderation_status) IN ('ACTIVE', 'ACCEPTED')
                          AND e.target_skill IS NOT NULL
                    ) dedup
                    WHERE dedup.rank_in_name = 1
                      -- Bài chưa có nội dung hướng dẫn sẽ hiện "0 steps" vô nghĩa trên card,
                      -- nên chỉ lấy bài đã có guide text (execution_steps hoặc instructions).
                      AND dedup.guide_text IS NOT NULL
                ) picked
                WHERE picked.rank_in_skill <= 2
                ORDER BY FIELD(picked.target_skill, 'HANDSTAND', 'MUSCLE_UP', 'FRONT_LEVER', 'PLANCHE'),
                         picked.rank_in_skill
                """,
                (rs, rowNum) -> new SkillRow(
                        rs.getLong("id"), slug(rs.getString("name")), rs.getString("name"),
                        rs.getInt("step_count"), rs.getString("difficulty_level")
                )
        );
        String[] tones = {"purple", "blue", "green", "orange", "pink", "cyan", "violet", "teal"};
        ArrayNode result = jsonMapper.createArrayNode();
        for (int index = 0; index < rows.size(); index++) {
            SkillRow row = rows.get(index);
            result.addObject().put("exerciseId", row.exerciseId()).put("id", row.id()).put("name", row.name())
                    .put("steps", row.steps()).put("level", row.level())
                    .put("tone", tones[index % tones.length]);
        }
        return result;
    }

    private ObjectNode community() {
        // Predicate giữ khớp với quy tắc hiển thị của Library Community.
        Long workouts = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM workout_entries
                WHERE source = 'CUSTOM'
                  AND template_status = 'PUBLISHED'
                  AND moderation_status = 'ACTIVE'
                  AND is_shared_with_community = TRUE
                """,
                Long.class
        );
        Long athletes = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(DISTINCT u.id)
                FROM users u
                WHERE EXISTS (
                    SELECT 1
                    FROM exercises e
                    WHERE e.created_by = u.id
                      AND e.source = 'CUSTOM'
                      AND e.active = TRUE
                      AND UPPER(e.moderation_status) IN ('ACTIVE', 'ACCEPTED')
                      AND e.share_with_community = TRUE
                )
                   OR EXISTS (
                       SELECT 1
                       FROM workout_entries w
                       WHERE w.created_by = u.id
                         AND w.source = 'CUSTOM'
                         AND w.template_status = 'PUBLISHED'
                         AND w.moderation_status = 'ACTIVE'
                         AND w.is_shared_with_community = TRUE
                   )
                """,
                Long.class
        );
        Long exercises = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM exercises e
                WHERE e.source = 'CUSTOM'
                  AND e.active = TRUE
                  AND UPPER(e.moderation_status) IN ('ACTIVE', 'ACCEPTED')
                  AND e.share_with_community = TRUE
                """,
                Long.class
        );
        return jsonMapper.createObjectNode()
                .put("workouts", workouts == null ? 0 : workouts)
                .put("athletes", athletes == null ? 0 : athletes)
                .put("exercises", exercises == null ? 0 : exercises);
    }

    private ObjectNode healthMetrics(String email) {
        ObjectNode result = jsonMapper.createObjectNode();
        if (email == null || email.isBlank() || "anonymousUser".equals(email)) {
            return result;
        }

        List<MeasurementRow> rows = jdbcTemplate.query(
                """
                SELECT mbm.weight_kg, mbm.height_cm, mbm.bmi
                FROM member_body_metrics mbm
                JOIN member_profiles mp ON mp.id = mbm.member_profile_id
                JOIN users u ON u.id = mp.user_id
                WHERE u.email = ?
                ORDER BY mbm.recorded_at DESC, mbm.id DESC
                LIMIT 1
                """,
                (rs, rowNum) -> new MeasurementRow(
                        rs.getBigDecimal("weight_kg"),
                        rs.getBigDecimal("height_cm"),
                        rs.getBigDecimal("bmi")),
                email
        );
        if (!rows.isEmpty()) {
            MeasurementRow measurement = rows.get(0);
            if (measurement.weight() != null) {
                result.put("weight", measurement.weight());
            }
            if (measurement.bmi() != null) {
                double bmi = measurement.bmi().doubleValue();
                result.put("bmi", Math.round(bmi * 10.0) / 10.0);
                result.put("bmiLabel", bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obesity");
            }
        }

        Long sessions = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM workout_sessions ws
                JOIN member_profiles mp ON mp.id = ws.member_profile_id
                JOIN users u ON u.id = mp.user_id
                WHERE u.email = ? AND ws.status = 'COMPLETED' AND ws.finished_at IS NOT NULL
                  AND ws.session_date BETWEEN ? AND ?
                """,
                Long.class, email,
                java.sql.Date.valueOf(java.time.LocalDate.now().with(java.time.DayOfWeek.MONDAY)),
                java.sql.Date.valueOf(java.time.LocalDate.now().with(java.time.DayOfWeek.SUNDAY))
        );
        result.put("weeklyGoal", Math.min(100, (int) Math.round((sessions == null ? 0 : sessions) * 100.0 / 6)));
        return result;
    }

    private static String slug(String value) {
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }

    private record SkillRow(Long exerciseId, String id, String name, int steps, String level) {}
    private record MeasurementRow(BigDecimal weight, BigDecimal height, BigDecimal bmi) {}
}
