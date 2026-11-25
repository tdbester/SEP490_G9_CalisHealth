package com.calishealth.service;

import com.calishealth.dtos.ProgressionRuleDtos.RuleTree;
import com.calishealth.dtos.ProgressionRuleDtos.SaveRuleRequest;
import com.calishealth.dtos.ProgressionRuleDtos.SetResultInput;
import com.calishealth.dtos.ProgressionRuleDtos.SubmitExerciseResultRequest;
import com.calishealth.models.Exercise;
import com.calishealth.models.ExerciseMuscleGroup;
import com.calishealth.models.MemberProfile;
import com.calishealth.models.MemberSkillProgress;
import com.calishealth.models.MuscleGroup;
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
import org.springframework.jdbc.core.PreparedStatementCreator;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho các nhánh còn thiếu của {@link ProgressionRuleService}.
 */
@ExtendWith(MockitoExtension.class)
class ProgressionRuleServiceExtraCoverageTest {

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

    private PreparedStatement statement;

    private static Exercise exercise(Long id, String code, String name, String category) {
        Exercise exercise = new Exercise();
        exercise.setId(id);
        exercise.setCode(code);
        exercise.setName(name);
        exercise.setCategory(category);
        exercise.setType("HEALTH");
        exercise.setSource("SYSTEM");
        exercise.setActive(true);
        exercise.setModerationStatus("ACTIVE");
        return exercise;
    }

    private static ProgressionRule rule(Long id, Exercise target, Exercise prerequisite, String status) {
        ProgressionRule rule = new ProgressionRule();
        rule.setId(id);
        rule.setExercise(target);
        rule.setPrerequisiteExercise(prerequisite);
        rule.setRuleName(target.getName() + " progression " + prerequisite.getName());
        rule.setStatus(status);
        rule.setMeasureType("REPS");
        rule.setRequiredSets(2);
        rule.setRequiredReps(10);
        rule.setMinAccuracy(BigDecimal.valueOf(80));
        return rule;
    }

    private static User member() {
        User user = new User();
        user.setId(7L);
        user.setEmail("member@example.test");
        user.setRole(UserRole.MEMBER);
        return user;
    }

    private static SetResultInput reps(int total, int clean) {
        return new SetResultInput(total, clean, 0, 0);
    }

    private static SetResultInput hold(int totalSeconds, int cleanSeconds) {
        return new SetResultInput(0, 0, totalSeconds, cleanSeconds);
    }

    // ------------------------------------------------------------------ tree

    @Test
    @DisplayName("Tree: node kem danh sach co bap")
    void treeIncludesMuscleGroupNames() {
        Exercise pushUp = exercise(1L, "PUSH_UP", "Push-up", "REPS");
        MuscleGroup chest = new MuscleGroup();
        chest.setName("Chest");
        ExerciseMuscleGroup link = new ExerciseMuscleGroup();
        link.setMuscleGroup(chest);
        pushUp.setMuscleGroups(List.of(link));

        when(rules.findAll()).thenReturn(List.of(rule(1L, pushUp, pushUp, "ACTIVE")));

        RuleTree tree = service.tree();

        assertEquals(1, tree.nodes().size());
        assertEquals(List.of("Chest"), tree.nodes().get(0).muscleGroups());
    }

    // --------------------------------------------------------------- create

    @Test
    @DisplayName("Create: bai khong co nguon va khong co nguoi tao -> van la bai he thong")
    void createAcceptsCreatorlessSystemExercise() {
        Exercise target = new Exercise();
        target.setId(2L);
        target.setCode("SQUAT");
        target.setName("Squat");
        target.setCategory("REPS");
        target.setType("HEALTH");
        target.setActive(true);
        target.setModerationStatus("ACTIVE");
        target.setCreatedBy(null);

        Exercise prerequisite = exercise(1L, "PLANK", "Plank", "HOLD");

        when(exercises.findByCode("SQUAT")).thenReturn(Optional.of(target));
        when(exercises.findByCode("PLANK")).thenReturn(Optional.of(prerequisite));
        when(rules.existsByExercise_IdAndPrerequisiteExercise_Id(2L, 1L)).thenReturn(false);
        when(rules.findAll()).thenReturn(List.of());
        when(rules.save(any(ProgressionRule.class))).thenAnswer(invocation -> {
            ProgressionRule saved = invocation.getArgument(0);
            saved.setId(9L);
            return saved;
        });
        when(rules.findById(9L)).thenReturn(Optional.of(rule(9L, target, prerequisite, "ACTIVE")));

        service.create(new SaveRuleRequest("SQUAT", "PLANK", 2, null, 45, BigDecimal.valueOf(80), "ACTIVE"));

        verify(rules).save(any(ProgressionRule.class));
    }

