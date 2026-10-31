package com.calishealth.service;

import com.calishealth.dtos.ProgressionRuleDtos.ExerciseRef;
import com.calishealth.dtos.ProgressionRuleDtos.ExerciseResultResponse;
import com.calishealth.dtos.ProgressionRuleDtos.RuleDetail;
import com.calishealth.dtos.ProgressionRuleDtos.RuleEvaluation;
import com.calishealth.dtos.ProgressionRuleDtos.RuleList;
import com.calishealth.dtos.ProgressionRuleDtos.RuleSummary;
import com.calishealth.dtos.ProgressionRuleDtos.SaveRuleRequest;
import com.calishealth.dtos.ProgressionRuleDtos.SetResultInput;
import com.calishealth.dtos.ProgressionRuleDtos.SubmitExerciseResultRequest;
import com.calishealth.dtos.ProgressionRuleDtos.UpdateRuleRequest;
import com.calishealth.models.Exercise;
import com.calishealth.models.ProgressionRule;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.MemberSkillProgressRepository;
import com.calishealth.repository.ProgressionRuleRepository;
import com.calishealth.repository.SessionExerciseResultRepository;
import com.calishealth.repository.SessionSetResultRepository;
import com.calishealth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Progression Rules: mỗi rule là một cạnh "bài prerequisite -> bài đích". Member làm bài prerequisite và đạt
 * ngưỡng (số set, rep hoặc giây mỗi set, % clean) thì mở khóa bài đích. Client (MediaPipe) chỉ gửi số đếm
 * của từng set; % clean luôn do server tính lại.
 */
@Service
@RequiredArgsConstructor
public class ProgressionRuleService {
    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_INACTIVE = "INACTIVE";
    public static final String MEASURE_REPS = "REPS";
    public static final String MEASURE_HOLD = "HOLD";
    static final int MAX_SETS = 20;
    static final String PROGRESS_UNLOCKED = "UNLOCKED";
    static final String PROGRESS_IN_PROGRESS = "IN_PROGRESS";

