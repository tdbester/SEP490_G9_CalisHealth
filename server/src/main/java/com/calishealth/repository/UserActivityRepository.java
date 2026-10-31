package com.calishealth.repository;

import com.calishealth.dtos.AdminUserDtos.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Reads behind the admin "User Detail & Activity Log" screen and writes to the two log tables of V19.
 * Everything a member did (workouts, skills, assessments, body metrics) is read from the tables that
 * already store it; only sign-ins and admin actions are logged here.
 */
@Slf4j
@Repository
@RequiredArgsConstructor
public class UserActivityRepository {
    static final String MIDDLE_DOT = "\u00b7";

    private final JdbcTemplate jdbc;

    // ---------------------------------------------------------------------------------
    // Writes. A failed log write must never break the action being logged.
    // ---------------------------------------------------------------------------------

    public void logEvent(Long userId, String eventType, String description, String status) {
        if (userId == null) return;
        try {
            jdbc.update("INSERT INTO user_activity_logs (user_id, event_type, description, status) VALUES (?, ?, ?, ?)",
                    userId, eventType, truncate(description, 500), status);
        } catch (DataAccessException e) {
            log.warn("Could not write activity log for user {}: {}", userId, e.getMessage());
        }
    }

    public void logAdminAction(Long adminId, Long targetUserId, AdminActionType action) {
        if (adminId == null || targetUserId == null) return;
        try {
            jdbc.update("INSERT INTO admin_action_logs (admin_id, target_user_id, action) VALUES (?, ?, ?)",
                    adminId, targetUserId, action.name());
        } catch (DataAccessException e) {
            log.warn("Could not write admin action log for admin {}: {}", adminId, e.getMessage());
        }
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    // ---------------------------------------------------------------------------------
    // Profile and statistics
    // ---------------------------------------------------------------------------------

    /** Latest of: last successful sign-in, last workout session. Null when neither exists. */
    public LocalDateTime findLastActiveAt(Long userId) {
        Timestamp login = jdbc.queryForObject(
                "SELECT MAX(created_at) FROM user_activity_logs WHERE user_id = ? AND event_type = 'LOGIN' AND status = 'SUCCESS'",
                Timestamp.class, userId);
        Timestamp workout = jdbc.queryForObject("""
                SELECT MAX(ws.started_at) FROM workout_sessions ws
                JOIN member_profiles mp ON mp.id = ws.member_profile_id
                WHERE mp.user_id = ?
                """, Timestamp.class, userId);
        Timestamp latest = login == null ? workout : workout == null ? login : login.after(workout) ? login : workout;
        return latest == null ? null : latest.toLocalDateTime();
    }

    public List<String> findLevelNames() {
        return jdbc.queryForList("SELECT name FROM fitness_levels ORDER BY score_min, id", String.class);
    }

    public Optional<MemberInfo> findMemberInfo(Long userId) {
        List<String> levels = findLevelNames();
        List<MemberInfo> rows = jdbc.query("""
                SELECT mp.gender, mp.date_of_birth, mp.goals, mp.height, mp.weight,
                       mp.streak_count, mp.longest_streak, fl.name AS level_name,
                       (SELECT COUNT(*) FROM workout_sessions ws
                         WHERE ws.member_profile_id = mp.id AND ws.status = 'COMPLETED') AS total_workouts
                FROM member_profiles mp
                LEFT JOIN fitness_levels fl ON fl.id = mp.fitness_level_id
                WHERE mp.user_id = ?
                """, (rs, i) -> {
            Date dob = rs.getDate("date_of_birth");
            String level = rs.getString("level_name");
            int idx = level == null ? -1 : levels.indexOf(level);
            return new MemberInfo(
                    dob == null ? null : java.time.Period.between(dob.toLocalDate(), LocalDate.now()).getYears(),
                    rs.getString("gender"), rs.getString("goals"),
                    rs.getBigDecimal("height"), rs.getBigDecimal("weight"),
                    level, idx < 0 ? null : idx + 1,
                    rs.getLong("total_workouts"), rs.getInt("streak_count"), rs.getInt("longest_streak"), levels);
        }, userId);
        return rows.stream().findFirst();
    }

    public ContentInfo findContentInfo(Long userId) {
        Map<String, Object> row = jdbc.queryForMap("""
                SELECT (SELECT COUNT(*) FROM exercises WHERE created_by = ? AND type <> 'SKILL') AS exercises,
                       (SELECT COUNT(*) FROM exercises WHERE created_by = ? AND type = 'SKILL') AS skills,
                       (SELECT COUNT(*) FROM workout_entries WHERE created_by = ?) AS workouts
                """, userId, userId, userId);
        // Moderation decisions do not record who made them, so "reviewed" cannot be attributed to one manager.
        return new ContentInfo(num(row, "exercises"), num(row, "skills"), num(row, "workouts"), null);
    }

    public AdminInfo findAdminInfo(Long adminId) {
        Map<String, Object> row = jdbc.queryForMap("""
                SELECT (SELECT COUNT(*) FROM admin_action_logs WHERE admin_id = ? AND action = 'CREATE_ACCOUNT') AS created,
                       (SELECT COUNT(*) FROM admin_action_logs WHERE admin_id = ? AND action = 'DEACTIVATE') AS deactivated,
                       (SELECT COUNT(*) FROM admin_action_logs WHERE admin_id = ? AND action = 'ACTIVATE') AS activated,
                       (SELECT COUNT(*) FROM user_activity_logs WHERE user_id = ? AND event_type = 'NOTIFICATION') AS notifications,
                       (SELECT COUNT(*) FROM user_activity_logs WHERE user_id = ? AND event_type = 'MAINTENANCE') AS maintenance,
                       (SELECT COUNT(*) FROM user_activity_logs WHERE user_id = ? AND event_type = 'STORAGE') AS storage
                """, adminId, adminId, adminId, adminId, adminId, adminId);
        return new AdminInfo(num(row, "created"), num(row, "deactivated"), num(row, "activated"),
                num(row, "notifications"), num(row, "maintenance"), num(row, "storage"));
    }

    private static long num(Map<String, Object> row, String key) {
        Object v = row.get(key);
        return v == null ? 0 : ((Number) v).longValue();
    }

    // ---------------------------------------------------------------------------------
    // Paged activity tables
    // ---------------------------------------------------------------------------------

    private static final String WORKOUT_ACTIVITY_SQL = """
            SELECT 'WORKOUT' AS kind, ws.started_at AS occurred_at,
                   COALESCE(ws.workout_name, 'Custom Workout') AS name, w.level AS level, ws.status AS status,
                   COALESCE(done.cnt, 0) AS n1,
                   COALESCE(planned.cnt, done.cnt, 0) AS n2,
                   0 AS hold
            FROM workout_sessions ws
            JOIN member_profiles mp ON mp.id = ws.member_profile_id AND mp.user_id = ?
            LEFT JOIN workout_entries w ON w.id = ws.workout_id
            LEFT JOIN (SELECT workout_session_id, COUNT(*) AS cnt FROM session_exercise_results
                       WHERE sets_completed > 0 GROUP BY workout_session_id) done ON done.workout_session_id = ws.id
            LEFT JOIN (SELECT workout_id, COUNT(*) AS cnt FROM workout_exercises GROUP BY workout_id) planned
                   ON planned.workout_id = ws.workout_id
            UNION ALL
            SELECT 'EXERCISE', ws.started_at, e.name, e.difficulty_level, ws.status,
                   ser.sets_completed,
                   CASE WHEN e.category = 'HOLD' THEN ser.active_seconds ELSE ser.valid_reps + ser.invalid_reps END,
                   CASE WHEN e.category = 'HOLD' THEN 1 ELSE 0 END
            FROM session_exercise_results ser
            JOIN workout_sessions ws ON ws.id = ser.workout_session_id
            JOIN member_profiles mp ON mp.id = ws.member_profile_id AND mp.user_id = ?
            JOIN exercises e ON e.id = ser.exercise_id
            """;

    public ActivityPage<WorkoutActivityItem> findWorkoutActivity(
            Long userId, String q, ActivityKind kind, String level, ActivityStatus status,
            LocalDate date, int page, int size) {
        Where w = new Where();
        if (q != null && !q.isBlank()) w.add("LOWER(a.name) LIKE ? ESCAPE '\\\\'", like(q));
        if (kind != null) w.add("a.kind = ?", kind.name());
        if (level != null && !level.isBlank()) w.add("LOWER(a.level) = ?", level.trim().toLowerCase());
        if (status != null) w.add("a.status = ?", rawSessionStatus(status));
        if (date != null) w.add("DATE(a.occurred_at) = ?", Date.valueOf(date));
        return page(WORKOUT_ACTIVITY_SQL, List.of(userId, userId), w,
                "a.occurred_at DESC, a.kind ASC, a.name ASC", page, size, (rs, i) -> {
                    boolean workout = "WORKOUT".equals(rs.getString("kind"));
                    int n1 = rs.getInt("n1");
                    int n2 = rs.getInt("n2");
                    String detail = workout
                            ? n1 + " / " + n2 + " exercises"
                            : n1 + " sets " + MIDDLE_DOT + " " + n2 + (rs.getBoolean("hold") ? " sec" : " reps");
                    return new WorkoutActivityItem(
                            workout ? ActivityKind.WORKOUT : ActivityKind.EXERCISE,
                            rs.getTimestamp("occurred_at").toLocalDateTime(),
                            rs.getString("name"), detail, rs.getString("level"),
                            displaySessionStatus(rs.getString("status")));
                });
    }

    private static String rawSessionStatus(ActivityStatus s) {
        return s == ActivityStatus.CANCELLED ? "ABANDONED" : s.name();
    }

    private static ActivityStatus displaySessionStatus(String raw) {
        return switch (raw) {
            case "COMPLETED" -> ActivityStatus.COMPLETED;
            case "ABANDONED" -> ActivityStatus.CANCELLED;
            default -> ActivityStatus.IN_PROGRESS;
        };
    }

    private static final String SYSTEM_LOG_SQL = """
            SELECT msp.unlocked_at AS occurred_at, 'SKILL' AS event_type,
                   CONCAT('Unlocked skill "', e.name, '" (best ', COALESCE(msp.best_reps, 0), ' reps)') AS description,
                   'SUCCESS' AS status
            FROM member_skill_progress msp
            JOIN member_profiles mp ON mp.id = msp.member_profile_id AND mp.user_id = ?
            JOIN exercises e ON e.id = msp.exercise_id
            WHERE msp.unlocked_at IS NOT NULL
            UNION ALL
            SELECT slr.evaluated_at, 'LEVEL_CHANGE', CONCAT('Fitness level set to ', fl.name), 'SUCCESS'
            FROM survey_level_results slr
            JOIN survey_sessions ss ON ss.id = slr.session_id AND ss.user_id = ?
            JOIN fitness_levels fl ON fl.id = slr.fitness_level_id
            UNION ALL
            SELECT ss.completed_at, 'ASSESSMENT',
                   CONCAT('Completed Level Assessment survey (version ', ss.survey_version, ')'), 'SUCCESS'
            FROM survey_sessions ss
            WHERE ss.user_id = ? AND ss.status = 'COMPLETED' AND ss.completed_at IS NOT NULL
            UNION ALL
            SELECT mbm.recorded_at, 'ACCOUNT',
                   CONCAT('Body metrics recorded: ', mbm.weight_kg, ' kg, ', mbm.height_cm, ' cm'), 'INFO'
            FROM member_body_metrics mbm
            JOIN member_profiles mp ON mp.id = mbm.member_profile_id AND mp.user_id = ?
            UNION ALL
            SELECT ual.created_at, ual.event_type, ual.description, ual.status
            FROM user_activity_logs ual
            WHERE ual.user_id = ?
            """;

    public ActivityPage<SystemLogItem> findSystemLogs(Long userId, LogEventType type, LocalDate date, int page, int size) {
        Where w = new Where();
        if (type != null) w.add("a.event_type = ?", type.name());
        if (date != null) w.add("DATE(a.occurred_at) = ?", Date.valueOf(date));
        return page(SYSTEM_LOG_SQL, List.of(userId, userId, userId, userId, userId), w,
                "a.occurred_at DESC, a.event_type ASC", page, size,
                (rs, i) -> new SystemLogItem(
                        rs.getTimestamp("occurred_at").toLocalDateTime(),
                        LogEventType.valueOf(rs.getString("event_type")),
                        rs.getString("description"), rs.getString("status")));
    }

    private static final String ADMIN_ACTION_SQL = """
            SELECT aal.created_at AS occurred_at, aal.action AS action, aal.status AS status,
                   t.full_name AS target_name, t.id AS target_id, t.role AS target_role
            FROM admin_action_logs aal
            JOIN users t ON t.id = aal.target_user_id
            WHERE aal.admin_id = ?
            """;

    public ActivityPage<AdminActionItem> findAdminActions(Long adminId, AdminActionType action, LocalDate date,
                                                          int page, int size) {
        Where w = new Where();
        if (action != null) w.add("a.action = ?", action.name());
        if (date != null) w.add("DATE(a.occurred_at) = ?", Date.valueOf(date));
        return page(ADMIN_ACTION_SQL, List.of(adminId), w, "a.occurred_at DESC, a.target_id DESC", page, size,
                (rs, i) -> new AdminActionItem(
                        rs.getTimestamp("occurred_at").toLocalDateTime(),
                        AdminActionType.valueOf(rs.getString("action")), rs.getString("status"),
                        rs.getString("target_name"), userCode(rs.getLong("target_id")), rs.getString("target_role")));
    }

    private static final String CONTENT_ACTIVITY_SQL = """
            SELECT e.updated_at AS occurred_at,
                   CASE WHEN e.type = 'SKILL' THEN 'SKILL' ELSE 'EXERCISE' END AS item_type,
                   e.name AS name, e.code AS code, e.active AS active
            FROM exercises e
            WHERE e.created_by = ?
            UNION ALL
            SELECT w.updated_at, 'WORKOUT', w.name, w.code, w.active
            FROM workout_entries w
            WHERE w.created_by = ?
            """;

    public ActivityPage<ContentActivityItem> findContentActivity(Long userId, ContentItemType type,
                                                                 ContentActionType action, int page, int size) {
        Where w = new Where();
        if (type != null) w.add("a.item_type = ?", type.name());
        if (action != null) w.add("a.active = ?", action == ContentActionType.UPDATED ? 1 : 0);
        return page(CONTENT_ACTIVITY_SQL, List.of(userId, userId), w, "a.occurred_at DESC, a.code ASC", page, size,
                (rs, i) -> {
                    boolean active = rs.getBoolean("active");
                    return new ContentActivityItem(
                            rs.getTimestamp("occurred_at").toLocalDateTime(),
                            ContentItemType.valueOf(rs.getString("item_type")),
                            rs.getString("name"), rs.getString("code"),
                            active ? ContentActionType.UPDATED : ContentActionType.DEACTIVATED,
                            active ? "Active" : "Inactive");
                });
    }

    public static String userCode(Long id) {
        return String.format("USR-%05d", id);
    }

    // ---------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------

    private static String like(String q) {
        String term = q.trim().toLowerCase().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + term + "%";
    }

    /** AND-joined filters over the derived table aliased as "a". */
    private static final class Where {
        private final List<String> clauses = new ArrayList<>();
        private final List<Object> params = new ArrayList<>();

        void add(String clause, Object param) {
            clauses.add(clause);
            params.add(param);
        }

        String sql() {
            return clauses.isEmpty() ? "" : " WHERE " + String.join(" AND ", clauses);
        }
    }

    private <T> ActivityPage<T> page(String baseSql, List<Object> baseParams, Where where, String orderBy,
                                     int page, int size, RowMapper<T> mapper) {
        List<Object> countParams = new ArrayList<>(baseParams);
        countParams.addAll(where.params);
        Long total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM (" + baseSql + ") a" + where.sql(), Long.class, countParams.toArray());
        long totalElements = total == null ? 0 : total;

        List<Object> rowParams = new ArrayList<>(countParams);
        rowParams.add(size);
        rowParams.add((long) page * size);
        List<T> items = jdbc.query(
                "SELECT * FROM (" + baseSql + ") a" + where.sql() + " ORDER BY " + orderBy + " LIMIT ? OFFSET ?",
                mapper, rowParams.toArray());
        int totalPages = (int) Math.ceil(totalElements / (double) size);
        return new ActivityPage<>(items, page, size, totalElements, totalPages);
    }
}