    @Test
    @DisplayName("Create: bai HOLD thi thieu so giay -> 400")
    void createRejectsMissingSecondsForHoldExercise() {
        Exercise plank = exercise(2L, "PLANK", "Plank", "HOLD");
        Exercise pushUp = exercise(1L, "PUSH_UP", "Push-up", "REPS");

        when(exercises.findByCode("PLANK")).thenReturn(Optional.of(plank));
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(pushUp));
        when(rules.existsByExercise_IdAndPrerequisiteExercise_Id(2L, 1L)).thenReturn(false);
        when(rules.findAll()).thenReturn(List.of());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(new SaveRuleRequest("PLANK", "PUSH_UP", 2, null, null,
                        BigDecimal.valueOf(80), "ACTIVE")));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Create: trang thai rong -> 400")
    void createRejectsBlankStatus() {
        Exercise pushUp = exercise(1L, "PUSH_UP", "Push-up", "REPS");
        Exercise squat = exercise(2L, "SQUAT", "Squat", "REPS");

        when(exercises.findByCode("SQUAT")).thenReturn(Optional.of(squat));
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(pushUp));
        when(rules.existsByExercise_IdAndPrerequisiteExercise_Id(2L, 1L)).thenReturn(false);
        when(rules.findAll()).thenReturn(List.of());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(new SaveRuleRequest("SQUAT", "PUSH_UP", 2, 10, null,
                        BigDecimal.valueOf(80), "  ")));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    // ------------------------------------------------------- submit result

    private void stubSubmitEnvironment(Exercise exercise) {
        when(exercises.findByCode(exercise.getCode())).thenReturn(Optional.of(exercise));
        lenient().when(users.findByEmail("member@example.test")).thenReturn(Optional.of(member()));
        MemberProfile profile = new MemberProfile();
        profile.setId(3L);
        profile.setUser(member());
        lenient().when(memberProfiles.findByUserId(7L)).thenReturn(Optional.of(profile));
        lenient().when(unlockService.isLocked(anyLong(), anyLong())).thenReturn(false);
        lenient().when(exerciseResults.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(setResults.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(skillProgress.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(rules.findAllByPrerequisiteExercise_IdAndStatus(anyLong(), anyString()))
                .thenReturn(List.of());
    }

    /** Buoc mock JDBC phai that su goi PreparedStatementCreator de cover cac dong lenh SQL. */
    private void stubRealJdbc() throws Exception {
        Connection connection = org.mockito.Mockito.mock(Connection.class);
        statement = org.mockito.Mockito.mock(PreparedStatement.class);
        when(connection.prepareStatement(anyString(), anyInt())).thenReturn(statement);
        doAnswer(invocation -> {
            PreparedStatementCreator creator = invocation.getArgument(0);
            KeyHolder holder = invocation.getArgument(1);
            creator.createPreparedStatement(connection);
            holder.getKeyList().add(java.util.Map.of("ID", 99L));
            return 1;
        }).when(jdbc).update(any(PreparedStatementCreator.class), any(KeyHolder.class));
    }

    @Test
    @DisplayName("Submit result: buoi tap duoc ghi day du vao co so du lieu")
    void submitResultPersistsSessionParameters() throws Exception {
        Exercise pushUp = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        stubSubmitEnvironment(pushUp);
        stubRealJdbc();
        when(skillProgress.findByMemberProfile_IdAndExercise_Id(anyLong(), anyLong()))
                .thenReturn(Optional.empty());

        service.submitResult("member@example.test",
                new SubmitExerciseResultRequest("PUSH_UP",
                        List.of(reps(12, 12), reps(12, 12)), "DAILY_PLAN"));

        verify(statement).setLong(1, 3L);
        verify(statement).setString(2, "Push-up");
        verify(statement).setInt(6, 0);
        verify(statement).setInt(7, 24);
        verify(statement).setString(8, "DAILY_PLAN");
    }

    @Test
    @DisplayName("Submit result: nguon rong -> mac dinh LIBRARY")
    void submitResultDefaultsSourceToLibrary() {
        Exercise pushUp = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        stubSubmitEnvironment(pushUp);
        stubGeneratedKey();
        when(skillProgress.findByMemberProfile_IdAndExercise_Id(anyLong(), anyLong()))
                .thenReturn(Optional.empty());

        var response = service.submitResult("member@example.test",
                new SubmitExerciseResultRequest("PUSH_UP", List.of(reps(10, 10)), "   "));

        assertEquals(99L, response.sessionId());
    }

    private void stubGeneratedKey() {
        doAnswer(invocation -> {
            KeyHolder holder = (KeyHolder) invocation.getArgument(1);
            holder.getKeyList().add(java.util.Map.of("ID", 99L));
            return 1;
        }).when(jdbc).update(any(PreparedStatementCreator.class), any(KeyHolder.class));
    }

    @Test
    @DisplayName("Submit result: so giay sach vuot tong so giay -> 400")
    void submitResultRejectsCleanSecondsAboveTotal() {
        Exercise plank = exercise(2L, "PLANK", "Plank", "HOLD");
        stubSubmitEnvironment(plank);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.submitResult("member@example.test",
                        new SubmitExerciseResultRequest("PLANK", List.of(hold(10, 20)), "LIBRARY")));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Submit result: bai HOLD khong ghi nho giay -> 400")
    void submitResultRejectsMissingHoldTime() {
        Exercise plank = exercise(2L, "PLANK", "Plank", "HOLD");
        stubSubmitEnvironment(plank);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.submitResult("member@example.test",
                        new SubmitExerciseResultRequest("PLANK", List.of(hold(0, 0)), "LIBRARY")));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Submit result: bai da mo khoa truocc do -> khong mo khoa lai")
    void submitResultDoesNotUnlockTwice() {
        Exercise pushUp = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        Exercise squat = exercise(3L, "SQUAT", "Squat", "REPS");
        stubSubmitEnvironment(pushUp);
        stubGeneratedKey();

        MemberSkillProgress existing = new MemberSkillProgress();
        existing.setStatus("UNLOCKED");
        when(skillProgress.findByMemberProfile_IdAndExercise_Id(anyLong(), anyLong()))
                .thenReturn(Optional.of(existing));
        when(rules.findAllByPrerequisiteExercise_IdAndStatus(2L, "ACTIVE"))
                .thenReturn(List.of(rule(1L, squat, pushUp, "ACTIVE")));

        var response = service.submitResult("member@example.test",
                new SubmitExerciseResultRequest("PUSH_UP", List.of(reps(12, 12), reps(12, 12)), "LIBRARY"));

        assertTrue(response.newlyUnlocked().isEmpty());
        assertEquals(1, response.evaluations().size());
    }

    @Test
    @DisplayName("Submit result: ghi nhan best reps va do chinh xac cao nhat")
    void submitResultRecordsBestProgress() {
        Exercise pushUp = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        stubSubmitEnvironment(pushUp);
        stubGeneratedKey();

        MemberSkillProgress existing = new MemberSkillProgress();
        existing.setStatus("IN_PROGRESS");
        existing.setBestReps(5);
        existing.setBestAccuracy(BigDecimal.valueOf(50));
        when(skillProgress.findByMemberProfile_IdAndExercise_Id(anyLong(), anyLong()))
                .thenReturn(Optional.of(existing));

        service.submitResult("member@example.test",
                new SubmitExerciseResultRequest("PUSH_UP", List.of(reps(12, 12)), "LIBRARY"));

        assertEquals(12, existing.getBestReps());
        assertEquals(100, existing.getBestAccuracy().intValue());
    }

    @Test
    @DisplayName("Submit result: do chinh xac thap khong ghi de gia tri tot nhat")
    void submitResultKeepsBetterAccuracy() {
        Exercise pushUp = exercise(2L, "PUSH_UP", "Push-up", "REPS");
        stubSubmitEnvironment(pushUp);
        stubGeneratedKey();

        MemberSkillProgress existing = new MemberSkillProgress();
        existing.setStatus("IN_PROGRESS");
        existing.setBestReps(50);
        existing.setBestAccuracy(BigDecimal.valueOf(90));
        when(skillProgress.findByMemberProfile_IdAndExercise_Id(anyLong(), anyLong()))
                .thenReturn(Optional.of(existing));

        service.submitResult("member@example.test",
                new SubmitExerciseResultRequest("PUSH_UP", List.of(reps(12, 6)), "LIBRARY"));

        assertEquals(50, existing.getBestReps());
        assertEquals(90, existing.getBestAccuracy().intValue());
    }

    // ------------------------------------------------------------ evaluate

    @Test
    @DisplayName("Cham diem: rule REPS khong co nguong rep -> nhuong 0")
    void evaluateTreatsMissingRepThresholdAsZero() {
        var outcome = ProgressionRuleService.evaluate("REPS", 1, null, null,
                BigDecimal.valueOf(80), List.of(reps(5, 5)));

        assertTrue(outcome.passed());
        assertEquals(1, outcome.qualifyingSets());
    }

    @Test
    @DisplayName("Cham diem: do clean thap hon nguong -> thong bao khong dat")
    void evaluateReportsLowAccuracy() {
        var outcome = ProgressionRuleService.evaluate("REPS", 1, 5, null,
                BigDecimal.valueOf(90), List.of(reps(10, 5)));

        assertTrue(!outcome.passed());
        assertTrue(outcome.message().contains("below the required"));
    }

    @Test
    @DisplayName("Cham diem: khong co mau -> bao khong du mau")
    void evaluateReportsMissingSamples() {
        var outcome = ProgressionRuleService.evaluate("REPS", 1, 5, null,
                BigDecimal.valueOf(90), List.of(reps(0, 0)));

        assertTrue(!outcome.passed());
        assertTrue(outcome.message().contains("Not enough samples"));
    }

    @Test
    @DisplayName("Cham diem: bai HOLD dung so giay")
    void evaluateCountsHoldSeconds() {
        var outcome = ProgressionRuleService.evaluate("HOLD", 1, null, 30,
                BigDecimal.valueOf(80), List.of(hold(40, 40)));

        assertTrue(outcome.passed());
    }

    // --------------------------------------------------------------- loop

    @Test
    @DisplayName("Create: vong lap qua nhieu cap -> 400")
    void createRejectsDeepDependencyLoop() {
        Exercise a = exercise(1L, "A", "A", "REPS");
        Exercise b = exercise(2L, "B", "B", "REPS");
        Exercise c = exercise(3L, "C", "C", "REPS");

        when(exercises.findByCode("C")).thenReturn(Optional.of(c));
        when(exercises.findByCode("A")).thenReturn(Optional.of(a));
        when(rules.existsByExercise_IdAndPrerequisiteExercise_Id(3L, 1L)).thenReturn(false);
        // A phu thuoc B, B phu thuoc C : tao rule C phu thuoc A se tao vong lap
        when(rules.findAll()).thenReturn(List.of(
                rule(1L, a, b, "ACTIVE"),
                rule(2L, b, c, "ACTIVE")));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(new SaveRuleRequest("C", "A", 2, 10, null,
                        BigDecimal.valueOf(80), "ACTIVE")));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Create: rule da ton tai cho cap nguoc -> 409")
    void createRejectsExistingPair() {
        Exercise a = exercise(1L, "A", "A", "REPS");
        Exercise b = exercise(2L, "B", "B", "REPS");

        when(exercises.findByCode("B")).thenReturn(Optional.of(b));
        when(exercises.findByCode("A")).thenReturn(Optional.of(a));
        when(rules.existsByExercise_IdAndPrerequisiteExercise_Id(2L, 1L)).thenReturn(true);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(new SaveRuleRequest("B", "A", 2, 10, null,
                        BigDecimal.valueOf(80), "ACTIVE")));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    @DisplayName("Cham diem: thoi gian ket thuc buoi tap duoc tinh tu tong so giay")
    void submitResultDerivesSessionTimestamps() {
        Exercise plank = exercise(2L, "PLANK", "Plank", "HOLD");
        stubSubmitEnvironment(plank);
        stubGeneratedKey();
        when(skillProgress.findByMemberProfile_IdAndExercise_Id(anyLong(), anyLong()))
                .thenReturn(Optional.empty());

        LocalDateTime before = LocalDateTime.now();
        var response = service.submitResult("member@example.test",
                new SubmitExerciseResultRequest("PLANK", List.of(hold(60, 60)), "LIBRARY"));

        assertEquals(99L, response.sessionId());
        assertTrue(LocalDate.now().isEqual(before.toLocalDate()) || LocalDate.now().isAfter(before.toLocalDate()));
    }

    @Test
    @DisplayName("Cham diem: buoi tap ghi nhan timestamp khong null")
    void submitResultSetsSessionTimestamps() {
        Exercise plank = exercise(2L, "PLANK", "Plank", "HOLD");
        stubSubmitEnvironment(plank);
        stubGeneratedKey();
        when(skillProgress.findByMemberProfile_IdAndExercise_Id(anyLong(), anyLong()))
                .thenReturn(Optional.empty());

        var response = service.submitResult("member@example.test",
                new SubmitExerciseResultRequest("PLANK", List.of(hold(60, 60)), "LIBRARY"));

        assertEquals(99L, response.sessionId());
    }
}
