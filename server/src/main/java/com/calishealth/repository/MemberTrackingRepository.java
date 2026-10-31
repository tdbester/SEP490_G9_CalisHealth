package com.calishealth.repository;

import com.calishealth.dtos.MemberTrackingDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Repository
@RequiredArgsConstructor
public class MemberTrackingRepository {
    /**
     * Accuracy của 1 bài: điểm form AI chấm, không có thì tỉ lệ rep đúng (chỉ bài REPS; bài HOLD không có rep);
     * không có số đo nào -> NULL. Accuracy buổi / giai đoạn = AVG biểu thức này (AVG bỏ qua NULL), nên không có
     * số đo thì ra NULL chứ không bịa điểm. Câu SQL dùng nó phải join exercises với alias e.
     */
    private static final String EXERCISE_ACCURACY_SQL = """
            COALESCE(
                ser.accuracy,
                CASE
                    WHEN e.category <> 'HOLD' AND (ser.valid_reps + ser.invalid_reps) > 0
                        THEN 100.0 * ser.valid_reps / (ser.valid_reps + ser.invalid_reps)
                END
            )""";

    /** Chỉ đếm rep ở bài REPS: bài HOLD đo bằng thời gian giữ (active_seconds), rep của nó không có nghĩa. */
    private static final String REPS_EXERCISES_ONLY_SQL = """
            JOIN exercises e ON e.id = ser.exercise_id AND e.category <> 'HOLD'""";

    private static final int DEFAULT_WEEKLY_GOAL_DAYS = 3;
    /** Số tuần lịch sử đọc để đếm chuỗi tuần; điểm streak đã tối đa từ tuần thứ 4. */
    private static final int WEEK_STREAK_LOOKBACK_WEEKS = 26;

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
        LocalDate today = LocalDate.now();
        // 4 tuần gần nhất (28 ngày tính cả hôm nay), cùng khoảng với tab 1M của Analytics
        LocalDate windowStart = today.minusDays(27);
        int weeklyGoal = findWeeklyGoalDays(profileId);

        // Ngày tập = ngày có ít nhất 1 buổi COMPLETED (2 buổi cùng ngày vẫn là 1 ngày, vì mục tiêu tính theo ngày)
        LocalDate thisMonday = today.with(DayOfWeek.MONDAY);
        LocalDate historyStart = thisMonday.minusWeeks(WEEK_STREAK_LOOKBACK_WEEKS);
        List<LocalDate> trainingDays = jdbcTemplate.queryForList(
                """
                SELECT DISTINCT session_date
                FROM workout_sessions
                WHERE member_profile_id = ?
                  AND status = 'COMPLETED'
                  AND session_date >= ?
                """,
                Date.class,
                profileId,
                Date.valueOf(historyStart)
        ).stream().map(Date::toLocalDate).toList();

        int daysInWindow = (int) trainingDays.stream().filter(d -> !d.isBefore(windowStart)).count();
        int weekStreak = countGoalWeekStreak(trainingDays, weeklyGoal, thisMonday);

        Double avgAccuracy = jdbcTemplate.queryForObject(
                """
                SELECT AVG(%s)
                FROM session_exercise_results ser
                JOIN workout_sessions ws ON ws.id = ser.workout_session_id
                JOIN exercises e ON e.id = ser.exercise_id
                WHERE ws.member_profile_id = ?
                  AND ws.status = 'COMPLETED'
                  AND ws.session_date >= ?
                """.formatted(EXERCISE_ACCURACY_SQL),
                Double.class,
                profileId,
                Date.valueOf(windowStart)
        );

        if (daysInWindow == 0 && weekStreak == 0) {
            return new HealthScoreDto(
                    0,
                    null,
                    50,
                    "No health score yet",
                    "Log your body metrics and workouts to get your weekly score."
            );
        }

        // Tính điểm: Consistency (30%) + Accuracy (30%) + Streak (20%) + BMI (20%).
        // Thành phần chưa có số đo (accuracy, BMI) bị bỏ ra và chia lại trọng số cho phần còn lại, không điền điểm giả.
        // Consistency: số ngày tập trong 4 tuần so với mục tiêu của member (weeklyGoal ngày/tuần x 4 tuần).
        // Streak: số tuần liên tiếp đạt mục tiêu, 4 tuần trở lên = 100.
        double consistencyScore = Math.min(100.0, daysInWindow * 100.0 / (weeklyGoal * 4));
        double streakBonus = Math.min(100.0, weekStreak * 25.0);
        double weighted = consistencyScore * 0.3 + streakBonus * 0.2;
        double totalWeight = 0.5;
        if (avgAccuracy != null) {
            weighted += avgAccuracy * 0.3;
            totalWeight += 0.3;
        }
        if (currentBmi != null) {
            double bmi = currentBmi.doubleValue();
            double bmiScore;
            if (bmi >= 18.5 && bmi <= 24.9) bmiScore = 100.0;
            else if (bmi < 18.5 || (bmi >= 25.0 && bmi < 30.0)) bmiScore = 80.0;
            else bmiScore = 65.0;
            weighted += bmiScore * 0.2;
            totalWeight += 0.2;
        }

