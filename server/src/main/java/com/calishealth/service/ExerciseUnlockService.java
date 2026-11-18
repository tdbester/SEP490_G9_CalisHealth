package com.calishealth.service;

import com.calishealth.models.Exercise;
import com.calishealth.models.MemberProfile;
import com.calishealth.models.MemberSkillProgress;
import com.calishealth.models.ProgressionRule;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.MemberSkillProgressRepository;
import com.calishealth.repository.ProgressionRuleRepository;
import com.calishealth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.Set;

/**
 * Trạng thái mở khoá của bài tập trong Exercise Tree, theo góc nhìn của từng member.
 *
 * <p>Nguồn sự thật là đồ thị {@code progression_rules} (cạnh "bài A là tiền kiện của bài B")
 * kết hợp với tiến độ thực tế của member trong {@code member_skill_progress}.
 * Trạng thái mỗi bài gồm 3 giá trị:
 * <ul>
 *   <li>{@code MASTERED} — member đã chinh phục bài này (dòng tiến độ {@code UNLOCKED}).</li>
 *   <li>{@code CURRENT} — bài đang mở: mọi bài tiền kiện đều đã MASTERED, hoặc bài gốc
 *       của cây (không có tiền kiện nào) nên luôn mở.</li>
 *   <li>{@code LOCKED} — còn bài tiền kiện chưa chinh phục.</li>
 * </ul>
 *
 * <p>Lớp này là nguồn duy nhất cho quy tắc "member chỉ được tập bài đã mở khoá":
 * {@link ExerciseTreeService} dùng nó để dựng cây, còn luồng tập
 * ({@link ProgressionRuleService#submitResult}) dùng nó để chặn bài đang khoá.
 * Tách riêng để hai nơi luôn dùng cùng một định nghĩa — trước đây trạng thái chỉ
 * nằm rải rác trong {@code ExerciseTreeService} nên không nơi nào khác tra cứu được.</p>
 */
@Service
@RequiredArgsConstructor
public class ExerciseUnlockService {
    public static final String STATE_MASTERED = "MASTERED";
    public static final String STATE_CURRENT = "CURRENT";
    public static final String STATE_LOCKED = "LOCKED";

    private final ProgressionRuleRepository progressionRules;
    private final MemberSkillProgressRepository skillProgress;
    private final MemberProfileRepository memberProfiles;
    private final UserRepository users;

    /**
     * Trạng thái mở khoá của mọi bài trong cây, theo member.
     *
     * @param memberId id user của member
     * @return map exerciseId -> trạng thái (MASTERED / CURRENT / LOCKED)
     */
    @Transactional(readOnly = true)
    public Map<Long, String> statesByExercise(Long memberId) {
        List<ProgressionRule> allRules = progressionRules.findAllByOrderByIdAsc();
        Map<Long, Exercise> exercises = new LinkedHashMap<>();
        Map<Long, Set<Long>> prerequisites = new HashMap<>();
        Map<Long, Set<Long>> activePrerequisites = new HashMap<>();
        for (ProgressionRule rule : allRules) {
            Exercise exercise = rule.getExercise();
            Exercise prerequisite = rule.getPrerequisiteExercise();
            exercises.putIfAbsent(prerequisite.getId(), prerequisite);
            exercises.putIfAbsent(exercise.getId(), exercise);
            prerequisites.computeIfAbsent(exercise.getId(), ignored -> new HashSet<>()).add(prerequisite.getId());
            if (ProgressionRuleService.STATUS_ACTIVE.equals(rule.getStatus())) {
                activePrerequisites.computeIfAbsent(exercise.getId(), ignored -> new HashSet<>()).add(prerequisite.getId());
            }
        }
        if (exercises.isEmpty()) {
            return Map.of();
        }
        Set<Long> exerciseIds = exercises.keySet();
        Map<Long, String> storedStates = loadSkillStates(memberId, exerciseIds);
        return resolveStates(exercises, prerequisites, activePrerequisites, storedStates);
    }

    /**
     * Bài này có đang bị khoá với member này không.
     *
     * <p>Bài KHÔNG nằm trong cây progression (không có rule nào liên quan) thì coi như
     * luôn tập được — không có gì để mở khoá. Cùng bạn custom của member cũng vậy:
     * member tự tạo thì tự tập được.</p>
     *
     * @param exerciseId id bài tập
     * @param memberId   id user của member
     * @return true khi bài đang LOCKED
     */
    @Transactional(readOnly = true)
    public boolean isLocked(Long exerciseId, Long memberId) {
        if (exerciseId == null || memberId == null) {
            return false;
        }
        Map<Long, String> states = statesByExercise(memberId);
        String state = states.get(exerciseId);
        // Không có trong cay -> khong co gi de mo khoa -> duoc tap.
        return STATE_LOCKED.equals(state);
    }

