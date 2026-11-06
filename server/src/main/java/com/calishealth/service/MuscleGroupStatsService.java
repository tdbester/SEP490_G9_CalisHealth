package com.calishealth.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Nguồn duy nhất cho danh mục nhóm cơ (bảng catalog {@code muscle_groups}) kèm số bài tập
 * thực tế đang hiển thị trong Library.
 *
 * <p>Dashboard (khối "Muscle Focus") và bộ lọc MUSCLE GROUP của trang Library đều đọc từ đây,
 * nên số bài trên card và số bài trong sidebar không bao giờ lệch nhau.</p>
 */
@Service
@RequiredArgsConstructor
public class MuscleGroupStatsService {

    private final JdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    public List<MuscleGroupStat> findAll() {
        return jdbcTemplate.query(
                """
                SELECT mg.id, mg.dashboard_code, mg.name, mg.icon_key, mg.tone,
                       COUNT(DISTINCT CASE WHEN e.type = 'HEALTH' THEN e.id END) AS health_count,
                       COUNT(DISTINCT CASE WHEN e.type = 'SKILL' THEN e.id END) AS skill_count
                FROM muscle_groups mg
                LEFT JOIN exercise_muscle_groups emg ON emg.muscle_group_id = mg.id
                LEFT JOIN exercises e ON e.id = emg.exercise_id
                    AND e.source = 'SYSTEM'
                    AND e.active = TRUE
                    AND UPPER(e.moderation_status) IN ('ACTIVE', 'ACCEPTED')
                GROUP BY mg.id, mg.dashboard_code, mg.name, mg.icon_key, mg.tone
                ORDER BY mg.id
                """,
                (rs, rowNum) -> new MuscleGroupStat(
                        rs.getLong("id"),
                        // Nhóm cơ tạo mới từ Library chỉ có `name`, nên dashboard_code /
                        // icon_key / tone có thể NULL -> fallback để phía client luôn hợp lệ.
                        rs.getString("dashboard_code") != null
                                ? rs.getString("dashboard_code")
                                : String.valueOf(rs.getLong("id")),
                        rs.getString("name"),
                        rs.getString("icon_key") != null ? rs.getString("icon_key") : "fitness",
                        rs.getString("tone") != null ? rs.getString("tone") : "purple",
                        rs.getLong("health_count"),
                        rs.getLong("skill_count")
                )
        );
    }

    public record MuscleGroupStat(
            Long id,
            String code,
            String name,
            String icon,
            String tone,
            long healthCount,
            long skillCount
    ) {}
}
