package com.calishealth.repository;

import com.calishealth.dtos.DayStreakDtos.ExerciseReportResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class DayStreakRepository {
    private final JdbcTemplate jdbcTemplate;

    public Optional<Long> findMemberProfileId(String email) {
        return jdbcTemplate.query(
                """
                SELECT mp.id
                FROM member_profiles mp
                JOIN users u ON u.id = mp.user_id
                WHERE u.email = ?
                """,
                resultSet -> resultSet.next() ? Optional.of(resultSet.getLong("id")) : Optional.empty(),
                email
        );
    }

    public List<LocalDate> findCompletedWorkoutDays(Long memberProfileId, LocalDate throughDate) {
        return jdbcTemplate.query(
                """
                SELECT DISTINCT session_date
                FROM workout_sessions
                WHERE member_profile_id = ?
                  AND status = 'COMPLETED'
                  AND finished_at IS NOT NULL
                  AND session_date <= ?
                ORDER BY session_date
                """,
                (resultSet, rowNumber) -> resultSet.getDate("session_date").toLocalDate(),
                memberProfileId,
                Date.valueOf(throughDate)
        );
    }

    public int countCompletedSessions(Long memberProfileId, LocalDate startDate, LocalDate endDate) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM workout_sessions
                WHERE member_profile_id = ?
                  AND status = 'COMPLETED'
                  AND finished_at IS NOT NULL
                  AND session_date BETWEEN ? AND ?
                """,
                Integer.class,
                memberProfileId,
                Date.valueOf(startDate),
                Date.valueOf(endDate)
        );
        return count == null ? 0 : count;
    }

    public DayReportData findDayReport(Long memberProfileId, LocalDate date) {
        List<ExerciseReportResponse> exercises = jdbcTemplate.query(
                """
                SELECT e.id,
                       e.name,
                       e.type,
                       SUM(ser.sets_completed) AS sets_completed,
                       SUM(ser.valid_reps + ser.invalid_reps) AS reps,
                       COALESCE(
                           AVG(ser.accuracy),
                           CASE
                               WHEN SUM(ser.valid_reps + ser.invalid_reps) > 0
                                   THEN 100.0 * SUM(ser.valid_reps)
                                       / SUM(ser.valid_reps + ser.invalid_reps)
                           END
                       ) AS form_accuracy
                FROM workout_sessions ws
                JOIN session_exercise_results ser ON ser.workout_session_id = ws.id
                JOIN exercises e ON e.id = ser.exercise_id
                WHERE ws.member_profile_id = ?
                  AND ws.session_date = ?
                  AND ws.status = 'COMPLETED'
                  AND ws.finished_at IS NOT NULL
                GROUP BY e.id, e.name, e.type
                ORDER BY MIN(ser.sort_order), e.name
                """,
                (resultSet, rowNumber) -> new ExerciseReportResponse(
                        resultSet.getLong("id"),
                        resultSet.getString("name"),
                        resultSet.getString("type"),
                        resultSet.getInt("sets_completed"),
                        resultSet.getInt("reps"),
                        Optional.ofNullable(resultSet.getBigDecimal("form_accuracy"))
                                .map(BigDecimal::doubleValue)
                                .orElse(0.0)
                ),
                memberProfileId,
                Date.valueOf(date)
        );

        Integer activeSeconds = jdbcTemplate.queryForObject(
                """
                SELECT COALESCE(SUM(active_seconds), 0)
                FROM workout_sessions
                WHERE member_profile_id = ?
                  AND session_date = ?
                  AND status = 'COMPLETED'
                  AND finished_at IS NOT NULL
                """,
                Integer.class,
                memberProfileId,
                Date.valueOf(date)
        );

        return new DayReportData(exercises, activeSeconds == null ? 0 : activeSeconds);
    }

    public record DayReportData(List<ExerciseReportResponse> exercises, int activeSeconds) {
    }
}