    /**
     * Bài nào trong danh sách đang bị khoá với member này.
     *
     * @param exerciseIds các id bài cần kiểm tra
     * @param memberId    id user của member
     * @return tập id của các bài đang LOCKED (không theo thứ tự đầu vào)
     */
    @Transactional(readOnly = true)
    public Set<Long> lockedExerciseIds(Collection<Long> exerciseIds, Long memberId) {
        if (exerciseIds == null || exerciseIds.isEmpty() || memberId == null) {
            return Set.of();
        }
        Map<Long, String> states = statesByExercise(memberId);
        return exerciseIds.stream()
                .filter(id -> STATE_LOCKED.equals(states.get(id)))
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    /**
     * Chặn buổi tập bài đang khoá.
     *
     * @throws ResponseStatusException 403 khi bài đang LOCKED
     */
    @Transactional(readOnly = true)
    public void requireUnlocked(Long exerciseId, Long memberId) {
        if (!isLocked(exerciseId, memberId)) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "This exercise is still locked. Complete its prerequisites in the Exercise Tree first.");
    }

    /**
     * Đọc trạng thái tiến độ của member trên các bài trong cây.
     *
     * <p>Nguồn sự thật là {@code member_skill_progress}: {@code UNLOCKED} = đã chinh phục,
     * còn lại ({@code IN_PROGRESS} / chưa có dòng) = đang tập.</p>
     */
    private Map<Long, String> loadSkillStates(Long memberId, Set<Long> exerciseIds) {
        if (memberId == null) {
            return Map.of();
        }
        MemberProfile profile = memberProfiles.findByUserId(memberId).orElse(null);
        if (profile == null) {
            return Map.of();
        }
        Map<Long, String> states = new HashMap<>();
        for (MemberSkillProgress row : skillProgress.findAllByMemberProfile_IdAndExercise_IdIn(
                profile.getId(), exerciseIds)) {
            Long exerciseId = row.getExercise() == null ? null : row.getExercise().getId();
            if (exerciseId == null) {
                continue;
            }
            String status = row.getStatus();
            states.put(exerciseId, ProgressionRuleService.PROGRESS_UNLOCKED.equals(status)
                    ? STATE_MASTERED
                    : STATE_CURRENT);
        }
        return states;
    }

    /**
     * Lan trạng thái từ các bài gốc xuống (duyệt theo thứ tự ưu tiên độ khó).
     *
     * <p>Một bài là CURRENT khi mọi bài tiền kiện ACTIVE của nó đã MASTERED; bài gốc
     * (không có tiền kiện) luôn là CURRENT nên member mới không bị chặn ở bước đầu.</p>
     */
    private Map<Long, String> resolveStates(
            Map<Long, Exercise> exercises,
            Map<Long, Set<Long>> prerequisites,
            Map<Long, Set<Long>> activePrerequisites,
            Map<Long, String> storedStates
    ) {
        Comparator<Long> byDifficulty = Comparator.comparingLong(Long::longValue);
        Map<Long, Integer> remainingPrerequisites = new HashMap<>();
        Map<Long, List<Long>> nextExercises = new HashMap<>();
        exercises.keySet().forEach(id -> remainingPrerequisites.put(id, 0));
        activePrerequisites.forEach((exerciseId, prerequisiteIds) -> {
            remainingPrerequisites.put(exerciseId, prerequisiteIds.size());
            prerequisiteIds.forEach(prerequisiteId ->
                    nextExercises.computeIfAbsent(prerequisiteId, ignored -> new ArrayList<>()).add(exerciseId));
        });

        PriorityQueue<Long> ready = new PriorityQueue<>(byDifficulty);
        remainingPrerequisites.forEach((id, count) -> {
            if (count == 0) ready.add(id);
        });

        Map<Long, String> states = new HashMap<>();
        while (!ready.isEmpty()) {
            Long id = ready.remove();
            String savedState = storedStates.get(id);
            if (STATE_MASTERED.equals(savedState)) {
                // Da chinh phuc -> luon tap duoc, ke ca khi prerequisite con bi xoa.
                states.put(id, STATE_MASTERED);
            } else if (activePrerequisites.containsKey(id)) {
                // Chi mo khoa khi MOI tien kien ACTIVE deu da MASTERED.
                boolean unlocked = activePrerequisites.get(id).stream()
                        .allMatch(prerequisiteId -> STATE_MASTERED.equals(states.get(prerequisiteId)));
                states.put(id, unlocked ? STATE_CURRENT : STATE_LOCKED);
            } else {
                states.put(id, STATE_CURRENT);
            }

            for (Long nextId : nextExercises.getOrDefault(id, List.of())) {
                int remaining = remainingPrerequisites.compute(nextId, (ignored, count) -> count - 1);
                if (remaining == 0) ready.add(nextId);
            }
        }

        exercises.keySet().forEach(id -> states.putIfAbsent(id, STATE_LOCKED));
        return states;
    }
}
