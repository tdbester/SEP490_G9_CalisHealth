package com.calishealth.service;

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
        List<MuscleGroupRow> rows = jdbcTemplate.query(
                """
                SELECT mg.id AS muscle_group_id, mg.dashboard_code, mg.name, mg.icon_key, mg.tone,
                       COUNT(DISTINCT e.id) AS exercise_count
                FROM muscle_groups mg
                LEFT JOIN exercise_muscle_groups emg ON emg.muscle_group_id = mg.id
                LEFT JOIN exercises e ON e.id = emg.exercise_id AND e.status = 'ACTIVE'
                GROUP BY mg.id, mg.dashboard_code, mg.name, mg.icon_key, mg.tone
                ORDER BY mg.id
                """,
                (rs, rowNum) -> new MuscleGroupRow(
                        // Nhóm cơ tạo mới từ Library (ExerciseService) chỉ có `name`,
                        // nên dashboard_code/icon_key/tone có thể NULL -> fallback để
                        // client luôn nhận id và icon hợp lệ.
                        rs.getString("dashboard_code") != null ? rs.getString("dashboard_code")
                                : String.valueOf(rs.getLong("muscle_group_id")),
                        rs.getString("name"),
                        rs.getInt("exercise_count"),
                        rs.getString("icon_key") != null ? rs.getString("icon_key") : "fitness",
                        rs.getString("tone") != null ? rs.getString("tone") : "purple"
                )
        );
        ArrayNode result = jsonMapper.createArrayNode();
        rows.forEach(row -> result.addObject()
                .put("id", row.id()).put("name", row.name()).put("count", row.count())
                .put("icon", row.icon()).put("tone", row.tone()));
        return result;
    }

    private ArrayNode skills() {
        List<SkillRow> rows = jdbcTemplate.query(
                """
                SELECT e.id, e.name, e.difficulty_level,
                       COUNT(DISTINCT pr.prerequisite_exercise_id) + 1 AS step_count
                FROM exercises e
                LEFT JOIN progression_rules pr ON pr.exercise_id = e.id AND pr.status = 'ACTIVE'
                WHERE e.type = 'SKILL' AND e.status = 'ACTIVE'
                GROUP BY e.id, e.name, e.difficulty_level
                ORDER BY e.id
                """,
                (rs, rowNum) -> new SkillRow(
                        slug(rs.getString("name")), rs.getString("name"),
                        rs.getInt("step_count"), rs.getString("difficulty_level")
                )
        );
        String[] tones = {"purple", "blue", "green", "orange", "pink", "cyan"};
        ArrayNode result = jsonMapper.createArrayNode();
        for (int index = 0; index < rows.size(); index++) {
            SkillRow row = rows.get(index);
            result.addObject().put("id", row.id()).put("name", row.name())
                    .put("steps", row.steps()).put("level", row.level())
                    .put("tone", tones[index % tones.length]);
        }
        return result;
    }

    private ObjectNode community() {
        Long workouts = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM workout_entries WHERE active = TRUE AND created_by IS NOT NULL",
                Long.class
        );
        Long athletes = jdbcTemplate.queryForObject(
                "SELECT COUNT(DISTINCT created_by) FROM workout_entries WHERE active = TRUE AND created_by IS NOT NULL",
                Long.class
        );
        return jsonMapper.createObjectNode()
                .put("workouts", workouts == null ? 0 : workouts)
                .put("athletes", athletes == null ? 0 : athletes);
    }

    private ObjectNode healthMetrics(String email) {
        ObjectNode result = jsonMapper.createObjectNode();
        if (email == null || email.isBlank() || "anonymousUser".equals(email)) {
            return result;
        }

        List<MeasurementRow> rows = jdbcTemplate.query(
                """
                SELECT bm.weight, bm.height
                FROM body_measurements bm
                JOIN member_profiles mp ON mp.id = bm.member_profile_id
                JOIN users u ON u.id = mp.user_id
                WHERE u.email = ?
                ORDER BY bm.measured_at DESC, bm.id DESC
                LIMIT 1
                """,
                (rs, rowNum) -> new MeasurementRow(rs.getBigDecimal("weight"), rs.getBigDecimal("height")),
                email
        );
        if (rows.isEmpty()) {
            return result;
        }

        MeasurementRow measurement = rows.get(0);
        if (measurement.weight() != null) {
            result.put("weight", measurement.weight());
        }
        if (measurement.weight() != null && measurement.height() != null) {
            BigDecimal heightMeters = measurement.height().compareTo(BigDecimal.valueOf(3)) > 0
                    ? measurement.height().movePointLeft(2) : measurement.height();
            if (heightMeters.signum() > 0) {
                double bmi = measurement.weight().doubleValue() / Math.pow(heightMeters.doubleValue(), 2);
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

    private record MuscleGroupRow(String id, String name, int count, String icon, String tone) {}
    private record SkillRow(String id, String name, int steps, String level) {}
    private record MeasurementRow(BigDecimal weight, BigDecimal height) {}
}
