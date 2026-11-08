package com.calishealth.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Nguồn số liệu để tính điểm leaderboard tuần, đọc thẳng từ bảng hoạt động
 * (workout_sessions + session_exercise_results).
 *
 * <p>Công thức (không có điểm trần — tổng điểm tăng tuyến tính theo hoạt động):
 * <pre>
 *   sessions_score  = số buổi tập hoàn thành * 25
 *   time_score      = tổng phút tập thực tế / 6
 *   accuracy_score  = accuracy trung bình * 0.30
 *   rest_day_bonus  = số ngày nghỉ trong tuần * 4   -- chỉ khi đạt mục tiêu tuần
 *   streak_bonus    = số tuần liên tiếp đạt mục tiêu * 5
 * </pre>
 */
@Repository
@RequiredArgsConstructor
public class LeaderboardScoringRepository {

    // ---- Hệ số quy đổi điểm ---------------------------------------------------
    public static final int POINTS_PER_SESSION = 25;
    public static final int MINUTES_PER_TIME_POINT = 6;
    public static final int POINTS_PER_REST_DAY = 4;
    public static final int POINTS_PER_STREAK_WEEK = 5;

    /** Số ngày trong một tuần. */
    public static final int DAYS_PER_WEEK = 7;

    /**
     * Accuracy của 1 bài: điểm form AI chấm, không có thì tỉ lệ rep đúng
     * (chỉ bài REPS; bài HOLD không có rep). Không có số đo nào -> NULL.
     * Cùng quy tắc với {@code MemberTrackingRepository}.
     */
    private static final String EXERCISE_ACCURACY_SQL = """
            COALESCE(
                ser.accuracy,
                CASE
                    WHEN e.category <> 'HOLD' AND (ser.valid_reps + ser.invalid_reps) > 0
                        THEN 100.0 * ser.valid_reps / (ser.valid_reps + ser.invalid_reps)
                END
            )""";

    private final JdbcTemplate jdbcTemplate;

    /**
     * Số buổi tập + tổng giây tập theo từng ngày trong khoảng tuần.
     * Chỉ tính buổi COMPLETED đã có finished_at.
     */
    public List<DayActivity> findDailyActivity(Long memberProfileId, LocalDate weekStart) {
        LocalDate weekEnd = weekStart.plusDays(DAYS_PER_WEEK - 1L);
        return jdbcTemplate.query(
                """
                SELECT session_date,
                       COUNT(*) AS sessions,
                       COALESCE(SUM(active_seconds), 0) AS active_seconds
                FROM workout_sessions
                WHERE member_profile_id = ?
                  AND status = 'COMPLETED'
                  AND finished_at IS NOT NULL
                  AND session_date BETWEEN ? AND ?
                GROUP BY session_date
                """,
                (rs, rowNum) -> new DayActivity(
                        rs.getDate("session_date").toLocalDate(),
                        rs.getInt("sessions"),
                        rs.getLong("active_seconds")
                ),
                memberProfileId,
                Date.valueOf(weekStart),
                Date.valueOf(weekEnd)
        );
    }

    /** Accuracy trung bình của member trong tuần (0-100), null khi tuần không có bài nào có số đo. */
    public BigDecimal findAverageAccuracy(Long memberProfileId, LocalDate weekStart) {
        LocalDate weekEnd = weekStart.plusDays(DAYS_PER_WEEK - 1L);
        Double value = jdbcTemplate.queryForObject(
                """
                SELECT AVG(%s)
                FROM session_exercise_results ser
                JOIN workout_sessions ws ON ws.id = ser.workout_session_id
                JOIN exercises e ON e.id = ser.exercise_id
                WHERE ws.member_profile_id = ?
                  AND ws.status = 'COMPLETED'
                  AND ws.finished_at IS NOT NULL
                  AND ws.session_date BETWEEN ? AND ?
                """.formatted(EXERCISE_ACCURACY_SQL),
                Double.class,
                memberProfileId,
                Date.valueOf(weekStart),
                Date.valueOf(weekEnd)
        );
        return value == null ? null : BigDecimal.valueOf(value);
    }

    /** Số buổi tập hoàn thành trong tuần. */
    public int countCompletedSessions(Long memberProfileId, LocalDate weekStart, LocalDate weekEnd) {
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
                Date.valueOf(weekStart),
                Date.valueOf(weekEnd)
        );
        return count == null ? 0 : count;
    }

    /** Số ngày có tập trong tuần (mục tiêu tính theo NGÀY, không theo buổi). */
    public int countTrainingDays(Long memberProfileId, LocalDate weekStart, LocalDate weekEnd) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(DISTINCT session_date)
                FROM workout_sessions
                WHERE member_profile_id = ?
                  AND status = 'COMPLETED'
                  AND finished_at IS NOT NULL
                  AND session_date BETWEEN ? AND ?
                """,
                Integer.class,
                memberProfileId,
                Date.valueOf(weekStart),
                Date.valueOf(weekEnd)
        );
        return count == null ? 0 : count;
    }

    /** Tổng phút tập thực tế trong tuần. */
    public long totalActiveMinutes(Long memberProfileId, LocalDate weekStart, LocalDate weekEnd) {
        Long seconds = jdbcTemplate.queryForObject(
                """
                SELECT COALESCE(SUM(active_seconds), 0)
                FROM workout_sessions
                WHERE member_profile_id = ?
                  AND status = 'COMPLETED'
                  AND finished_at IS NOT NULL
                  AND session_date BETWEEN ? AND ?
                """,
                Long.class,
                memberProfileId,
                Date.valueOf(weekStart),
                Date.valueOf(weekEnd)
        );
        return seconds == null ? 0L : seconds / 60L;
    }

    /**
     * Ngày tập của member trong tuần, để tính ngày nghỉ.
     *
     * @return map ngày -> số buổi tập trong ngày đó
     */
    public Map<LocalDate, Integer> findTrainingDays(Long memberProfileId, LocalDate weekStart) {
        LocalDate weekEnd = weekStart.plusDays(DAYS_PER_WEEK - 1L);
        Map<LocalDate, Integer> result = new java.util.HashMap<>();
        jdbcTemplate.query(
                """
                SELECT session_date, COUNT(*) AS sessions
                FROM workout_sessions
                WHERE member_profile_id = ?
                  AND status = 'COMPLETED'
                  AND finished_at IS NOT NULL
                  AND session_date BETWEEN ? AND ?
                GROUP BY session_date
                """,
                rs -> {
                    result.put(rs.getDate("session_date").toLocalDate(), rs.getInt("sessions"));
                },
                memberProfileId,
                Date.valueOf(weekStart),
                Date.valueOf(weekEnd)
        );
        return result;
    }

    /** Số tuần liên tiếp đạt mục tiêu (tính từ tuần tính dưới lên). */
    public int countGoalWeekStreak(Long memberProfileId, int daysPerWeek, LocalDate throughWeek) {
        int streak = 0;
        LocalDate cursor = throughWeek;
        while (cursor != null) {
            int trainingDays = countTrainingDays(memberProfileId, cursor, cursor.plusDays(DAYS_PER_WEEK - 1L));
            if (trainingDays < daysPerWeek) {
                break;
            }
            streak++;
            cursor = cursor.minusWeeks(1);
        }
        return streak;
    }

    /** Hoạt động trong một ngày. */
    public record DayActivity(LocalDate date, int sessions, long activeSeconds) {
    }
}
