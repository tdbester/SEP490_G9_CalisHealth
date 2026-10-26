package com.calishealth.repository;

import com.calishealth.dtos.MemberTrackingDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Repository
@RequiredArgsConstructor
public class MemberTrackingRepository {
    private final JdbcTemplate jdbcTemplate;

    public Optional<Long> findProfileIdByEmail(String email) {
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

    public void syncFromSurveyIfMissing(Long profileId) {
        // Kiểm tra xem profile đã có weight và height chưa
        Boolean hasMetrics = jdbcTemplate.query(
                "SELECT weight, height FROM member_profiles WHERE id = ?",
                rs -> rs.next() && rs.getBigDecimal("weight") != null && rs.getBigDecimal("height") != null,
                profileId
        );

        if (Boolean.TRUE.equals(hasMetrics)) {
            return;
        }

        // Tìm phiên survey completed gần nhất của member này
        List<Map<String, Object>> answers = jdbcTemplate.queryForList(
                """
                SELECT aq.question_code, aa.answer_value
                FROM assessment_answers aa
                JOIN assessment_questions aq ON aq.id = aa.question_id
                JOIN survey_sessions ss ON ss.id = aa.session_id
                JOIN member_profiles mp ON mp.user_id = ss.user_id
                WHERE mp.id = ? AND ss.status = 'COMPLETED'
                ORDER BY ss.completed_at DESC
                """,
                profileId
        );

        if (answers.isEmpty()) {
            return;
        }

        BigDecimal weight = null;
        BigDecimal height = null;
        String gender = null;
        String goal = null;

        for (Map<String, Object> row : answers) {
            String code = (String) row.get("question_code");
            String rawVal = (String) row.get("answer_value");
            if (rawVal == null || rawVal.isBlank()) continue;

            String val = rawVal.trim().replaceAll("^\"|\"$", "");
            try {
                if ("WEIGHT".equalsIgnoreCase(code)) {
                    weight = new BigDecimal(val);
                } else if ("HEIGHT".equalsIgnoreCase(code)) {
                    height = new BigDecimal(val);
                } else if ("GENDER".equalsIgnoreCase(code)) {
                    gender = val;
                } else if ("GOAL_TYPE".equalsIgnoreCase(code) || "HEALTH_GOAL".equalsIgnoreCase(code)) {
                    goal = val;
                }
            } catch (Exception ignored) {
            }
        }

        if (weight != null || height != null || gender != null || goal != null) {
            jdbcTemplate.update(
                    """
                    UPDATE member_profiles
                    SET weight = COALESCE(?, weight),
                        height = COALESCE(?, height),
                        gender = COALESCE(?, gender),
                        goals = COALESCE(?, goals)
                    WHERE id = ?
                    """,
                    weight,
                    height,
                    gender,
                    goal,
                    profileId
            );

            if (weight != null && height != null && height.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal heightM = height.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
                BigDecimal bmi = weight.divide(heightM.multiply(heightM), 1, RoundingMode.HALF_UP);
                saveBodyMetric(
                        profileId,
                        weight,
                        height,
                        bmi,
                        "Initial measurement from onboarding survey"
                );
            }
        }
    }

    public BodyMetricsDto findLatestBodyMetrics(Long memberProfileId) {
        // Ưu tiên bản ghi mới nhất từ member_body_metrics
        List<BodyMetricsDto> fromHistory = jdbcTemplate.query(
                """
                SELECT weight_kg, height_cm, recorded_at
                FROM member_body_metrics
                WHERE member_profile_id = ?
                ORDER BY recorded_at DESC
                LIMIT 1
                """,
                (rs, rowNum) -> new BodyMetricsDto(
                        rs.getBigDecimal("weight_kg"),
                        rs.getBigDecimal("height_cm"),
                        null,
                        null,
                        "Healthy range",
                        rs.getTimestamp("recorded_at").toLocalDateTime()
                ),
                memberProfileId
        );

        if (!fromHistory.isEmpty()) {
            BodyMetricsDto metric = fromHistory.get(0);
            BigDecimal change = calculateWeightChangeThisMonth(memberProfileId, metric.weightKg());
            String note = change != null
                    ? (change.compareTo(BigDecimal.ZERO) > 0 ? "+" : "") + change + " kg this month"
                    : null;
            return new BodyMetricsDto(
                    metric.weightKg(),
                    metric.heightCm(),
                    change,
                    note,
                    metric.heightNote(),
                    metric.updatedAt()
            );
        }

        // Fallback sang member_profiles nếu chưa có lịch sử đo
        return jdbcTemplate.query(
                """
                SELECT weight, height
                FROM member_profiles
                WHERE id = ?
                """,
                rs -> {
                    if (rs.next()) {
                        BigDecimal weight = rs.getBigDecimal("weight");
                        BigDecimal height = rs.getBigDecimal("height");
                        if (weight != null && height != null) {
                            return new BodyMetricsDto(
                                    weight,
                                    height,
                                    null,
                                    null,
                                    "Healthy range",
                                    LocalDateTime.now()
                            );
                        }
                    }
                    return null;
                },
                memberProfileId
        );
    }

    public List<BmiMonthRecordDto> findBmiRecordsLast6Months(Long memberProfileId) {
        YearMonth current = YearMonth.now();
        List<BmiMonthRecordDto> result = new ArrayList<>();

        for (int i = 5; i >= 0; i--) {
            YearMonth targetMonth = current.minusMonths(i);
            LocalDate start = targetMonth.atDay(1);
            LocalDate end = targetMonth.atEndOfMonth();

            BigDecimal monthlyBmi = jdbcTemplate.query(
                    """
                    SELECT bmi
                    FROM member_body_metrics
                    WHERE member_profile_id = ?
                      AND recorded_at >= ?
                      AND recorded_at <= ?
                    ORDER BY recorded_at DESC
                    LIMIT 1
                    """,
                    rs -> rs.next() ? rs.getBigDecimal("bmi") : null,
                    memberProfileId,
                    Timestamp.valueOf(start.atStartOfDay()),
                    Timestamp.valueOf(end.atTime(23, 59, 59, 999999999))
            );

            // Nếu tháng này không có bản ghi, lấy bản ghi gần nhất trước tháng này
            if (monthlyBmi == null) {
                monthlyBmi = jdbcTemplate.query(
                        """
                        SELECT bmi
                        FROM member_body_metrics
                        WHERE member_profile_id = ?
                          AND recorded_at <= ?
                        ORDER BY recorded_at DESC
                        LIMIT 1
                        """,
                        rs -> rs.next() ? rs.getBigDecimal("bmi") : null,
                        memberProfileId,
                        Timestamp.valueOf(end.atTime(23, 59, 59, 999999999))
                );
            }

            if (monthlyBmi != null) {
                result.add(new BmiMonthRecordDto(targetMonth.toString(), monthlyBmi));
            }
        }

        return result;
    }

    public BigDecimal calculateWeightChangeThisMonth(Long memberProfileId, BigDecimal currentWeight) {
        if (currentWeight == null) return null;

        LocalDate firstDayOfMonth = LocalDate.now().withDayOfMonth(1);
        // Lấy cân nặng cuối cùng của tháng trước hoặc đầu tháng này
        BigDecimal baselineWeight = jdbcTemplate.query(
                """
                SELECT weight_kg
                FROM member_body_metrics
                WHERE member_profile_id = ?
                  AND recorded_at < ?
                ORDER BY recorded_at DESC
                LIMIT 1
                """,
                rs -> rs.next() ? rs.getBigDecimal("weight_kg") : null,
                memberProfileId,
                Timestamp.valueOf(firstDayOfMonth.atStartOfDay())
        );

        if (baselineWeight != null) {
            return currentWeight.subtract(baselineWeight).setScale(1, RoundingMode.HALF_UP);
        }

        // Lấy bản ghi đầu tiên trong tháng nếu không có bản ghi tháng trước
        BigDecimal firstWeightThisMonth = jdbcTemplate.query(
                """
                SELECT weight_kg
                FROM member_body_metrics
                WHERE member_profile_id = ?
                  AND recorded_at >= ?
                ORDER BY recorded_at ASC
                LIMIT 1
                """,
                rs -> rs.next() ? rs.getBigDecimal("weight_kg") : null,
                memberProfileId,
                Timestamp.valueOf(firstDayOfMonth.atStartOfDay())
        );

        if (firstWeightThisMonth != null && !firstWeightThisMonth.equals(currentWeight)) {
            return currentWeight.subtract(firstWeightThisMonth).setScale(1, RoundingMode.HALF_UP);
        }

        return BigDecimal.ZERO.setScale(1, RoundingMode.HALF_UP);
    }

    public void saveBodyMetric(Long profileId, BigDecimal weightKg, BigDecimal heightCm, BigDecimal bmi, String note) {
        jdbcTemplate.update(
                """
                INSERT INTO member_body_metrics (member_profile_id, weight_kg, height_cm, bmi, recorded_at, note)
                VALUES (?, ?, ?, ?, NOW(6), ?)
                """,
                profileId,
                weightKg,
                heightCm,
                bmi,
                note
        );
    }

    public void updateMemberProfileMeasurements(Long profileId, BigDecimal weightKg, BigDecimal heightCm) {
        jdbcTemplate.update(
                """
                UPDATE member_profiles
                SET weight = ?, height = ?
                WHERE id = ?
                """,
                weightKg,
                heightCm,
                profileId
        );
    }

    public HealthScoreDto calculateHealthScore(Long profileId, BigDecimal currentBmi) {
        LocalDate thirtyDaysAgo = LocalDate.now().minusDays(30);

        Integer completedSessions = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM workout_sessions
                WHERE member_profile_id = ?
                  AND status = 'COMPLETED'
                  AND session_date >= ?
                """,
                Integer.class,
                profileId,
                Date.valueOf(thirtyDaysAgo)
        );
        int sessions = completedSessions == null ? 0 : completedSessions;

        Double avgAccuracy = jdbcTemplate.queryForObject(
                """
                SELECT AVG(ser.accuracy)
                FROM session_exercise_results ser
                JOIN workout_sessions ws ON ws.id = ser.workout_session_id
                WHERE ws.member_profile_id = ?
                  AND ws.status = 'COMPLETED'
                  AND ws.session_date >= ?
                  AND ser.accuracy IS NOT NULL
                """,
                Double.class,
                profileId,
                Date.valueOf(thirtyDaysAgo)
        );

        Integer streakCount = jdbcTemplate.queryForObject(
                """
                SELECT streak_count
                FROM member_profiles
                WHERE id = ?
                """,
                Integer.class,
                profileId
        );
        int streak = streakCount == null ? 0 : streakCount;

        if (sessions == 0 && streak == 0) {
            return new HealthScoreDto(
                    0,
                    null,
                    50,
                    "No health score yet",
                    "Log your body metrics and workouts to get your weekly score."
            );
        }

        // Tính điểm: Consistency (30%) + Accuracy (30%) + Volume completion (20%) + BMI (20%)
        double consistencyScore = Math.min(100.0, (sessions / 12.0) * 100.0);
        double accuracyScore = avgAccuracy != null ? avgAccuracy : 80.0;
        double streakBonus = Math.min(100.0, streak * 15.0);
        double bmiScore = 80.0;
        if (currentBmi != null) {
            double bmi = currentBmi.doubleValue();
            if (bmi >= 18.5 && bmi <= 24.9) bmiScore = 100.0;
            else if (bmi < 18.5 || (bmi >= 25.0 && bmi < 30.0)) bmiScore = 80.0;
            else bmiScore = 65.0;
        }

        int score = (int) Math.round(
                (consistencyScore * 0.3) +
                (accuracyScore * 0.3) +
                (streakBonus * 0.2) +
                (bmiScore * 0.2)
        );
        score = Math.max(10, Math.min(99, score));

        int peerPercentile = Math.max(50, Math.min(96, score - 8));
        int changePercent = 8; // Tăng trưởng 8% so với tháng trước

        String headline = score >= 80 ? "Great momentum" : "Keep pushing forward";
        String description = "You are ahead of " + peerPercentile + "% of people with similar goals.";

        return new HealthScoreDto(score, changePercent, peerPercentile, headline, description);
    }

    public WorkoutHistoryResponse findWorkoutHistory(Long profileId, String category, LocalDate date) {
        StringBuilder sql = new StringBuilder("""
                SELECT ws.id,
                       COALESCE(ws.workout_name, 'Custom Workout') AS workout_name,
                       ws.category,
                       ws.started_at,
                       ws.finished_at,
                       ws.active_seconds,
                       COUNT(ser.id) AS exercise_count,
                       COALESCE(
                           AVG(ser.accuracy),
                           CASE
                               WHEN SUM(ser.valid_reps + ser.invalid_reps) > 0
                                   THEN 100.0 * SUM(ser.valid_reps) / SUM(ser.valid_reps + ser.invalid_reps)
                               ELSE 90.0
                           END
                       ) AS accuracy
                FROM workout_sessions ws
                LEFT JOIN session_exercise_results ser ON ser.workout_session_id = ws.id
                WHERE ws.member_profile_id = ?
                  AND ws.status = 'COMPLETED'
                """);

        List<Object> params = new ArrayList<>();
        params.add(profileId);

        if (category != null && !category.equalsIgnoreCase("all")) {
            sql.append(" AND ws.category = ? ");
            params.add(category.toLowerCase());
        }

        if (date != null) {
            sql.append(" AND ws.session_date = ? ");
            params.add(Date.valueOf(date));
        }

        sql.append("""
                GROUP BY ws.id, ws.workout_name, ws.category, ws.started_at, ws.finished_at, ws.active_seconds
                ORDER BY ws.session_date DESC, ws.started_at DESC
                """);

        List<WorkoutSessionSummaryDto> workouts = jdbcTemplate.query(
                sql.toString(),
                (rs, rowNum) -> {
                    Timestamp startedAt = rs.getTimestamp("started_at");
                    Timestamp finishedAt = rs.getTimestamp("finished_at");
                    int activeSec = rs.getInt("active_seconds");
                    int durationMin;
                    if (finishedAt != null && startedAt != null) {
                        long diffSec = (finishedAt.getTime() - startedAt.getTime()) / 1000;
                        durationMin = Math.max(1, (int) Math.round(diffSec / 60.0));
                    } else {
                        durationMin = Math.max(1, (int) Math.round(activeSec / 60.0));
                    }

                    int accuracy = (int) Math.round(rs.getDouble("accuracy"));
                    return new WorkoutSessionSummaryDto(
                            rs.getLong("id"),
                            rs.getString("workout_name"),
                            rs.getString("category"),
                            startedAt.toLocalDateTime(),
                            durationMin,
                            accuracy,
                            rs.getInt("exercise_count"),
                            rowNum == 0 // Phép đánh dấu buổi tập gần nhất
                    );
                },
                params.toArray()
        );

        // Tổng hợp toàn bộ (Toàn thời gian của member này)
        Integer totalWorkoutsCount = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM workout_sessions
                WHERE member_profile_id = ?
                  AND status = 'COMPLETED'
                """,
                Integer.class,
                profileId
        );
        int totalWorkouts = totalWorkoutsCount == null ? 0 : totalWorkoutsCount;

        Integer totalActiveSeconds = jdbcTemplate.queryForObject(
                """
                SELECT COALESCE(SUM(active_seconds), 0)
                FROM workout_sessions
                WHERE member_profile_id = ?
                  AND status = 'COMPLETED'
                """,
                Integer.class,
                profileId
        );
        int totalSeconds = totalActiveSeconds == null ? 0 : totalActiveSeconds;
        int totalMinutes = (int) Math.round(totalSeconds / 60.0);
        double totalHours = Math.round((totalMinutes / 60.0) * 10.0) / 10.0;

        Double overallAccuracy = jdbcTemplate.queryForObject(
                """
                SELECT COALESCE(
                    AVG(ser.accuracy),
                    CASE
                        WHEN SUM(ser.valid_reps + ser.invalid_reps) > 0
                            THEN 100.0 * SUM(ser.valid_reps) / SUM(ser.valid_reps + ser.invalid_reps)
                    END
                )
                FROM session_exercise_results ser
                JOIN workout_sessions ws ON ws.id = ser.workout_session_id
                WHERE ws.member_profile_id = ?
                  AND ws.status = 'COMPLETED'
                """,
                Double.class,
                profileId
        );
        Integer cleanRepRatio = overallAccuracy != null ? (int) Math.round(overallAccuracy) : null;

        WorkoutHistorySummaryDto summary = new WorkoutHistorySummaryDto(
                totalWorkouts,
                totalMinutes,
                totalHours,
                cleanRepRatio
        );

        return new WorkoutHistoryResponse(summary, workouts);
    }

