package com.calishealth.service;

import com.calishealth.dtos.ProgressionRuleDtos.ExerciseRef;
import com.calishealth.dtos.ProgressionRuleDtos.RuleDetail;
import com.calishealth.dtos.ProgressionRuleDtos.RuleList;
import com.calishealth.dtos.ProgressionRuleDtos.RuleTree;
import com.calishealth.dtos.ProgressionRuleDtos.SaveRuleRequest;
import com.calishealth.dtos.ProgressionRuleDtos.SetResultInput;
import com.calishealth.dtos.ProgressionRuleDtos.SubmitExerciseResultRequest;
import com.calishealth.dtos.ProgressionRuleDtos.UpdateRuleRequest;
import com.calishealth.models.Exercise;
import com.calishealth.models.MemberProfile;
import com.calishealth.models.ProgressionRule;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.MemberSkillProgressRepository;
import com.calishealth.repository.ProgressionRuleRepository;
import com.calishealth.repository.SessionExerciseResultRepository;
import com.calishealth.repository.SessionSetResultRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProgressionRuleServiceTest {
    @Mock private ProgressionRuleRepository rules;
    @Mock private ExerciseRepository exercises;
    @Mock private MemberSkillProgressRepository skillProgress;
    @Mock private MemberProfileRepository memberProfiles;
    @Mock private UserRepository users;
    @Mock private SessionExerciseResultRepository exerciseResults;
    @Mock private SessionSetResultRepository setResults;
    @Mock private ApplicationEventPublisher events;
    @Mock private JdbcTemplate jdbc;
    @Mock private ExerciseUnlockService unlockService;
    @InjectMocks private ProgressionRuleService service;

    private static Exercise exercise(long id, String code, String name, String category) {
        Exercise exercise = new Exercise();
        exercise.setId(id);
        exercise.setCode(code);
        exercise.setName(name);
        exercise.setCategory(category);
        exercise.setType("HEALTH");
        exercise.setSource("SYSTEM");
        exercise.setModerationStatus("ACTIVE");
        exercise.setActive(true);
        return exercise;
    }

    private static ProgressionRule rule(long id, Exercise target, Exercise prerequisite, String status) {
        ProgressionRule rule = new ProgressionRule();
        rule.setId(id);
        rule.setExercise(target);
        rule.setPrerequisiteExercise(prerequisite);
        rule.setRuleName(target.getName() + " progression " + prerequisite.getName());
        rule.setRelationship("PREREQUISITE");
        rule.setMeasureType("HOLD".equals(prerequisite.getCategory()) ? "HOLD" : "REPS");
        rule.setRequiredSets(3);
        rule.setRequiredReps(12);
        rule.setMinAccuracy(new BigDecimal("80"));
        rule.setStatus(status);
        rule.setUpdatedAt(LocalDateTime.of(2026, 1, 1, 0, 0));
        return rule;
    }

    private static SetResultInput reps(int total, int clean) {
        return new SetResultInput(total, clean, 0, 0);
    }

    // ---------------------------------------------------------------------- list

    @Test
    @DisplayName("List: đếm rule active / inactive và gom bài tập có thể chọn")
    void listSummarizesRules() {
        Exercise target = exercise(1L, "PLANK", "Plank", "HOLD");
        Exercise prerequisite = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        when(rules.findAll()).thenReturn(List.of(
                rule(1L, target, prerequisite, "ACTIVE"),
                rule(2L, target, prerequisite, "INACTIVE")));
        when(exercises.findAll()).thenReturn(List.of(target, prerequisite));

        RuleList list = service.list();

        assertEquals(2, list.rules().size());
        assertEquals(1, list.activeCount());
        assertEquals(1, list.inactiveCount());
        assertEquals(2, list.availableExercises().size());
        assertEquals("PLANK", list.availableExercises().get(0).code());
    }

    @Test
    @DisplayName("List: bài của member hoặc đã bị vô hiệu không nằm trong danh sách chọn")
    void listExcludesNonSelectableExercises() {
        Exercise memberExercise = exercise(1L, "MINE", "Mine", "REPS");
        memberExercise.setSource("CUSTOM");
        Exercise inactive = exercise(2L, "OLD", "Old", "REPS");
        inactive.setActive(false);
        Exercise pending = exercise(3L, "PENDING", "Pending", "REPS");
        pending.setModerationStatus("PENDING");

        when(rules.findAll()).thenReturn(List.of());
        when(exercises.findAll()).thenReturn(List.of(memberExercise, inactive, pending));

        assertTrue(service.list().availableExercises().isEmpty());
    }

    // ---------------------------------------------------------------------- tree

    @Test
    @DisplayName("Tree: node và cạnh lấy từ các rule")
    void treeBuildsNodesAndEdges() {
        Exercise target = exercise(1L, "PLANK", "Plank", "HOLD");
        Exercise prerequisite = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        when(rules.findAll()).thenReturn(List.of(rule(1L, target, prerequisite, "ACTIVE")));

        RuleTree tree = service.tree();

        assertEquals(2, tree.nodes().size());
        assertEquals(1, tree.edges().size());
        assertEquals("PUSH_UP", tree.edges().get(0).prerequisiteCode());
        assertEquals("PLANK", tree.edges().get(0).exerciseCode());
        assertEquals("REPS", tree.edges().get(0).measureType());
    }

    @Test
    @DisplayName("Ordered tree rules: sắp theo id")
    void orderedTreeRulesSortsById() {
        Exercise target = exercise(1L, "PLANK", "Plank", "HOLD");
        Exercise prerequisite = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        ProgressionRule second = rule(2L, target, prerequisite, "ACTIVE");
        ProgressionRule first = rule(1L, target, prerequisite, "ACTIVE");
        when(rules.findAll()).thenReturn(List.of(second, first));

        assertEquals(1L, service.orderedTreeRules().get(0).getId());
    }

    // ------------------------------------------------------------------- detail

    @Test
    @DisplayName("Detail: gom rule cùng đích và rule tiếp theo")
    void detailGroupsRelatedRules() {
        Exercise target = exercise(1L, "PLANK", "Plank", "HOLD");
        Exercise prerequisite = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        Exercise next = exercise(3L, "HANDSTAND", "Handstand", "REPS");
        ProgressionRule main = rule(1L, target, prerequisite, "ACTIVE");
        ProgressionRule sameTarget = rule(2L, target, prerequisite, "ACTIVE");
        ProgressionRule nextRule = rule(3L, next, target, "ACTIVE");

        when(rules.findById(1L)).thenReturn(Optional.of(main));
        when(rules.findAll()).thenReturn(List.of(main, sameTarget, nextRule));
        when(skillProgress.countByExercise_IdAndStatus(1L, "UNLOCKED")).thenReturn(5L);

        RuleDetail detail = service.detail(1L);

        assertEquals(1L, detail.rule().id());
        assertEquals(5L, detail.unlockedMembers());
        assertEquals(1, detail.sameTargetRules().size());
        assertEquals(1, detail.nextRules().size());
        assertEquals("HANDSTAND", detail.nextRules().get(0).exercise().code());
    }

    @Test
    @DisplayName("Detail: rule không tồn tại -> 404")
    void detailRejectsUnknownRule() {
        when(rules.findById(9L)).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.detail(9L));
        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
    }

    // ------------------------------------------------------------------- create

    @Test
    @DisplayName("Create: tạo rule mới giữa hai bài hệ thống")
    void createStoresNewRule() {
        Exercise target = exercise(1L, "PLANK", "Plank", "HOLD");
        Exercise prerequisite = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        when(exercises.findByCode("PLANK")).thenReturn(Optional.of(target));
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(prerequisite));
        when(rules.existsByExercise_IdAndPrerequisiteExercise_Id(1L, 2L)).thenReturn(false);
        when(rules.findAll()).thenReturn(List.of());
        when(rules.save(any(ProgressionRule.class))).thenAnswer(invocation -> {
            ProgressionRule saved = invocation.getArgument(0);
            saved.setId(10L);
            return saved;
        });
        when(rules.findById(10L)).thenReturn(Optional.of(rule(10L, target, prerequisite, "ACTIVE")));
        when(skillProgress.countByExercise_IdAndStatus(anyLong(), anyString())).thenReturn(0L);

        SaveRuleRequest request = new SaveRuleRequest("PLANK", "PUSH_UP", 3, 12, null,
                new BigDecimal("80"), "ACTIVE");

        RuleDetail detail = service.create(request);

        assertEquals(10L, detail.rule().id());
        verify(rules).save(any(ProgressionRule.class));
    }

    @Test
    @DisplayName("Create: bài tập là prerequisite của chính nó -> 400")
    void createRejectsSelfPrerequisite() {
        Exercise exercise = exercise(1L, "PLANK", "Plank", "HOLD");
        when(exercises.findByCode("PLANK")).thenReturn(Optional.of(exercise));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(new SaveRuleRequest("PLANK", "PLANK", 3, null, 45,
                        new BigDecimal("80"), "ACTIVE")));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Create: rule cho cặp bài đã tồn tại -> 409")
    void createRejectsDuplicatePair() {
        Exercise target = exercise(1L, "PLANK", "Plank", "HOLD");
        Exercise prerequisite = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        when(exercises.findByCode("PLANK")).thenReturn(Optional.of(target));
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(prerequisite));
        when(rules.existsByExercise_IdAndPrerequisiteExercise_Id(1L, 2L)).thenReturn(true);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(new SaveRuleRequest("PLANK", "PUSH_UP", 3, null, 45,
                        new BigDecimal("80"), "ACTIVE")));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    @DisplayName("Create: tạo vòng lặp phụ thuộc -> 400")
    void createRejectsDependencyLoop() {
        Exercise target = exercise(1L, "PLANK", "Plank", "HOLD");
        Exercise prerequisite = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        when(exercises.findByCode("PLANK")).thenReturn(Optional.of(target));
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(prerequisite));
        when(rules.existsByExercise_IdAndPrerequisiteExercise_Id(1L, 2L)).thenReturn(false);
        // PUSH_UP đang phụ thuộc PLANK -> thêm PLANK phụ thuộc PUSH_UP sẽ thành vòng.
        when(rules.findAll()).thenReturn(List.of(rule(5L, prerequisite, target, "ACTIVE")));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(new SaveRuleRequest("PLANK", "PUSH_UP", 3, null, 45,
                        new BigDecimal("80"), "ACTIVE")));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Create: bài tập không tồn tại -> 404")
    void createRejectsUnknownExercise() {
        when(exercises.findByCode("NOPE")).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(new SaveRuleRequest("NOPE", "PUSH_UP", 3, null, 45,
                        new BigDecimal("80"), "ACTIVE")));
        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
    }

    @Test
    @DisplayName("Create: bài tập không phải của hệ thống -> 400")
    void createRejectsNonSystemExercise() {
        Exercise memberExercise = exercise(1L, "MINE", "Mine", "REPS");
        memberExercise.setSource("CUSTOM");
        when(exercises.findByCode("MINE")).thenReturn(Optional.of(memberExercise));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(new SaveRuleRequest("MINE", "PUSH_UP", 3, 12, null,
                        new BigDecimal("80"), "ACTIVE")));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Create: số set ngoài khoảng 1..20 -> 400")
    void createRejectsInvalidSetCount() {
        Exercise target = exercise(1L, "PLANK", "Plank", "HOLD");
        Exercise prerequisite = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        when(exercises.findByCode("PLANK")).thenReturn(Optional.of(target));
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(prerequisite));
        when(rules.existsByExercise_IdAndPrerequisiteExercise_Id(1L, 2L)).thenReturn(false);
        when(rules.findAll()).thenReturn(List.of());

        assertThrows(ResponseStatusException.class,
                () -> service.create(new SaveRuleRequest("PLANK", "PUSH_UP", 25, null, 45,
                        new BigDecimal("80"), "ACTIVE")));
    }

    @Test
    @DisplayName("Create: ngưỡng % clean ngoài khoảng 1..100 -> 400")
    void createRejectsInvalidAccuracy() {
        Exercise target = exercise(1L, "PLANK", "Plank", "HOLD");
        Exercise prerequisite = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        when(exercises.findByCode("PLANK")).thenReturn(Optional.of(target));
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(prerequisite));
        when(rules.existsByExercise_IdAndPrerequisiteExercise_Id(1L, 2L)).thenReturn(false);
        when(rules.findAll()).thenReturn(List.of());

        assertThrows(ResponseStatusException.class,
                () -> service.create(new SaveRuleRequest("PLANK", "PUSH_UP", 3, null, 45,
                        new BigDecimal("0"), "ACTIVE")));
    }

    @Test
    @DisplayName("Create: bài REPS thiếu số rep -> 400")
    void createRejectsMissingRepsForRepsExercise() {
        Exercise target = exercise(1L, "PLANK", "Plank", "REPS");
        Exercise prerequisite = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        when(exercises.findByCode("PLANK")).thenReturn(Optional.of(target));
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(prerequisite));
        when(rules.existsByExercise_IdAndPrerequisiteExercise_Id(1L, 2L)).thenReturn(false);
        when(rules.findAll()).thenReturn(List.of());

        assertThrows(ResponseStatusException.class,
                () -> service.create(new SaveRuleRequest("PLANK", "PUSH_UP", 3, null, null,
                        new BigDecimal("80"), "ACTIVE")));
    }

    @Test
    @DisplayName("Create: bài HOLD thiếu số giây -> 400")
    void createRejectsMissingSecondsForHoldExercise() {
        Exercise target = exercise(1L, "PLANK", "Plank", "HOLD");
        Exercise prerequisite = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        when(exercises.findByCode("PLANK")).thenReturn(Optional.of(target));
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(prerequisite));
        when(rules.existsByExercise_IdAndPrerequisiteExercise_Id(1L, 2L)).thenReturn(false);
        when(rules.findAll()).thenReturn(List.of());

        assertThrows(ResponseStatusException.class,
                () -> service.create(new SaveRuleRequest("PLANK", "PUSH_UP", 3, null, null,
                        new BigDecimal("80"), "ACTIVE")));
    }

    @Test
    @DisplayName("Create: trạng thái không hợp lệ -> 400")
    void createRejectsInvalidStatus() {
        Exercise target = exercise(1L, "PLANK", "Plank", "HOLD");
        Exercise prerequisite = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        when(exercises.findByCode("PLANK")).thenReturn(Optional.of(target));
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(prerequisite));
        when(rules.existsByExercise_IdAndPrerequisiteExercise_Id(1L, 2L)).thenReturn(false);
        when(rules.findAll()).thenReturn(List.of());

        assertThrows(ResponseStatusException.class,
                () -> service.create(new SaveRuleRequest("PLANK", "PUSH_UP", 3, null, 45,
                        new BigDecimal("80"), "PENDING")));
    }

    // ------------------------------------------------------------------- update

    @Test
    @DisplayName("Update: cập nhật ngưỡng của rule")
    void updateChangesThresholds() {
        Exercise target = exercise(1L, "PLANK", "Plank", "REPS");
        Exercise prerequisite = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        ProgressionRule existing = rule(1L, target, prerequisite, "ACTIVE");
        when(rules.findById(1L)).thenReturn(Optional.of(existing));
        when(rules.findAll()).thenReturn(List.of(existing));
        when(skillProgress.countByExercise_IdAndStatus(anyLong(), anyString())).thenReturn(0L);

        service.update(1L, new UpdateRuleRequest(5, 20, null, new BigDecimal("90"), "INACTIVE"));

        assertEquals(5, existing.getRequiredSets());
        assertEquals(20, existing.getRequiredReps());
        assertEquals("INACTIVE", existing.getStatus());
        verify(rules).save(existing);
    }

    @Test
    @DisplayName("Update: rule không tồn tại -> 404")
    void updateRejectsUnknownRule() {
        when(rules.findById(9L)).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class,
                () -> service.update(9L, new UpdateRuleRequest(5, 20, null, new BigDecimal("90"), "ACTIVE")));
    }

    @Test
    @DisplayName("Delete: xoá rule")
    void deleteRemovesRule() {
        Exercise target = exercise(1L, "PLANK", "Plank", "REPS");
        Exercise prerequisite = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        ProgressionRule existing = rule(1L, target, prerequisite, "ACTIVE");
        when(rules.findById(1L)).thenReturn(Optional.of(existing));

        service.delete(1L);

        verify(rules).delete(existing);
    }

    @Test
    @DisplayName("Update status: đổi trạng thái rule")
    void updateStatusChangesStatus() {
        Exercise target = exercise(1L, "PLANK", "Plank", "REPS");
        Exercise prerequisite = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        ProgressionRule existing = rule(1L, target, prerequisite, "ACTIVE");
        when(rules.findById(1L)).thenReturn(Optional.of(existing));
        when(rules.findAll()).thenReturn(List.of(existing));
        when(skillProgress.countByExercise_IdAndStatus(anyLong(), anyString())).thenReturn(0L);

        service.updateStatus(1L, "inactive");

        assertEquals("INACTIVE", existing.getStatus());
    }

    @Test
    @DisplayName("Update status: trạng thái không hợp lệ -> 400")
    void updateStatusRejectsInvalidStatus() {
        Exercise target = exercise(1L, "PLANK", "Plank", "REPS");
        Exercise prerequisite = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        when(rules.findById(1L)).thenReturn(Optional.of(rule(1L, target, prerequisite, "ACTIVE")));

        assertThrows(ResponseStatusException.class, () -> service.updateStatus(1L, "PENDING"));
    }

    // ----------------------------------------------------------- submit result

    private User member() {
        User user = new User();
        user.setId(7L);
        user.setEmail("member@example.test");
        user.setRole(UserRole.MEMBER);
        return user;
    }

    private MemberProfile profile() {
        MemberProfile profile = new MemberProfile();
        profile.setId(3L);
        profile.setUser(member());
        return profile;
    }

    private void stubSubmitEnvironment(Exercise exercise) {
        when(exercises.findByCode(exercise.getCode())).thenReturn(Optional.of(exercise));
        when(users.findByEmail("member@example.test")).thenReturn(Optional.of(member()));
        when(memberProfiles.findByUserId(7L)).thenReturn(Optional.of(profile()));
        lenient().when(unlockService.isLocked(anyLong(), anyLong())).thenReturn(false);
        lenient().when(exerciseResults.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(setResults.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(skillProgress.findByMemberProfile_IdAndExercise_Id(anyLong(), anyLong()))
                .thenReturn(Optional.empty());
        lenient().when(skillProgress.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(rules.findAllByPrerequisiteExercise_IdAndStatus(anyLong(), anyString()))
                .thenReturn(List.of());
        stubGeneratedKey();
    }

    /** Bản ghi buổi tập được insert bằng JDBC thật, nên test phải trả về khoá sinh tự động. */
    private void stubGeneratedKey() {
        doAnswer(invocation -> {
            org.springframework.jdbc.support.GeneratedKeyHolder holder =
                    (org.springframework.jdbc.support.GeneratedKeyHolder) invocation.getArgument(1);
            holder.getKeyList().add(java.util.Map.of("ID", 99L));
            return 1;
        }).when(jdbc).update(any(org.springframework.jdbc.core.PreparedStatementCreator.class),
                any(org.springframework.jdbc.support.KeyHolder.class));
    }

    @Test
    @DisplayName("Submit result: lưu kết quả và đánh giá các rule active")
    void submitResultSavesAndEvaluates() {
        Exercise pushUp = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        stubSubmitEnvironment(pushUp);

        var response = service.submitResult("member@example.test",
                new SubmitExerciseResultRequest("PUSH_UP",
                        List.of(reps(12, 12), reps(12, 12), reps(12, 12)), "LIBRARY"));

        assertEquals("PUSH_UP", response.exercise().code());
        assertEquals(100d, response.cleanRate().doubleValue());
        assertTrue(response.evaluations().isEmpty());
        verify(exerciseResults).save(any());
        verify(setResults, org.mockito.Mockito.times(3)).save(any());
        verify(events).publishEvent(any(com.calishealth.events.WorkoutCompletedEvent.class));
    }

    @Test
    @DisplayName("Submit result: bài tập không tồn tại -> 404")
    void submitResultRejectsUnknownExercise() {
        when(exercises.findByCode("NOPE")).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.submitResult("member@example.test",
                        new SubmitExerciseResultRequest("NOPE", List.of(reps(10, 10)), null)));
        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
    }

    @Test
    @DisplayName("Submit result: tài khoản không tồn tại -> 401")
    void submitResultRejectsUnknownAccount() {
        Exercise pushUp = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(pushUp));
        when(users.findByEmail("member@example.test")).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.submitResult("member@example.test",
                        new SubmitExerciseResultRequest("PUSH_UP", List.of(reps(10, 10)), null)));
        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
    }

    @Test
    @DisplayName("Submit result: tài khoản không phải MEMBER -> 403")
    void submitResultRejectsNonMemberRole() {
        Exercise pushUp = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        User contentManager = member();
        contentManager.setRole(UserRole.CONTENT_MANAGER);
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(pushUp));
        when(users.findByEmail("member@example.test")).thenReturn(Optional.of(contentManager));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.submitResult("member@example.test",
                        new SubmitExerciseResultRequest("PUSH_UP", List.of(reps(10, 10)), null)));
        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
    }

    @Test
    @DisplayName("Submit result: chưa có hồ sơ member -> 404")
    void submitResultRejectsMissingProfile() {
        Exercise pushUp = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(pushUp));
        when(users.findByEmail("member@example.test")).thenReturn(Optional.of(member()));
        when(memberProfiles.findByUserId(7L)).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.submitResult("member@example.test",
                        new SubmitExerciseResultRequest("PUSH_UP", List.of(reps(10, 10)), null)));
        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
    }

    @Test
    @DisplayName("Submit result: bài đang khoá trong cây progression -> 403")
    void submitResultRejectsLockedExercise() {
        Exercise pushUp = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(pushUp));
        when(users.findByEmail("member@example.test")).thenReturn(Optional.of(member()));
        when(memberProfiles.findByUserId(7L)).thenReturn(Optional.of(profile()));
        when(unlockService.isLocked(2L, 7L)).thenReturn(true);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.submitResult("member@example.test",
                        new SubmitExerciseResultRequest("PUSH_UP", List.of(reps(10, 10)), "LIBRARY")));
        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
    }

    @Test
    @DisplayName("Submit result: luồng DAILY_PLAN không bị chặn dù bài đang khoá")
    void submitResultAllowsDailyPlanForLockedExercise() {
        Exercise pushUp = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        stubSubmitEnvironment(pushUp);

        var response = service.submitResult("member@example.test",
                new SubmitExerciseResultRequest("PUSH_UP", List.of(reps(10, 10)), "DAILY_PLAN"));
        assertEquals("PUSH_UP", response.exercise().code());
    }

    @Test
    @DisplayName("Submit result: số rep sạch vượt số rep -> 400")
    void submitResultRejectsCleanRepsAboveTotal() {
        Exercise pushUp = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(pushUp));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.submitResult("member@example.test",
                        new SubmitExerciseResultRequest("PUSH_UP", List.of(reps(5, 10)), null)));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Submit result: không ghi nhận rep nào -> 400")
    void submitResultRejectsEmptySamples() {
        Exercise pushUp = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(pushUp));

        assertThrows(ResponseStatusException.class,
                () -> service.submitResult("member@example.test",
                        new SubmitExerciseResultRequest("PUSH_UP", List.of(reps(0, 0)), null)));
    }

    @Test
    @DisplayName("Submit result: rule đạt -> mở khóa bài đích")
    void submitResultUnlocksTargetExercise() {
        Exercise prerequisite = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        Exercise target = exercise(1L, "PLANK", "Plank", "HOLD");
        stubSubmitEnvironment(prerequisite);

        ProgressionRule active = rule(1L, target, prerequisite, "ACTIVE");
        active.setRequiredSets(2);
        active.setRequiredReps(10);
        when(rules.findAllByPrerequisiteExercise_IdAndStatus(2L, "ACTIVE"))
                .thenReturn(List.of(active));

        var response = service.submitResult("member@example.test",
                new SubmitExerciseResultRequest("PUSH_UP",
                        List.of(reps(12, 12), reps(12, 12)), "LIBRARY"));

        assertEquals(1, response.evaluations().size());
        assertTrue(response.evaluations().get(0).passed());
        assertEquals(1, response.newlyUnlocked().size());
        assertEquals("PLANK", response.newlyUnlocked().get(0).code());
    }
}