    private final ProgressionRuleRepository rules;
    private final ExerciseRepository exercises;
    private final MemberSkillProgressRepository skillProgress;
    private final MemberProfileRepository memberProfiles;
    private final UserRepository users;
    private final SessionExerciseResultRepository exerciseResults;
    private final SessionSetResultRepository setResults;
    private final JdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public RuleList list() {
        List<ProgressionRule> all = rules.findAll().stream()
                .sorted(Comparator.comparing((ProgressionRule rule) -> rule.getExercise().getName(), String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(rule -> rule.getPrerequisiteExercise().getName(), String.CASE_INSENSITIVE_ORDER))
                .toList();
        long active = all.stream().filter(rule -> STATUS_ACTIVE.equals(rule.getStatus())).count();
        List<ExerciseRef> available = exercises.findAll().stream()
                .filter(ProgressionRuleService::isSelectable)
                .sorted(Comparator.comparing(Exercise::getName, String.CASE_INSENSITIVE_ORDER))
                .map(ProgressionRuleService::ref)
                .toList();
        return new RuleList(all.stream().map(ProgressionRuleService::summary).toList(),
                active, all.size() - active, available);
    }

    @Transactional(readOnly = true)
    public RuleDetail detail(Long id) {
        ProgressionRule rule = find(id);
        Long targetId = rule.getExercise().getId();
        List<ProgressionRule> all = rules.findAll();
        List<RuleSummary> sameTarget = all.stream()
                .filter(other -> !other.getId().equals(id) && other.getExercise().getId().equals(targetId))
                .map(ProgressionRuleService::summary).toList();
        List<RuleSummary> next = all.stream()
                .filter(other -> other.getPrerequisiteExercise().getId().equals(targetId))
                .map(ProgressionRuleService::summary).toList();
        return new RuleDetail(summary(rule), skillProgress.countByExercise_IdAndStatus(targetId, PROGRESS_UNLOCKED),
                sameTarget, next);
    }

    @Transactional
    public RuleDetail create(SaveRuleRequest request) {
        Exercise target = selectable(request.exerciseCode());
        Exercise prerequisite = selectable(request.prerequisiteCode());
        if (target.getId().equals(prerequisite.getId())) {
            throw bad("An exercise cannot be its own prerequisite");
        }
        if (rules.existsByExercise_IdAndPrerequisiteExercise_Id(target.getId(), prerequisite.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A rule for this pair of exercises already exists");
        }
        if (reaches(target.getId(), prerequisite.getId())) {
            throw bad(prerequisite.getName() + " already depends on " + target.getName() + "; this rule would create a loop");
        }
        ProgressionRule rule = new ProgressionRule();
        rule.setExercise(target);
        rule.setPrerequisiteExercise(prerequisite);
        rule.setRuleName(target.getName() + " progression " + prerequisite.getName());
        rule.setRelationship("PREREQUISITE");
        applyThresholds(rule, request.requiredSets(), request.requiredReps(), request.requiredSeconds(),
                request.minAccuracy(), request.status());
        return detail(rules.save(rule).getId());
    }

    @Transactional
    public RuleDetail update(Long id, UpdateRuleRequest request) {
        ProgressionRule rule = find(id);
        applyThresholds(rule, request.requiredSets(), request.requiredReps(), request.requiredSeconds(),
                request.minAccuracy(), request.status());
        rules.save(rule);
        return detail(id);
    }

    @Transactional
    public void delete(Long id) {
        rules.delete(find(id));
    }

    @Transactional
    public RuleDetail updateStatus(Long id, String status) {
        ProgressionRule rule = find(id);
        rule.setStatus(normalizeStatus(status));
        rules.save(rule);
        return detail(id);
    }

    // ---- Nhận kết quả buổi tập (số đếm thô từ client) ----

    /**
     * Lưu kết quả một bài tập của member (từng set), đánh giá mọi rule đang bật có bài này làm prerequisite
     * và mở khóa bài đích khi đạt. % clean luôn tính lại từ số đếm, không nhận % từ client.
     */
    @Transactional
    public ExerciseResultResponse submitResult(String email, SubmitExerciseResultRequest request) {
        Exercise exercise = exercises.findByCode(request.exerciseCode())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Exercise not found"));
        String measure = measureOf(exercise);
        validateSets(measure, request.sets());

        Long userId = users.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "The signed-in user no longer exists")).getId();
        var profile = memberProfiles.findByUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Member profile not found"));

        int totalReps = request.sets().stream().mapToInt(SetResultInput::totalReps).sum();
        int cleanReps = request.sets().stream().mapToInt(SetResultInput::cleanReps).sum();
        int totalSeconds = request.sets().stream().mapToInt(SetResultInput::totalSeconds).sum();
        int cleanSeconds = request.sets().stream().mapToInt(SetResultInput::cleanSeconds).sum();
        BigDecimal cleanRate = rate(measure, request.sets());

        LocalDateTime finishedAt = LocalDateTime.now();
        Long sessionId = insertSession(profile.getId(), exercise.getName(), finishedAt.minusSeconds(totalSeconds),
                finishedAt, totalSeconds, totalReps);

        var result = new com.calishealth.models.SessionExerciseResult();
        result.setWorkoutSessionId(sessionId);
        result.setExercise(exercise);
        result.setSetsCompleted(request.sets().size());
        result.setValidReps(cleanReps);
        result.setInvalidReps(totalReps - cleanReps);
        result.setAccuracy(cleanRate);
        result.setActiveSeconds(totalSeconds);
        result.setCleanSeconds(cleanSeconds);
        result = exerciseResults.save(result);
        for (int index = 0; index < request.sets().size(); index++) {
            SetResultInput input = request.sets().get(index);
            var set = new com.calishealth.models.SessionSetResult();
            set.setSessionExerciseResult(result);
            set.setSetNumber(index + 1);
            set.setTotalReps(input.totalReps());
            set.setCleanReps(input.cleanReps());
            set.setTotalSeconds(input.totalSeconds());
            set.setCleanSeconds(input.cleanSeconds());
            setResults.save(set);
        }

        recordBest(profile, exercise, request.sets(), cleanRate);

        List<RuleEvaluation> evaluations = new ArrayList<>();
        List<ExerciseRef> newlyUnlocked = new ArrayList<>();
        for (ProgressionRule rule : rules.findAllByPrerequisiteExercise_IdAndStatus(exercise.getId(), STATUS_ACTIVE)) {
            Outcome outcome = evaluate(rule.getMeasureType(), rule.getRequiredSets(), rule.getRequiredReps(),
                    rule.getRequiredSeconds(), rule.getMinAccuracy(), request.sets());
            evaluations.add(new RuleEvaluation(rule.getId(), ref(rule.getExercise()), outcome.passed(),
                    outcome.qualifyingSets(), rule.getRequiredSets(), outcome.cleanRate(), rule.getMinAccuracy(),
                    outcome.message()));
            if (outcome.passed() && unlock(profile, rule.getExercise())) {
                newlyUnlocked.add(ref(rule.getExercise()));
            }
        }
        return new ExerciseResultResponse(sessionId, ref(exercise), cleanRate, evaluations, newlyUnlocked);
    }

