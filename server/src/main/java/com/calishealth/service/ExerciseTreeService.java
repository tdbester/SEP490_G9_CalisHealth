package com.calishealth.service;

import com.calishealth.dtos.ExerciseTreeEdgeDTO;
import com.calishealth.dtos.ExerciseTreeNodeDTO;
import com.calishealth.dtos.ExerciseTreeResponseDTO;
import com.calishealth.models.Exercise;
import com.calishealth.models.ProgressionRule;
import com.calishealth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ExerciseTreeService {
    public enum TreeOrder { EASY_TO_HARD, HARD_TO_EASY }

    private final ProgressionRuleService progressionRules;
    private final UserRepository users;
    private final ExerciseUnlockService unlockService;

    @Transactional(readOnly = true)
    public ExerciseTreeResponseDTO getTree(TreeOrder order, String memberEmail) {
        if (order == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tree order is required");
        }
        Long memberId = users.findByEmail(memberEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated member not found"))
                .getId();

        List<ProgressionRule> allRules = progressionRules.orderedTreeRules();
        Map<Long, Exercise> exercises = new LinkedHashMap<>();
        Map<Long, Set<Long>> prerequisites = new HashMap<>();
        Map<Long, Set<Long>> activePrerequisites = new HashMap<>();
        Map<Long, Set<Long>> nextExercises = new HashMap<>();
        for (ProgressionRule rule : allRules) {
            Exercise exercise = rule.getExercise();
            Exercise prerequisite = rule.getPrerequisiteExercise();
            exercises.putIfAbsent(prerequisite.getId(), prerequisite);
            exercises.putIfAbsent(exercise.getId(), exercise);
            prerequisites.computeIfAbsent(exercise.getId(), ignored -> new HashSet<>()).add(prerequisite.getId());
            nextExercises.computeIfAbsent(prerequisite.getId(), ignored -> new HashSet<>()).add(exercise.getId());
            if (ProgressionRuleService.STATUS_ACTIVE.equals(rule.getStatus())) {
                activePrerequisites.computeIfAbsent(exercise.getId(), ignored -> new HashSet<>()).add(prerequisite.getId());
            }
        }

        // V84 bo cot `exercises.tree_level`: do sau cua cay duoc tinh truc tiep tu
        // do thi `progression_rules` (nguon su that duy nhat), dung thuat toan giong
        // frontend (`exerciseTreeLayout.js`) - do sau dai nhat tinh tu bai goc.
        Map<Long, Integer> depthByExercise = depthByExercise(allRules, exercises.keySet());

        Set<Long> exerciseIds = exercises.keySet();
        // Trạng thái mở khoá do ExerciseUnlockService tính (nguồn dùng chung với luồng
        // chặn tập) để cây hiển thị và quy tắc "chỉ tập bài đã mở khoá" luôn khớp nhau.
        Map<Long, String> states = unlockService.statesByExercise(memberId);

        Comparator<Exercise> comparator = Comparator
                .comparing((Exercise exercise) -> depthByExercise.getOrDefault(exercise.getId(), 0))
                .thenComparing(Exercise::getId);
        if (order == TreeOrder.HARD_TO_EASY) comparator = comparator.reversed();
        List<ExerciseTreeNodeDTO> nodes = exercises.values().stream()
                .sorted(comparator)
                .map(exercise -> new ExerciseTreeNodeDTO(
                        exercise.getId(),
                        exercise.getCode(),
                        exercise.getName(),
                        exercise.getType(),
                        exercise.getCategory(),
                        depthByExercise.getOrDefault(exercise.getId(), 0),
                        displayDifficulty(exercise.getDifficultyLevel()),
                        exercise.getMovementGroup() == null ? null : exercise.getMovementGroup().name(),
                        states.get(exercise.getId()),
                        sortedIds(prerequisites.get(exercise.getId())),
                        sortedIds(nextExercises.get(exercise.getId())),
                        exercise.getMuscleGroup()))
                .toList();
        List<ExerciseTreeEdgeDTO> edges = allRules.stream()
                .map(rule -> new ExerciseTreeEdgeDTO(
                        rule.getId(),
                        rule.getStatus(),
                        rule.getPrerequisiteExercise().getCode(),
                        rule.getExercise().getCode()))
                .toList();
        return response(order, nodes, edges);
    }

    private List<Long> sortedIds(Set<Long> ids) {
        return ids == null ? List.of() : ids.stream().sorted().toList();
    }

    /**
     * Độ sâu của mỗi bài trong cây: số cạnh dài nhất từ bài gốc (bài không là đích của rule nào).
     *
     * <p>Tính bằng cách duyệt lặp cho tới khi không còn bài nào đổi độ sâu, nên an toàn với dữ liệu
     * có vòng (một bài là tiền kiện của chính nó): số vòng bị chặn bởi số bài. Cùng thuật toán
     * với {@code client/src/exerciseTreeLayout.js}, nên cột hiển thị ở frontend khớp với cột
     * mà API trả về.
     *
     * @param allRules mọi rule của cây (kể cả rule INACTIVE, vì cây vẫn hiển thị cạnh đó)
     * @param exerciseIds các bài cần tinh do sau
     * @return do sau (bat dau tu 1 cho bai goc) theo id bai
     */
    private Map<Long, Integer> depthByExercise(List<ProgressionRule> allRules, Set<Long> exerciseIds) {
        Map<Long, Integer> depth = new HashMap<>();
        // Bài gốc: xuất hiện trong rule nhưng không là đích của rule nào -> do sau 1.
        Set<Long> targets = new HashSet<>();
        for (ProgressionRule rule : allRules) {
            targets.add(rule.getExercise().getId());
        }
        for (Long exerciseId : exerciseIds) {
            if (!targets.contains(exerciseId)) {
                depth.put(exerciseId, 1);
            }
        }
        // Bai co the nam trong vong: gan do sau 1 de khong bi NULL.
        for (Long exerciseId : exerciseIds) {
            depth.putIfAbsent(exerciseId, 1);
        }

        // Lan toi theo canh prerequisite -> exercise, lap lai den khi khong con doi.
        for (int pass = 0; pass < exerciseIds.size(); pass++) {
            boolean changed = false;
            for (ProgressionRule rule : allRules) {
                Integer prerequisiteDepth = depth.get(rule.getPrerequisiteExercise().getId());
                if (prerequisiteDepth == null) continue;
                int next = prerequisiteDepth + 1;
                Integer current = depth.get(rule.getExercise().getId());
                if (current == null || current < next) {
                    depth.put(rule.getExercise().getId(), next);
                    changed = true;
                }
            }
            if (!changed) break;
        }
        return depth;
    }

    private ExerciseTreeResponseDTO response(
            TreeOrder order,
            List<ExerciseTreeNodeDTO> nodes,
            List<ExerciseTreeEdgeDTO> edges
    ) {
        Map<String, String> legend = new LinkedHashMap<>();
        legend.put("MASTERED", "Mastered");
        legend.put("CURRENT", "Current");
        legend.put("LOCKED", "Locked");
        return new ExerciseTreeResponseDTO("ALL", order.name(), nodes, edges, legend);
    }

    private String displayDifficulty(String difficulty) {
        if (difficulty == null || difficulty.isBlank()) return null;
        String value = difficulty.trim().toLowerCase(java.util.Locale.ROOT);
        return Character.toUpperCase(value.charAt(0)) + value.substring(1);
    }
}