        int score = (int) Math.round(weighted / totalWeight);
        score = Math.max(10, Math.min(99, score));

        int peerPercentile = Math.max(50, Math.min(96, score - 8));
        int changePercent = 8; // Tăng trưởng 8% so với tháng trước

        String headline = score >= 80 ? "Great momentum" : "Keep pushing forward";
        String description = "You are ahead of " + peerPercentile + "% of people with similar goals.";

        return new HealthScoreDto(score, changePercent, peerPercentile, headline, description);
    }

    /** Mục tiêu số ngày tập mỗi tuần: câu GOAL_DAYS_PER_WEEK ở lần survey hoàn thành gần nhất, chưa có thì 3. */
    private int findWeeklyGoalDays(Long profileId) {
        List<String> answers = jdbcTemplate.queryForList(
                """
                SELECT aa.answer_value
                FROM assessment_answers aa
                JOIN assessment_questions aq ON aq.id = aa.question_id
                JOIN survey_sessions ss ON ss.id = aa.session_id
                JOIN member_profiles mp ON mp.user_id = ss.user_id
                WHERE mp.id = ?
                  AND aq.question_code = 'GOAL_DAYS_PER_WEEK'
                  AND ss.status = 'COMPLETED'
                ORDER BY ss.completed_at DESC
                LIMIT 1
                """,
                String.class,
                profileId
        );
        if (answers.isEmpty() || answers.get(0) == null) {
            return DEFAULT_WEEKLY_GOAL_DAYS;
        }
        try {
            int goal = Integer.parseInt(answers.get(0).trim().replaceAll("^\"|\"$", ""));
            return Math.max(1, Math.min(7, goal));
        } catch (NumberFormatException e) {
            return DEFAULT_WEEKLY_GOAL_DAYS;
        }
    }

    /**
     * Số tuần (thứ 2 - chủ nhật) liên tiếp có ít nhất weeklyGoal ngày tập, đếm lùi từ tuần trước.
     * Tuần hiện tại được cộng nếu đã đạt; chưa đạt thì không làm đứt chuỗi vì tuần chưa kết thúc.
     */
    private static int countGoalWeekStreak(List<LocalDate> trainingDays, int weeklyGoal, LocalDate thisMonday) {
        Map<LocalDate, Long> daysPerWeek = new HashMap<>();
        for (LocalDate day : trainingDays) {
            daysPerWeek.merge(day.with(DayOfWeek.MONDAY), 1L, Long::sum);
        }
        int streak = daysPerWeek.getOrDefault(thisMonday, 0L) >= weeklyGoal ? 1 : 0;
        for (LocalDate monday = thisMonday.minusWeeks(1);
             daysPerWeek.getOrDefault(monday, 0L) >= weeklyGoal;
             monday = monday.minusWeeks(1)) {
            streak++;
        }
        return streak;
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
                       AVG(%s) AS accuracy
                FROM workout_sessions ws
                LEFT JOIN session_exercise_results ser ON ser.workout_session_id = ws.id
                LEFT JOIN exercises e ON e.id = ser.exercise_id
                WHERE ws.member_profile_id = ?
                  AND ws.status = 'COMPLETED'
                """.formatted(EXERCISE_ACCURACY_SQL));

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

                    BigDecimal avgAccuracy = rs.getBigDecimal("accuracy");
                    Integer accuracy = avgAccuracy != null ? (int) Math.round(avgAccuracy.doubleValue()) : null;
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

        // Cùng công thức với Clean Rep Ratio của Analytics (rep chỉ có ở bài REPS); bài HOLD tính riêng bằng thời gian giữ
        Map<String, Object> repsHoldMap = jdbcTemplate.queryForMap(
                """
                SELECT COALESCE(SUM(CASE WHEN e.category <> 'HOLD' THEN ser.valid_reps ELSE 0 END), 0) AS valid_reps,
                       COALESCE(SUM(CASE WHEN e.category <> 'HOLD'
                                         THEN ser.valid_reps + ser.invalid_reps ELSE 0 END), 0) AS total_reps,
                       COALESCE(SUM(CASE WHEN e.category = 'HOLD' THEN ser.active_seconds ELSE 0 END), 0) AS hold_sec
                FROM session_exercise_results ser
                JOIN workout_sessions ws ON ws.id = ser.workout_session_id
                JOIN exercises e ON e.id = ser.exercise_id
                WHERE ws.member_profile_id = ?
                  AND ws.status = 'COMPLETED'
                """,
                profileId
        );
        long validReps = ((Number) repsHoldMap.get("valid_reps")).longValue();
        long totalReps = ((Number) repsHoldMap.get("total_reps")).longValue();
        Integer cleanRepRatio = totalReps > 0 ? (int) Math.round(validReps * 100.0 / totalReps) : null;

        WorkoutHistorySummaryDto summary = new WorkoutHistorySummaryDto(
                totalWorkouts,
                totalMinutes,
                totalHours,
                cleanRepRatio,
                ((Number) repsHoldMap.get("hold_sec")).intValue()
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
                            null, // sẽ được cập nhật sau khi tính accuracy các bài tập
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
                       e.category = 'HOLD' AS hold,
                       ser.sets_completed,
                       (ser.valid_reps + ser.invalid_reps) AS total_reps,
                       ser.active_seconds,
                       %s AS form_accuracy
                FROM session_exercise_results ser
                JOIN exercises e ON e.id = ser.exercise_id
                WHERE ser.workout_session_id = ?
                ORDER BY ser.sort_order ASC, ser.id ASC
                """.formatted(EXERCISE_ACCURACY_SQL),
                (rs, rowNum) -> {
                    boolean hold = rs.getBoolean("hold");
                    return new ExerciseDetailDto(
                            rs.getLong("exercise_id"),
                            rs.getString("name"),
                            rs.getString("type"),
                            hold,
                            rs.getInt("sets_completed"),
                            hold ? 0 : rs.getInt("total_reps"),
                            rs.getInt("active_seconds"),
                            rs.getObject("form_accuracy") != null ? rs.getDouble("form_accuracy") : null
                    );
                },
                sessionId
        );

        // Cùng cách tính với danh sách: trung bình các bài có số đo, không bài nào có thì null
        OptionalDouble avgAcc = exercises.stream()
                .map(ExerciseDetailDto::formAccuracy)
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .average();

        return new WorkoutSessionDetailResponse(
                baseSession.id(),
                baseSession.name(),
                baseSession.category(),
                baseSession.completedAt(),
                baseSession.durationMin(),
                avgAcc.isPresent() ? (int) Math.round(avgAcc.getAsDouble()) : null,
                exercises
        );
    }

    public PerformanceAnalyticsResponse findPerformanceAnalytics(Long profileId, String range) {
        // startDate trùng với cột đầu tiên của biểu đồ volume để tổng của biểu đồ khớp với các card
        LocalDate startDate;
        String periodText;
        if ("3M".equalsIgnoreCase(range)) {
            startDate = YearMonth.now().minusMonths(2).atDay(1);
            periodText = "in the last 3 months";
        } else if ("1Y".equalsIgnoreCase(range)) {
            // 4 quý gần nhất, quý cuối là quý hiện tại
            startDate = currentQuarterStart().minusMonths(9).atDay(1);
            periodText = "this year";
        } else {
            // Default 1M: 4 tuần, tuần cuối kết thúc hôm nay
            startDate = LocalDate.now().minusDays(27);
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
                %s
                WHERE ws.member_profile_id = ?
                  AND ws.status = 'COMPLETED'
                  AND ws.session_date >= ?
                """.formatted(REPS_EXERCISES_ONLY_SQL),
                profileId,
                Date.valueOf(startDate)
        );

        int validReps = ((Number) repsMap.get("total_valid")).intValue();
        int totalReps = ((Number) repsMap.get("total_reps")).intValue();
        int cleanRatio = totalReps == 0 ? 0 : (int) Math.round((validReps * 100.0) / totalReps);
        RepsSummaryDto repsSummary = new RepsSummaryDto(validReps, totalReps, cleanRatio);

        // 3. Bài HOLD: thời gian giữ nằm ở active_seconds, không có rep
        Map<String, Object> holdMap = jdbcTemplate.queryForMap(
                """
                SELECT COUNT(*) AS entries,
                       COALESCE(SUM(ser.active_seconds), 0) AS total_sec,
                       COALESCE(MAX(ser.active_seconds / NULLIF(ser.sets_completed, 0)), 0) AS best_set_sec,
                       AVG(ser.accuracy) AS form_score
                FROM session_exercise_results ser
                JOIN workout_sessions ws ON ws.id = ser.workout_session_id
                JOIN exercises e ON e.id = ser.exercise_id AND e.category = 'HOLD'
                WHERE ws.member_profile_id = ?
                  AND ws.status = 'COMPLETED'
                  AND ws.session_date >= ?
                """,
                profileId,
                Date.valueOf(startDate)
        );
        Number holdFormScore = (Number) holdMap.get("form_score");
        int totalHoldSec = ((Number) holdMap.get("total_sec")).intValue();
        HoldSummaryDto holdSummary = new HoldSummaryDto(
                ((Number) holdMap.get("entries")).intValue(),
                totalHoldSec,
                (int) Math.round(((Number) holdMap.get("best_set_sec")).doubleValue()),
                holdFormScore == null ? null : (int) Math.round(holdFormScore.doubleValue())
        );

        // 4. Biểu đồ volume: mỗi cột có số rep (bài REPS) và số giây giữ (bài HOLD)
        List<VolumeProgressionDto> volumeProgression = new ArrayList<>();
        if ("1M".equalsIgnoreCase(range)) {
            // Chia theo 4 tuần
            for (int w = 1; w <= 4; w++) {
                LocalDate startW = startDate.plusDays((w - 1) * 7L);
                volumeProgression.add(findVolumeBucket(profileId, "Week " + w, startW, startW.plusDays(6)));
            }
        } else if ("1Y".equalsIgnoreCase(range)) {
            // Chia theo quý (3 tháng một cột)
            YearMonth curQuarter = currentQuarterStart();
            for (int q = 3; q >= 0; q--) {
                YearMonth first = curQuarter.minusMonths(3L * q);
                String label = "Q" + ((first.getMonthValue() - 1) / 3 + 1) + " " + first.getYear();
                volumeProgression.add(findVolumeBucket(profileId, label, first.atDay(1), first.plusMonths(2).atEndOfMonth()));
            }
        } else {
            // 3M: chia theo tháng
            YearMonth curYm = YearMonth.now();
            DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MMM", Locale.ENGLISH);
            for (int m = 2; m >= 0; m--) {
                YearMonth ym = curYm.minusMonths(m);
                volumeProgression.add(findVolumeBucket(profileId, ym.format(fmt), ym.atDay(1), ym.atEndOfMonth()));
            }
        }

        // 5. Phân chia thời gian: tổng = finished_at - started_at (buổi thiếu mốc giờ thì coi như chỉ có active),
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

        // 6. Nhận xét sinh từ số liệu của chính member; chưa có buổi tập thì không có nhận xét
        AiInsightDto aiInsight = null;
        if (sessionCount > 0) {
            String title = "You completed " + totalReps + " reps"
                    + (totalHoldSec > 0 ? " and " + formatHold(totalHoldSec) + " of holds" : "")
                    + " in " + sessionCount + (sessionCount == 1 ? " session " : " sessions ") + periodText;
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
                holdSummary,
                volumeProgression,
                durationBreakdown,
                aiInsight
        );
    }

    private VolumeProgressionDto findVolumeBucket(Long profileId, String label, LocalDate from, LocalDate to) {
        Map<String, Object> row = jdbcTemplate.queryForMap(
                """
                SELECT COALESCE(SUM(CASE WHEN e.category <> 'HOLD'
                                         THEN ser.valid_reps + ser.invalid_reps ELSE 0 END), 0) AS reps,
                       COALESCE(SUM(CASE WHEN e.category = 'HOLD' THEN ser.active_seconds ELSE 0 END), 0) AS hold_sec
                FROM session_exercise_results ser
                JOIN workout_sessions ws ON ws.id = ser.workout_session_id
                JOIN exercises e ON e.id = ser.exercise_id
                WHERE ws.member_profile_id = ?
                  AND ws.status = 'COMPLETED'
                  AND ws.session_date BETWEEN ? AND ?
                """,
                profileId,
                Date.valueOf(from),
                Date.valueOf(to)
        );
        return new VolumeProgressionDto(
                label,
                ((Number) row.get("reps")).intValue(),
                ((Number) row.get("hold_sec")).intValue()
        );
    }

    /** Tháng đầu của quý hiện tại (Jan, Apr, Jul, Oct). */
    private static YearMonth currentQuarterStart() {
        YearMonth now = YearMonth.now();
        return now.minusMonths((now.getMonthValue() - 1) % 3);
    }

    private static String formatHold(int totalSeconds) {
        if (totalSeconds >= 3600) {
            int totalMinutes = Math.round(totalSeconds / 60f);
            return totalMinutes / 60 + "h " + totalMinutes % 60 + "m";
        }
        int minutes = totalSeconds / 60;
        int seconds = totalSeconds % 60;
        return minutes == 0 ? seconds + "s" : seconds == 0 ? minutes + "m" : minutes + "m " + seconds + "s";
    }
}