    private Long insertSession(Long profileId, String name, LocalDateTime startedAt, LocalDateTime finishedAt,
                               int activeSeconds, int totalReps) {
        KeyHolder keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement(
                    "INSERT INTO workout_sessions (member_profile_id, workout_name, session_date, status, started_at, "
                            + "finished_at, active_seconds, total_reps) VALUES (?, ?, ?, 'COMPLETED', ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1, profileId);
            statement.setString(2, name);
            statement.setObject(3, LocalDate.from(finishedAt));
            statement.setTimestamp(4, Timestamp.valueOf(startedAt));
            statement.setTimestamp(5, Timestamp.valueOf(finishedAt));
            statement.setInt(6, activeSeconds);
            statement.setInt(7, totalReps);
            return statement;
        }, keys);
        return keys.getKey().longValue();
    }

    private void recordBest(com.calishealth.models.MemberProfile profile, Exercise exercise, List<SetResultInput> sets,
                            BigDecimal cleanRate) {
        var progress = skillProgress.findByMemberProfile_IdAndExercise_Id(profile.getId(), exercise.getId())
                .orElseGet(() -> {
                    var created = new com.calishealth.models.MemberSkillProgress();
                    created.setMemberProfile(profile);
                    created.setExercise(exercise);
                    return created;
                });
        if (progress.getStatus() == null) progress.setStatus(PROGRESS_IN_PROGRESS);
        int bestSet = sets.stream().mapToInt(SetResultInput::cleanReps).max().orElse(0);
        if (progress.getBestReps() == null || bestSet > progress.getBestReps()) progress.setBestReps(bestSet);
        if (cleanRate != null && (progress.getBestAccuracy() == null || cleanRate.compareTo(progress.getBestAccuracy()) > 0)) {
            progress.setBestAccuracy(cleanRate);
        }
        skillProgress.save(progress);
    }

    /** True khi bài này vừa được mở khóa lần đầu. */
    private boolean unlock(com.calishealth.models.MemberProfile profile, Exercise target) {
        var progress = skillProgress.findByMemberProfile_IdAndExercise_Id(profile.getId(), target.getId())
                .orElseGet(() -> {
                    var created = new com.calishealth.models.MemberSkillProgress();
                    created.setMemberProfile(profile);
                    created.setExercise(target);
                    return created;
                });
        if (PROGRESS_UNLOCKED.equals(progress.getStatus())) return false;
        progress.setStatus(PROGRESS_UNLOCKED);
        progress.setUnlockedAt(LocalDateTime.now());
        skillProgress.save(progress);
        return true;
    }

    // ---- Logic chấm (thuần, có test) ----

    record Outcome(boolean passed, int qualifyingSets, BigDecimal cleanRate, String message) {}

    /**
     * Một set đạt khi có đủ rep sạch (REPS) hoặc đủ giây (HOLD). Rule đạt khi có đủ số set đạt và % clean của cả
     * bài (tổng rep sạch / tổng rep, hoặc tổng giây đúng form / tổng giây) không thấp hơn ngưỡng.
     */
    static Outcome evaluate(String measureType, int requiredSets, Integer requiredReps, Integer requiredSeconds,
                            BigDecimal minAccuracy, List<SetResultInput> sets) {
        boolean hold = MEASURE_HOLD.equals(measureType);
        int need = hold ? (requiredSeconds == null ? 0 : requiredSeconds) : (requiredReps == null ? 0 : requiredReps);
        int qualifying = (int) sets.stream()
                .filter(set -> hold ? set.totalSeconds() >= need : set.cleanReps() >= need)
                .count();
        BigDecimal cleanRate = rate(measureType, sets);
        if (cleanRate == null) {
            return new Outcome(false, qualifying, null, "Not enough samples to judge the form.");
        }
        boolean enoughSets = qualifying >= requiredSets;
        boolean cleanEnough = minAccuracy == null || cleanRate.compareTo(minAccuracy) >= 0;
        String unit = hold ? "s" : " clean reps";
        String message;
        if (enoughSets && cleanEnough) {
            message = "Passed: " + qualifying + "/" + requiredSets + " sets reached " + need + unit
                    + ", clean " + cleanRate.setScale(1, RoundingMode.HALF_UP) + "%.";
        } else if (!enoughSets) {
            message = "Only " + qualifying + " of " + requiredSets + " sets reached " + need + unit + ".";
        } else {
            message = "Clean " + cleanRate.setScale(1, RoundingMode.HALF_UP) + "% is below the required "
                    + minAccuracy.setScale(1, RoundingMode.HALF_UP) + "%.";
        }
        return new Outcome(enoughSets && cleanEnough, qualifying, cleanRate, message);
    }

    /** % clean (0-100) của cả bài, hoặc null khi không có mẫu. */
    static BigDecimal rate(String measureType, List<SetResultInput> sets) {
        boolean hold = MEASURE_HOLD.equals(measureType);
        long total = sets.stream().mapToLong(set -> hold ? set.totalSeconds() : set.totalReps()).sum();
        if (total <= 0) return null;
        long clean = sets.stream().mapToLong(set -> hold ? set.cleanSeconds() : set.cleanReps()).sum();
        return BigDecimal.valueOf(clean).multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(total), 3, RoundingMode.HALF_UP);
    }

    private static void validateSets(String measure, List<SetResultInput> sets) {
        for (SetResultInput set : sets) {
            if (set.cleanReps() > set.totalReps()) throw bad("Clean reps cannot exceed total reps in a set");
            if (set.cleanSeconds() > set.totalSeconds()) throw bad("Clean seconds cannot exceed total seconds in a set");
        }
        if (rate(measure, sets) == null) {
            throw bad(MEASURE_HOLD.equals(measure) ? "No hold time was recorded" : "No reps were recorded");
        }
    }

    // ---- Quy tắc cấu hình ----

    private void applyThresholds(ProgressionRule rule, int sets, Integer reps, Integer seconds, BigDecimal accuracy, String status) {
        String measure = measureOf(rule.getPrerequisiteExercise());
        if (sets < 1 || sets > MAX_SETS) throw bad("Required sets must be between 1 and " + MAX_SETS);
        if (accuracy == null || accuracy.compareTo(BigDecimal.ONE) < 0 || accuracy.compareTo(BigDecimal.valueOf(100)) > 0) {
            throw bad("Minimum clean rate must be between 1 and 100 percent");
        }
        if (MEASURE_HOLD.equals(measure)) {
            if (seconds == null || seconds < 1 || seconds > 3600) throw bad("Required seconds per set must be between 1 and 3600");
            rule.setRequiredSeconds(seconds);
            rule.setRequiredReps(null);
        } else {
            if (reps == null || reps < 1 || reps > 500) throw bad("Required reps per set must be between 1 and 500");
            rule.setRequiredReps(reps);
            rule.setRequiredSeconds(null);
        }
        rule.setMeasureType(measure);
        rule.setRequiredSets(sets);
        rule.setMinAccuracy(accuracy.setScale(3, RoundingMode.HALF_UP));
        rule.setStatus(normalizeStatus(status));
    }

    private static String normalizeStatus(String status) {
        if (status == null || status.isBlank()) return STATUS_ACTIVE;
        String value = status.trim().toUpperCase();
        if (!STATUS_ACTIVE.equals(value) && !STATUS_INACTIVE.equals(value)) throw bad("Status must be ACTIVE or INACTIVE");
        return value;
    }

    /** True khi từ {@code startId} đi theo các cạnh "mở khóa" tới được {@code goalId}. */
    private boolean reaches(Long startId, Long goalId) {
        List<ProgressionRule> all = rules.findAll();
        Set<Long> seen = new HashSet<>();
        Deque<Long> queue = new ArrayDeque<>(List.of(startId));
        while (!queue.isEmpty()) {
            Long current = queue.poll();
            if (!seen.add(current)) continue;
            for (ProgressionRule rule : all) {
                if (rule.getPrerequisiteExercise().getId().equals(current)) {
                    if (rule.getExercise().getId().equals(goalId)) return true;
                    queue.add(rule.getExercise().getId());
                }
            }
        }
        return false;
    }

    private ProgressionRule find(Long id) {
        return rules.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Progression rule not found"));
    }

    private Exercise selectable(String code) {
        Exercise exercise = exercises.findByCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Exercise " + code + " not found"));
        if (!isSelectable(exercise)) throw bad(exercise.getName() + " is not an active system exercise");
        return exercise;
    }

    /** Chỉ bài hệ thống đang hoạt động mới nằm trong chuỗi thăng tiến. */
    private static boolean isSelectable(Exercise exercise) {
        if (!exercise.isActive()) return false;
        if (exercise.getModerationStatus() != null && !STATUS_ACTIVE.equalsIgnoreCase(exercise.getModerationStatus().trim())) return false;
        String source = exercise.getSource();
        if (source != null && !source.isBlank()) return ExerciseService.SOURCE_SYSTEM.equalsIgnoreCase(source.trim());
        return exercise.getCreatedBy() == null;
    }

    private static String measureOf(Exercise exercise) {
        return "HOLD".equalsIgnoreCase(exercise.getCategory()) ? MEASURE_HOLD : MEASURE_REPS;
    }

    private static ExerciseRef ref(Exercise exercise) {
        return new ExerciseRef(exercise.getCode(), exercise.getName(), exercise.getType(), measureOf(exercise));
    }

    private static RuleSummary summary(ProgressionRule rule) {
        return new RuleSummary(rule.getId(), rule.getRuleName(), rule.getStatus(), rule.getMeasureType(),
                rule.getRequiredSets(), rule.getRequiredReps(), rule.getRequiredSeconds(), rule.getMinAccuracy(),
                ref(rule.getExercise()), ref(rule.getPrerequisiteExercise()), rule.getUpdatedAt());
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