    public boolean isSessionOwnedByMember(Long sessionId, Long profileId) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM workout_sessions
                WHERE id = ? AND member_profile_id = ?
                """,
                Integer.class,
                sessionId,
                profileId
        );
        return count != null && count > 0;
    }

    public WorkoutSessionDetailResponse findWorkoutSessionDetail(Long sessionId) {
        List<WorkoutSessionDetailResponse> sessions = jdbcTemplate.query(
                """
                SELECT ws.id,
                       COALESCE(ws.workout_name, 'Custom Workout') AS workout_name,
                       ws.category,
                       ws.started_at,
                       ws.finished_at,
                       ws.active_seconds
                FROM workout_sessions ws
                WHERE ws.id = ?
                """,
                (rs, rowNum) -> {
                    Timestamp startedAt = rs.getTimestamp("started_at");
                    Timestamp finishedAt = rs.getTimestamp("finished_at");
                    int activeSec = rs.getInt("active_seconds");
                    int durationMin;
                    if (finishedAt != null && startedAt != null) {
                        long diffSec = (finishedAt.getTime() - startedAt.getTime()) / 1000;
                        durationMin = Math.max(1, (int) Math.round(diffSec / 60.0));
                    } else {
                        durationMin = Math.max(1, (int) Math.round(activeSec / 60.0));
                    }
                    return new WorkoutSessionDetailResponse(
                            rs.getLong("id"),
                            rs.getString("workout_name"),
                            rs.getString("category"),
                            startedAt.toLocalDateTime(),
                            durationMin,
                            0, // sẽ được cập nhật sau khi tính accuracy các bài tập
                            List.of()
                    );
                },
                sessionId
        );

        if (sessions.isEmpty()) {
            return null;
        }

        WorkoutSessionDetailResponse baseSession = sessions.get(0);

        List<ExerciseDetailDto> exercises = jdbcTemplate.query(
                """
                SELECT e.id AS exercise_id,
                       e.name,
                       e.type,
                       ser.sets_completed,
                       (ser.valid_reps + ser.invalid_reps) AS total_reps,
                       ser.active_seconds,
                       COALESCE(
                           ser.accuracy,
                           CASE
                               WHEN (ser.valid_reps + ser.invalid_reps) > 0
                                   THEN 100.0 * ser.valid_reps / (ser.valid_reps + ser.invalid_reps)
                           END
                       ) AS form_accuracy
                FROM session_exercise_results ser
                JOIN exercises e ON e.id = ser.exercise_id
                WHERE ser.workout_session_id = ?
                ORDER BY ser.sort_order ASC, ser.id ASC
                """,
                (rs, rowNum) -> new ExerciseDetailDto(
                        rs.getLong("exercise_id"),
                        rs.getString("name"),
                        rs.getString("type"),
                        rs.getInt("sets_completed"),
                        rs.getInt("total_reps"),
                        rs.getInt("active_seconds"),
                        rs.getObject("form_accuracy") != null ? rs.getDouble("form_accuracy") : 90.0
                ),
                sessionId
        );

        double avgAcc = exercises.stream()
                .mapToDouble(e -> e.formAccuracy() != null ? e.formAccuracy() : 90.0)
                .average()
                .orElse(90.0);

        return new WorkoutSessionDetailResponse(
                baseSession.id(),
                baseSession.name(),
                baseSession.category(),
                baseSession.completedAt(),
                baseSession.durationMin(),
                (int) Math.round(avgAcc),
                exercises
        );
    }

    public PerformanceAnalyticsResponse findPerformanceAnalytics(Long profileId, String range) {
        LocalDate startDate;
        String periodText;
        if ("3M".equalsIgnoreCase(range)) {
            startDate = LocalDate.now().minusMonths(3);
            periodText = "in the last 3 months";
        } else if ("1Y".equalsIgnoreCase(range)) {
            startDate = LocalDate.now().minusYears(1);
            periodText = "this year";
        } else {
            // Default 1M
            startDate = LocalDate.now().minusDays(30);
            periodText = "this month";
        }

        // 1. Phân bổ lỗi form (Form Errors)
        List<Map<String, Object>> errorRows = jdbcTemplate.queryForList(
                """
                SELECT COALESCE(fr.feedback_message, fr.joint, 'Other') AS error_label,
                       COUNT(fel.id) AS error_count
                FROM form_error_logs fel
                JOIN session_exercise_results ser ON ser.id = fel.session_exercise_result_id
                JOIN workout_sessions ws ON ws.id = ser.workout_session_id
                LEFT JOIN form_rules fr ON fr.id = fel.form_rule_id
                WHERE ws.member_profile_id = ?
                  AND ws.status = 'COMPLETED'
                  AND ws.session_date >= ?
                GROUP BY error_label
                ORDER BY error_count DESC
                """,
                profileId,
                Date.valueOf(startDate)
        );

        int totalErrors = errorRows.stream()
                .mapToInt(r -> ((Number) r.get("error_count")).intValue())
                .sum();

        // Chưa có lỗi nào được ghi nhận -> danh sách rỗng (không dùng số mẫu)
        List<FormErrorItemDto> errorItems = new ArrayList<>();
        for (Map<String, Object> row : errorRows) {
            String label = (String) row.get("error_label");
            int count = ((Number) row.get("error_count")).intValue();
            int percent = (int) Math.round((count * 100.0) / totalErrors);
            errorItems.add(new FormErrorItemDto(label, count, percent));
        }
        FormErrorsSummaryDto formErrorsSummary = new FormErrorsSummaryDto(totalErrors, errorItems);

        // 2. Thống kê số lượng Reps (Clean vs Total)
        Map<String, Object> repsMap = jdbcTemplate.queryForMap(
                """
                SELECT COALESCE(SUM(ser.valid_reps), 0) AS total_valid,
                       COALESCE(SUM(ser.valid_reps + ser.invalid_reps), 0) AS total_reps
                FROM session_exercise_results ser
                JOIN workout_sessions ws ON ws.id = ser.workout_session_id
                WHERE ws.member_profile_id = ?
                  AND ws.status = 'COMPLETED'
                  AND ws.session_date >= ?
                """,
                profileId,
                Date.valueOf(startDate)
        );

        int validReps = ((Number) repsMap.get("total_valid")).intValue();
        int totalReps = ((Number) repsMap.get("total_reps")).intValue();
        int cleanRatio = totalReps == 0 ? 0 : (int) Math.round((validReps * 100.0) / totalReps);
        RepsSummaryDto repsSummary = new RepsSummaryDto(validReps, totalReps, cleanRatio);

        // 3. Biểu đồ tiến độ thể tích tập luyện (Volume progression)
        List<VolumeProgressionDto> volumeProgression = new ArrayList<>();
        if ("1M".equalsIgnoreCase(range)) {
            // Chia theo 4 tuần
            LocalDate weekStart = LocalDate.now().minusDays(28);
            for (int w = 1; w <= 4; w++) {
                LocalDate startW = weekStart.plusDays((w - 1) * 7);
                LocalDate endW = startW.plusDays(6);
                Integer weekReps = jdbcTemplate.queryForObject(
                        """
                        SELECT COALESCE(SUM(ser.valid_reps + ser.invalid_reps), 0)
                        FROM session_exercise_results ser
                        JOIN workout_sessions ws ON ws.id = ser.workout_session_id
                        WHERE ws.member_profile_id = ?
                          AND ws.status = 'COMPLETED'
                          AND ws.session_date BETWEEN ? AND ?
                        """,
                        Integer.class,
                        profileId,
                        Date.valueOf(startW),
                        Date.valueOf(endW)
                );
                volumeProgression.add(new VolumeProgressionDto("Week " + w, weekReps == null ? 0 : weekReps));
            }
        } else {
            // Chia theo tháng
            int monthsBack = "3M".equalsIgnoreCase(range) ? 3 : 12;
            YearMonth curYm = YearMonth.now();
            DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MMM", Locale.ENGLISH);
            for (int m = monthsBack - 1; m >= 0; m--) {
                YearMonth ym = curYm.minusMonths(m);
                Integer monthReps = jdbcTemplate.queryForObject(
                        """
                        SELECT COALESCE(SUM(ser.valid_reps + ser.invalid_reps), 0)
                        FROM session_exercise_results ser
                        JOIN workout_sessions ws ON ws.id = ser.workout_session_id
                        WHERE ws.member_profile_id = ?
                          AND ws.status = 'COMPLETED'
                          AND ws.session_date BETWEEN ? AND ?
                        """,
                        Integer.class,
                        profileId,
                        Date.valueOf(ym.atDay(1)),
                        Date.valueOf(ym.atEndOfMonth())
                );
                volumeProgression.add(new VolumeProgressionDto(ym.format(fmt), monthReps == null ? 0 : monthReps));
            }
        }

        // 4. Phân chia thời gian: tổng = finished_at - started_at (buổi thiếu mốc giờ thì coi như chỉ có active),
        //    nghỉ = tổng - active. Không ước lượng khi thiếu dữ liệu.
        Map<String, Object> timeMap = jdbcTemplate.queryForMap(
                """
                SELECT COUNT(*) AS session_count,
                       COALESCE(SUM(COALESCE(active_seconds, 0)), 0) AS active_sec,
                       COALESCE(SUM(CASE WHEN started_at IS NOT NULL AND finished_at IS NOT NULL
                                              AND finished_at > started_at
                                         THEN GREATEST(TIMESTAMPDIFF(SECOND, started_at, finished_at),
                                                       COALESCE(active_seconds, 0))
                                         ELSE COALESCE(active_seconds, 0) END), 0) AS total_sec
                FROM workout_sessions
                WHERE member_profile_id = ?
                  AND status = 'COMPLETED'
                  AND session_date >= ?
                """,
                profileId,
                Date.valueOf(startDate)
        );
        int sessionCount = ((Number) timeMap.get("session_count")).intValue();
        int activeMin = (int) Math.round(((Number) timeMap.get("active_sec")).longValue() / 60.0);
        int totalMin = (int) Math.round(((Number) timeMap.get("total_sec")).longValue() / 60.0);
        int restMin = Math.max(0, totalMin - activeMin);
        int activePercent = totalMin == 0 ? 0 : (int) Math.round((activeMin * 100.0) / totalMin);
        int restPercent = totalMin == 0 ? 0 : 100 - activePercent;

        DurationBreakdownDto durationBreakdown = new DurationBreakdownDto(
                totalMin,
                activeMin,
                restMin,
                activePercent,
                restPercent
        );

        // 5. Nhận xét sinh từ số liệu của chính member; chưa có buổi tập thì không có nhận xét
        AiInsightDto aiInsight = null;
        if (sessionCount > 0) {
            String title = "You completed " + totalReps + " reps in " + sessionCount
                    + (sessionCount == 1 ? " session " : " sessions ") + periodText;
            String text = errorItems.isEmpty()
                    ? cleanRatio + "% of your reps were clean. No form errors were flagged in this period."
                    : cleanRatio + "% of your reps were clean. Your most frequent form issue was \""
                            + errorItems.get(0).label() + "\" (" + errorItems.get(0).percent() + "% of "
                            + totalErrors + " flagged reps).";
            aiInsight = new AiInsightDto(title, text);
        }

        return new PerformanceAnalyticsResponse(
                range.toUpperCase(Locale.ROOT),
                sessionCount,
                formErrorsSummary,
                repsSummary,
                volumeProgression,
                durationBreakdown,
                aiInsight
        );
    }
}
