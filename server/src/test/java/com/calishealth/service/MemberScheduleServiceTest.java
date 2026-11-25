package com.calishealth.service;

import com.calishealth.dtos.MemberScheduleDtos.AvailableWorkoutResponse;
import com.calishealth.dtos.MemberScheduleDtos.MemberScheduleResponse;
import com.calishealth.dtos.MemberScheduleDtos.PlanInfoResponse;
import com.calishealth.dtos.MemberScheduleDtos.SaveScheduleRequest;
import com.calishealth.dtos.MemberScheduleDtos.SaveWeekRequest;
import com.calishealth.dtos.MemberScheduleDtos.ScheduleEntryRequest;
import com.calishealth.dtos.MemberScheduleDtos.ScheduleEntryResponse;
import com.calishealth.dtos.MemberScheduleDtos.TodayWorkoutResponse;
import com.calishealth.dtos.MemberScheduleDtos.WeekRuleResponse;
import com.calishealth.models.DailyPlanDay;
import com.calishealth.models.DailyPlanTemplate;
import com.calishealth.models.Exercise;
import com.calishealth.models.ExerciseMuscleGroup;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.MemberProfile;
import com.calishealth.models.MemberSchedule;
import com.calishealth.models.MemberScheduleEntry;
import com.calishealth.models.MuscleGroup;
import com.calishealth.models.User;
import com.calishealth.models.WorkoutEntry;
import com.calishealth.models.WorkoutExerciseItem;
import com.calishealth.repository.DailyPlanTemplateRepository;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.MemberScheduleRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MemberScheduleServiceTest {
    @Mock private MemberScheduleRepository schedules;
    @Mock private WorkoutRepository workouts;
    @Mock private DailyPlanTemplateRepository templates;
    @Mock private MemberProfileRepository profiles;
    @Mock private UserRepository users;
    @InjectMocks private MemberScheduleService service;

    private static final String EMAIL = "member@example.test";

    private static User member() {
        User user = new User();
        user.setId(7L);
        user.setEmail(EMAIL);
        return user;
    }

    private static LocalDate mondayOfThisWeek() {
        return LocalDate.now().with(DayOfWeek.MONDAY);
    }

    /**
     * Ngày trong tuần này nhưng CHƯA trôi qua.
     *
     * <p>Service bỏ qua các entry của ngày đã qua (lịch sử không được sửa), nên
     * test phải chọn ngày tương lai. Nếu luôn dùng thứ 2 của tuần thì test chỉ
     * đúng khi chạy vào thứ 2 — kể từ thứ 3 trở đi entry bị lọc mất.
     */
    private static LocalDate upcomingDayOfThisWeek() {
        LocalDate today = LocalDate.now();
        LocalDate monday = today.with(DayOfWeek.MONDAY);
        for (int offset = 0; offset < 7; offset += 1) {
            LocalDate candidate = monday.plusDays(offset);
            if (candidate.isAfter(today)) {
                return candidate;
            }
        }
        return today;
    }

    private static Exercise exercise(String code, String name, String type, String category) {
        Exercise exercise = new Exercise();
        exercise.setCode(code);
        exercise.setName(name);
        exercise.setType(type);
        exercise.setCategory(category);
        exercise.setDefaultReps(10);
        exercise.setDuration(45);
        return exercise;
    }

    private static ExerciseMuscleGroup link(Exercise exercise, MuscleGroup group) {
        ExerciseMuscleGroup link = new ExerciseMuscleGroup();
        link.setExercise(exercise);
        link.setMuscleGroup(group);
        return link;
    }

    private static MuscleGroup muscleGroup(String name) {
        MuscleGroup group = new MuscleGroup();
        group.setName(name);
        return group;
    }

    private static WorkoutEntry workout(String code, String name, String level, boolean active,
                                         WorkoutExerciseItem... items) {
        WorkoutEntry workout = new WorkoutEntry();
        workout.setId((long) code.hashCode());
        workout.setCode(code);
        workout.setName(name);
        workout.setLevel(level);
        workout.setSystem(true);
        workout.setType("WORKOUT");
        workout.setTemplateStatus(active ? "PUBLISHED" : "DRAFT");
        workout.setExercises(List.of(items));
        return workout;
    }

    private static WorkoutExerciseItem item(Exercise exercise, int sets, Integer reps, Integer duration, int rest) {
        WorkoutExerciseItem item = new WorkoutExerciseItem();
        item.setExercise(exercise);
        item.setSets(sets);
        item.setReps(reps);
        item.setDurationSeconds(duration);
        item.setRestSeconds(rest);
        return item;
    }

    private static MemberSchedule schedule(long id, LocalDate month) {
        MemberSchedule schedule = new MemberSchedule();
        schedule.setId(id);
        schedule.setUser(member());
        schedule.setPlanMonth(month.withDayOfMonth(1));
        return schedule;
    }

    private static MemberScheduleEntry entry(long id, LocalDate date, WorkoutEntry workout, int order, String status) {
        MemberScheduleEntry entry = new MemberScheduleEntry();
        entry.setId(id);
        entry.setScheduleDate(date);
        entry.setWorkout(workout);
        entry.setOrderInDay(order);
        entry.setStatus(status);
        return entry;
    }

    private void stubUser() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member()));
    }

    private void stubProfile(String level, int daysPerWeek) {
        MemberProfile profile = new MemberProfile();
        profile.setUser(member());
        profile.setDaysPerWeek(daysPerWeek);
        if (level != null) {
            FitnessLevel fitnessLevel = new FitnessLevel();
            fitnessLevel.setName(level);
            profile.setFitnessLevel(fitnessLevel);
        }
        lenient().when(profiles.findByUserId(7L)).thenReturn(Optional.of(profile));
    }

    private void stubProfileEmpty() {
        lenient().when(profiles.findByUserId(7L)).thenReturn(Optional.empty());
    }

    private static DailyPlanTemplate template(long id, String code, String level, int daysPerWeek, boolean active) {
        DailyPlanTemplate template = new DailyPlanTemplate();
        template.setId(id);
        template.setCode(code);
        template.setName("Plan " + code);
        template.setLevel(level);
        template.setDaysPerWeek(daysPerWeek);
        template.setActive(active);
        template.setUpdatedAt(LocalDateTime.of(2026, 1, 1, 0, 0));
        return template;
    }

    // ------------------------------------------------------------ availableWorkouts

    @Test
    @DisplayName("Sidebar workout: chỉ trả workout hệ thống đang publish, không trả daily plan template")
    void availableWorkoutsFiltersNonSystemAndDraft() {
        stubUser();
        stubProfileEmpty();
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "HEALTH", "REPS");
        WorkoutEntry published = workout("W1", "Full Body", "Beginner", true,
                item(pushUp, 3, 10, null, 60));
        WorkoutEntry draft = workout("W2", "Draft Plan", "Beginner", false,
                item(pushUp, 3, 10, null, 60));
        WorkoutEntry dailyPlan = workout("W3", "Daily Plan", "Beginner", true,
                item(pushUp, 3, 10, null, 60));
        dailyPlan.setType("DAILY_TRAINING_PLAN");
        WorkoutEntry memberOne = workout("W4", "Member Plan", "Beginner", true,
                item(pushUp, 3, 10, null, 60));
        memberOne.setSystem(false);

        when(workouts.findAll()).thenReturn(List.of(published, draft, dailyPlan, memberOne));
        when(templates.findAll()).thenReturn(List.of());

        List<AvailableWorkoutResponse> cards = service.availableWorkouts(EMAIL);

        assertEquals(1, cards.size());
        assertEquals("W1", cards.get(0).code());
        assertEquals("HEALTH", cards.get(0).category());
        assertEquals(1, cards.get(0).exerciseCount());
        assertEquals(List.of("HEALTH"), cards.get(0).categories());
    }

    @Test
    @DisplayName("Sidebar workout: lọc theo level của member")
    void availableWorkoutsFiltersByMemberLevel() {
        stubUser();
        stubProfile("Advanced", 3);
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "HEALTH", "REPS");
        WorkoutEntry beginner = workout("W1", "Beginner Plan", "Beginner", true,
                item(pushUp, 3, 10, null, 60));
        WorkoutEntry advanced = workout("W2", "Advanced Plan", "Advanced", true,
                item(pushUp, 3, 10, null, 60));

        when(workouts.findAll()).thenReturn(List.of(beginner, advanced));
        when(templates.findAll()).thenReturn(List.of());

        List<AvailableWorkoutResponse> cards = service.availableWorkouts(EMAIL);

        assertEquals(1, cards.size());
        assertEquals("W2", cards.get(0).code());
    }

    @Test
    @DisplayName("Sidebar workout: chỉ trả workout nằm trong template đã duyệt")
    void availableWorkoutsRestrictsToPlannedCodes() {
        stubUser();
        stubProfile("Beginner", 3);
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "HEALTH", "REPS");
        WorkoutEntry inPlan = workout("W1", "In Plan", "Beginner", true, item(pushUp, 3, 10, null, 60));
        WorkoutEntry notInPlan = workout("W2", "Not In Plan", "Beginner", true, item(pushUp, 3, 10, null, 60));

        DailyPlanTemplate plan = template(1L, "PLAN_BEG_3", "Beginner", 3, true);
        DailyPlanDay day = new DailyPlanDay();
        day.setDayNumber(1);
        day.setWorkout(inPlan);
        plan.setDays(List.of(day));

        when(workouts.findAll()).thenReturn(List.of(inPlan, notInPlan));
        when(templates.findAll()).thenReturn(List.of(plan));

        List<AvailableWorkoutResponse> cards = service.availableWorkouts(EMAIL);

        assertEquals(1, cards.size());
        assertEquals("W1", cards.get(0).code());
    }

    @Test
    @DisplayName("Sidebar workout: member chưa có level thì trả về toàn bộ workout")
    void availableWorkoutsReturnsAllWhenLevelUnknown() {
        stubUser();
        stubProfileEmpty();
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "HEALTH", "REPS");
        WorkoutEntry beginner = workout("W1", "Beginner Plan", "Beginner", true, item(pushUp, 3, 10, null, 60));
        WorkoutEntry advanced = workout("W2", "Advanced Plan", "Advanced", true, item(pushUp, 3, 10, null, 60));

        when(workouts.findAll()).thenReturn(List.of(beginner, advanced));
        when(templates.findAll()).thenReturn(List.of());

        assertEquals(2, service.availableWorkouts(EMAIL).size());
    }

    @Test
    @DisplayName("Sidebar workout: workout trộn HEALTH và SKILL -> badge SKILL")
    void availableWorkoutsPrefersSkillCategory() {
        stubUser();
        stubProfileEmpty();
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "HEALTH", "REPS");
        Exercise handstand = exercise("HANDSTAND", "Handstand", "SKILL", "REPS");
        WorkoutEntry mixed = workout("W1", "Mixed", "Beginner", true,
                item(pushUp, 3, 10, null, 60), item(handstand, 3, 5, null, 60));

        when(workouts.findAll()).thenReturn(List.of(mixed));
        when(templates.findAll()).thenReturn(List.of());

        List<AvailableWorkoutResponse> cards = service.availableWorkouts(EMAIL);

        assertEquals("SKILL", cards.get(0).category());
        assertEquals(List.of("HEALTH", "SKILL"), cards.get(0).categories());
    }

    @Test
    @DisplayName("Sidebar workout: member không tồn tại -> 401")
    void availableWorkoutsRejectsUnknownAccount() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class, () -> service.availableWorkouts(EMAIL));
        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
    }

    // ------------------------------------------------------------------ planInfo

    @Test
    @DisplayName("Plan info: chọn template khớp level và số buổi/tuần")
    void planInfoPicksExactTemplate() {
        stubUser();
        stubProfile("Beginner", 3);
        DailyPlanTemplate exact = template(1L, "PLAN_BEG_3", "Beginner", 3, true);
        DailyPlanTemplate other = template(2L, "PLAN_BEG_4", "Beginner", 4, true);
        DailyPlanTemplate wrongLevel = template(3L, "PLAN_ADV_3", "Advanced", 3, true);
        DailyPlanTemplate inactive = template(4L, "PLAN_BEG_2", "Beginner", 2, false);

        when(templates.findAll()).thenReturn(List.of(exact, other, wrongLevel, inactive));

        PlanInfoResponse info = service.planInfo(EMAIL).orElseThrow();

        assertEquals("PLAN_BEG_3", info.templateCode());
        assertEquals("Beginner", info.level());
        assertEquals(3, info.daysPerWeek());
        assertEquals(LocalDate.now().getYear(), info.year());
    }

    @Test
    @DisplayName("Plan info: không có template khớp chính xác -> lấy template gần nhất")
    void planInfoFallsBackToClosestDays() {
        stubUser();
        stubProfile("Beginner", 3);
        DailyPlanTemplate twoDays = template(1L, "PLAN_BEG_2", "Beginner", 2, true);
        DailyPlanTemplate fourDays = template(2L, "PLAN_BEG_4", "Beginner", 4, true);

        when(templates.findAll()).thenReturn(List.of(twoDays, fourDays));

        // |2-3| == |4-3| -> tie, chọn theo MOST_RECENT_TEMPLATE (updatedAt mới hơn).
        assertEquals("PLAN_BEG_4", service.planInfo(EMAIL).orElseThrow().templateCode());
    }

    @Test
    @DisplayName("Plan info: cùng level + số buổi -> lấy template cập nhật mới nhất")
    void planInfoPrefersMostRecentlyUpdatedTemplate() {
        stubUser();
        stubProfile("Beginner", 3);
        DailyPlanTemplate older = template(1L, "PLAN_OLD", "Beginner", 3, true);
        older.setUpdatedAt(LocalDateTime.of(2026, 1, 1, 0, 0));
        DailyPlanTemplate newer = template(2L, "PLAN_NEW", "Beginner", 3, true);
        newer.setUpdatedAt(LocalDateTime.of(2026, 6, 1, 0, 0));

        when(templates.findAll()).thenReturn(List.of(older, newer));

        assertEquals("PLAN_NEW", service.planInfo(EMAIL).orElseThrow().templateCode());
    }

    @Test
    @DisplayName("Plan info: không có template active -> rỗng")
    void planInfoReturnsEmptyWhenNoActiveTemplate() {
        stubUser();
        stubProfile("Beginner", 3);
        when(templates.findAll()).thenReturn(List.of(template(1L, "PLAN", "Beginner", 3, false)));

        assertTrue(service.planInfo(EMAIL).isEmpty());
    }

    @Test
    @DisplayName("Plan info: danh sách ngày tập sắp theo Day 1..N, bỏ qua ngày chưa gắn workout")
    void planInfoListsTemplateDaysInOrder() {
        stubUser();
        stubProfile("Beginner", 3);
        DailyPlanTemplate plan = template(1L, "PLAN", "Beginner", 3, true);

        DailyPlanDay second = new DailyPlanDay();
        second.setDayNumber(2);
        second.setWorkout(workout("W2", "Second", "Beginner", true));
        DailyPlanDay first = new DailyPlanDay();
        first.setDayNumber(1);
        first.setWorkout(workout("W1", "First", "Beginner", true));
        DailyPlanDay empty = new DailyPlanDay();
        empty.setDayNumber(3);
        plan.setDays(List.of(second, first, empty));

        when(templates.findAll()).thenReturn(List.of(plan));

        PlanInfoResponse info = service.planInfo(EMAIL).orElseThrow();

        assertEquals(2, info.days().size());
        assertEquals(1, info.days().get(0).dayNumber());
        assertEquals("W1", info.days().get(0).workoutCode());
        assertEquals(2, info.days().get(1).dayNumber());
    }

    // ------------------------------------------------------------------ weekRule

    @Test
    @DisplayName("Week rule: tuần chạy từ thứ 2 đến chủ nhật")
    void weekRuleUsesMondayToSunday() {
        stubUser();
        stubProfile("Beginner", 3);
        LocalDate monday = mondayOfThisWeek();
        when(schedules.findByUserIdAndPlanMonth(eq(7L), any())).thenReturn(Optional.empty());

        WeekRuleResponse rule = service.weekRule(EMAIL);

        assertEquals(monday, rule.weekStart());
        assertEquals(monday.plusDays(6), rule.weekEnd());
        assertEquals(3, rule.maxDaysPerWeek());
        assertEquals(0, rule.usedDays());
        assertEquals(0, rule.usedWorkouts());
        assertFalse(rule.daysLimitReached());
        assertTrue(rule.entries().isEmpty());
    }

    @Test
    @DisplayName("Week rule: đếm số ngày tập và số workout trong tuần")
    void weekRuleCountsUsedDaysAndWorkouts() {
        stubUser();
        stubProfile("Beginner", 3);
        LocalDate monday = mondayOfThisWeek();
        WorkoutEntry w = workout("W1", "Full Body", "Beginner", true);

        MemberSchedule current = schedule(1L, monday);
        current.setEntries(List.of(
                entry(1L, monday, w, 0, "PENDING"),
                entry(2L, monday, w, 1, "PENDING"),
                entry(3L, monday.plusDays(1), w, 0, "PENDING")));

        when(schedules.findByUserIdAndPlanMonth(7L, monday.withDayOfMonth(1)))
                .thenReturn(Optional.of(current));

        WeekRuleResponse rule = service.weekRule(EMAIL);

        assertEquals(2, rule.usedDays());
        assertEquals(3, rule.usedWorkouts());
        assertEquals(3, rule.entries().size());
        assertFalse(rule.daysLimitReached());
    }

    @Test
    @DisplayName("Week rule: đã đủ số ngày cho phép -> daysLimitReached = true")
    void weekRuleFlagsLimitReached() {
        stubUser();
        stubProfile("Beginner", 2);
        LocalDate monday = mondayOfThisWeek();
        WorkoutEntry w = workout("W1", "Full Body", "Beginner", true);

        MemberSchedule current = schedule(1L, monday);
        current.setEntries(List.of(
                entry(1L, monday, w, 0, "PENDING"),
                entry(2L, monday.plusDays(1), w, 0, "PENDING")));

        when(schedules.findByUserIdAndPlanMonth(7L, monday.withDayOfMonth(1)))
                .thenReturn(Optional.of(current));

        assertTrue(service.weekRule(EMAIL).daysLimitReached());
    }

    @Test
    @DisplayName("Week rule: lịch đã gắn template nhiều buổi hơn profile -> lấy hạn mức lớn hơn")
    void weekRuleUsesScheduleTemplateLimit() {
        stubUser();
        stubProfile("Beginner", 2);
        LocalDate monday = mondayOfThisWeek();
        MemberSchedule current = schedule(1L, monday);
        current.setTemplate(template(1L, "PLAN", "Beginner", 5, true));

        when(schedules.findByUserIdAndPlanMonth(7L, monday.withDayOfMonth(1)))
                .thenReturn(Optional.of(current));

        assertEquals(5, service.weekRule(EMAIL).maxDaysPerWeek());
    }

    @Test
    @DisplayName("Week rule: profile không khai báo số buổi -> mặc định 3 ngày/tuần")
    void weekRuleUsesDefaultMaxDays() {
        stubUser();
        stubProfileEmpty();
        LocalDate monday = mondayOfThisWeek();
        when(schedules.findByUserIdAndPlanMonth(eq(7L), any())).thenReturn(Optional.empty());

        assertEquals(3, service.weekRule(EMAIL).maxDaysPerWeek());
    }

    @Test
    @DisplayName("Week rule: account không tồn tại -> 401")
    void weekRuleRejectsUnknownAccount() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class, () -> service.weekRule(EMAIL));
    }

    // ------------------------------------------------------------------ saveWeek

    @Test
    @DisplayName("Save week: lưu entry cho tuần hiện tại")
    void saveWeekPersistsEntries() {
        stubUser();
        stubProfile("Beginner", 3);
        LocalDate monday = mondayOfThisWeek();
        LocalDate target = upcomingDayOfThisWeek();
        WorkoutEntry w = workout("W1", "Full Body", "Beginner", true);

        MemberSchedule current = schedule(1L, monday);
        when(schedules.findByUserIdAndPlanMonth(7L, monday.withDayOfMonth(1)))
                .thenReturn(Optional.of(current));
        when(schedules.saveAndFlush(any(MemberSchedule.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(workouts.findByCode("W1")).thenReturn(Optional.of(w));

        service.saveWeek(EMAIL, new SaveWeekRequest(null,
                List.of(new ScheduleEntryRequest(target, "W1", null))));

        assertEquals(1, current.getEntries().size());
        MemberScheduleEntry saved = current.getEntries().get(0);
        assertEquals(target, saved.getScheduleDate());
        assertEquals("PENDING", saved.getStatus());
        assertEquals(0, saved.getOrderInDay());
    }

    @Test
    @DisplayName("Save week: danh sách rỗng -> 400")
    void saveWeekRejectsEmptyEntries() {
        stubUser();
        stubProfile("Beginner", 3);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.saveWeek(EMAIL, new SaveWeekRequest(null, List.of())));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Save week: request null -> 400")
    void saveWeekRejectsNullRequest() {
        stubUser();
        stubProfile("Beginner", 3);

        assertThrows(ResponseStatusException.class, () -> service.saveWeek(EMAIL, null));
    }

    @Test
    @DisplayName("Save week: ngày ngoài tuần hiện tại -> 400")
    void saveWeekRejectsDateOutsideWeek() {
        stubUser();
        stubProfile("Beginner", 3);
        LocalDate outside = mondayOfThisWeek().plusDays(10);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.saveWeek(EMAIL, new SaveWeekRequest(null,
                        List.of(new ScheduleEntryRequest(outside, "W1", null)))));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Save week: cùng một workout hai lần trong tuần -> 400")
    void saveWeekRejectsDuplicateWorkoutCode() {
        stubUser();
        stubProfile("Beginner", 3);
        LocalDate monday = mondayOfThisWeek();

        assertThrows(ResponseStatusException.class,
                () -> service.saveWeek(EMAIL, new SaveWeekRequest(null, List.of(
                        new ScheduleEntryRequest(monday, "W1", null),
                        new ScheduleEntryRequest(monday.plusDays(1), "W1", null)))));
    }

    @Test
    @DisplayName("Save week: vượt quá số ngày tập cho phép -> 400")
    void saveWeekRejectsTooManyDays() {
        stubUser();
        stubProfile("Beginner", 1);
        LocalDate monday = mondayOfThisWeek();

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.saveWeek(EMAIL, new SaveWeekRequest(null, List.of(
                        new ScheduleEntryRequest(monday, "W1", null),
                        new ScheduleEntryRequest(monday.plusDays(1), "W2", null)))));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Save week: workout code rỗng -> 400")
    void saveWeekRejectsBlankWorkoutCode() {
        stubUser();
        stubProfile("Beginner", 3);
        LocalDate monday = mondayOfThisWeek();

        assertThrows(ResponseStatusException.class,
                () -> service.saveWeek(EMAIL, new SaveWeekRequest(null, List.of(
                        new ScheduleEntryRequest(monday, "  ", null)))));
    }

    @Test
    @DisplayName("Save week: workout không còn tồn tại -> 400")
    void saveWeekRejectsMissingWorkout() {
        stubUser();
        stubProfile("Beginner", 3);
        LocalDate target = LocalDate.now();
        LocalDate month = mondayOfThisWeek().withDayOfMonth(1);
        MemberSchedule current = schedule(1L, mondayOfThisWeek());
        when(schedules.findByUserIdAndPlanMonth(7L, month))
                .thenReturn(Optional.of(current));
        when(workouts.findByCode("GONE")).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class,
                () -> service.saveWeek(EMAIL, new SaveWeekRequest(null, List.of(
                        new ScheduleEntryRequest(target, "GONE", null)))));
    }

    @Test
    @DisplayName("Save week: workout không còn publish -> 400")
    void saveWeekRejectsInactiveWorkout() {
        stubUser();
        stubProfile("Beginner", 3);
        LocalDate target = LocalDate.now();
        LocalDate month = mondayOfThisWeek().withDayOfMonth(1);
        MemberSchedule current = schedule(1L, mondayOfThisWeek());
        when(schedules.findByUserIdAndPlanMonth(7L, month))
                .thenReturn(Optional.of(current));
        when(workouts.findByCode("W1")).thenReturn(Optional.of(
                workout("W1", "Old", "Beginner", false)));

        assertThrows(ResponseStatusException.class,
                () -> service.saveWeek(EMAIL, new SaveWeekRequest(null, List.of(
                        new ScheduleEntryRequest(target, "W1", null)))));
    }

    @Test
    @DisplayName("Save week: gắn template vào lịch")
    void saveWeekAttachesTemplate() {
        stubUser();
        stubProfile("Beginner", 3);
        LocalDate monday = mondayOfThisWeek();
        MemberSchedule current = schedule(1L, monday);
        DailyPlanTemplate plan = template(1L, "PLAN_BEG_3", "Beginner", 3, true);

        when(schedules.findByUserIdAndPlanMonth(7L, monday.withDayOfMonth(1)))
                .thenReturn(Optional.of(current));
        when(schedules.saveAndFlush(any(MemberSchedule.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(templates.findByCode("PLAN_BEG_3")).thenReturn(Optional.of(plan));
        when(workouts.findByCode("W1"))
                .thenReturn(Optional.of(workout("W1", "Full Body", "Beginner", true)));

        service.saveWeek(EMAIL, new SaveWeekRequest("PLAN_BEG_3",
                List.of(new ScheduleEntryRequest(upcomingDayOfThisWeek(), "W1", null))));

        assertEquals(plan, current.getTemplate());
    }

    @Test
    @DisplayName("Save week: template code không tồn tại -> 400")
    void saveWeekRejectsUnknownTemplate() {
        stubUser();
        stubProfile("Beginner", 3);
        LocalDate monday = mondayOfThisWeek();
        MemberSchedule current = schedule(1L, monday);
        when(schedules.findByUserIdAndPlanMonth(7L, monday.withDayOfMonth(1)))
                .thenReturn(Optional.of(current));
        when(schedules.saveAndFlush(any(MemberSchedule.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(templates.findByCode("NOPE")).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.saveWeek(EMAIL, new SaveWeekRequest("NOPE", List.of(
                        new ScheduleEntryRequest(upcomingDayOfThisWeek(), "W1", null)))));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Save week: giữ nguyên entry của ngày đã trôi qua")
    void saveWeekKeepsPastEntries() {
        stubUser();
        stubProfile("Beginner", 3);
        LocalDate monday = mondayOfThisWeek();
        LocalDate past = LocalDate.now().minusDays(1);
        org.junit.jupiter.api.Assumptions.assumeTrue(!past.isBefore(monday),
                "Cần ít nhất một ngày đã trôi qua trong tuần hiện tại");

        WorkoutEntry w = workout("W1", "Full Body", "Beginner", true);
        MemberSchedule current = schedule(1L, monday);
        MemberScheduleEntry pastEntry = entry(1L, past, w, 0, "COMPLETED");
        current.setEntries(List.of(pastEntry));

        when(schedules.findByUserIdAndPlanMonth(7L, monday.withDayOfMonth(1)))
                .thenReturn(Optional.of(current));
        when(schedules.saveAndFlush(any(MemberSchedule.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.saveWeek(EMAIL, new SaveWeekRequest(null,
                List.of(new ScheduleEntryRequest(past, "W1", null))));

        assertTrue(current.getEntries().contains(pastEntry));
    }

    // ---------------------------------------------------------------------- save

    @Test
    @DisplayName("Save tháng: tạo lịch mới khi chưa có")
    void saveCreatesScheduleWhenMissing() {
        stubUser();
        stubProfile("Beginner", 3);
        LocalDate month = LocalDate.now().withDayOfMonth(1);
        WorkoutEntry w = workout("W1", "Full Body", "Beginner", true);

        when(schedules.findByUserIdAndPlanMonth(7L, month)).thenReturn(Optional.empty());
        when(schedules.save(any(MemberSchedule.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(schedules.saveAndFlush(any(MemberSchedule.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(workouts.findByCode("W1")).thenReturn(Optional.of(w));

        MemberScheduleResponse response = service.save(EMAIL, new SaveScheduleRequest(
                LocalDate.now(), null,
                List.of(new ScheduleEntryRequest(LocalDate.now().plusDays(1), "W1", null))));

        assertEquals(month, response.month());
        assertEquals(1, response.totalWorkouts());
        assertEquals(1, response.plannedDays());
    }

    @Test
    @DisplayName("Save tháng: month null -> 400")
    void saveRejectsNullMonth() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.save(EMAIL, new SaveScheduleRequest(null, null, List.of())));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Save tháng: request null -> 400")
    void saveRejectsNullRequest() {
        assertThrows(ResponseStatusException.class, () -> service.save(EMAIL, null));
    }

    @Test
    @DisplayName("Save tháng: template code không tồn tại -> 400")
    void saveRejectsUnknownTemplate() {
        stubUser();
        LocalDate month = LocalDate.now().withDayOfMonth(1);
        MemberSchedule current = schedule(1L, month);
        when(schedules.findByUserIdAndPlanMonth(7L, month)).thenReturn(Optional.of(current));
        when(templates.findByCode("NOPE")).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class,
                () -> service.save(EMAIL, new SaveScheduleRequest(LocalDate.now(), "NOPE", List.of())));
    }

    @Test
    @DisplayName("Save tháng: ngày nằm ngoài tháng đang lưu -> 400")
    void saveRejectsDateOutsideMonth() {
        stubUser();
        LocalDate month = LocalDate.now().withDayOfMonth(1);
        MemberSchedule current = schedule(1L, month);
        when(schedules.findByUserIdAndPlanMonth(7L, month)).thenReturn(Optional.of(current));
        when(schedules.saveAndFlush(any(MemberSchedule.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        LocalDate outside = month.plusMonths(2).plusDays(3);
        assertThrows(ResponseStatusException.class,
                () -> service.save(EMAIL, new SaveScheduleRequest(month, null, List.of(
                        new ScheduleEntryRequest(outside, "W1", null)))));
    }

    // ------------------------------------------------------------- monthSchedule

    @Test
    @DisplayName("Month schedule: trả lịch của tháng chứa ngày yêu cầu")
    void monthScheduleReturnsScheduleForMonth() {
        stubUser();
        LocalDate month = LocalDate.now().withDayOfMonth(1);
        MemberSchedule current = schedule(1L, month);
        when(schedules.findByUserIdAndPlanMonth(7L, month)).thenReturn(Optional.of(current));

        MemberScheduleResponse response = service.monthSchedule(EMAIL, LocalDate.now()).orElseThrow();

        assertEquals(month, response.month());
        assertTrue(response.entries().isEmpty());
        assertNull(response.templateCode());
        assertNull(response.templateName());
    }

    @Test
    @DisplayName("Month schedule: chưa có lịch -> rỗng")
    void monthScheduleReturnsEmptyWhenMissing() {
        stubUser();
        when(schedules.findByUserIdAndPlanMonth(eq(7L), any())).thenReturn(Optional.empty());

        assertTrue(service.monthSchedule(EMAIL, LocalDate.now()).isEmpty());
    }

    @Test
    @DisplayName("Month schedule: monthDate null -> dùng tháng hiện tại")
    void monthScheduleDefaultsToCurrentMonth() {
        stubUser();
        LocalDate month = LocalDate.now().withDayOfMonth(1);
        when(schedules.findByUserIdAndPlanMonth(7L, month)).thenReturn(Optional.empty());

        assertTrue(service.monthSchedule(EMAIL, null).isEmpty());
        verify(schedules).findByUserIdAndPlanMonth(7L, month);
    }

    @Test
    @DisplayName("Current schedule: lấy lịch tháng hiện tại")
    void currentScheduleReturnsCurrentMonth() {
        stubUser();
        LocalDate month = LocalDate.now().withDayOfMonth(1);
        MemberSchedule current = schedule(1L, month);
        when(schedules.findByUserIdAndPlanMonth(7L, month)).thenReturn(Optional.of(current));

        assertTrue(service.currentSchedule(EMAIL).isPresent());
    }

    @Test
    @DisplayName("All schedules: trả về toàn bộ lịch của member")
    void allSchedulesReturnsEverySchedule() {
        stubUser();
        MemberSchedule current = schedule(1L, LocalDate.now().withDayOfMonth(1));
        when(schedules.findByUserIdOrderByPlanMonthDesc(7L)).thenReturn(List.of(current));

        assertEquals(1, service.allSchedules(EMAIL).size());
    }

    // -------------------------------------------------------------- updateStatus

    @Test
    @DisplayName("Update status: đổi trạng thái các entry của ngày đó")
    void updateStatusChangesEntries() {
        stubUser();
        LocalDate month = LocalDate.now().withDayOfMonth(1);
        LocalDate target = LocalDate.now();
        WorkoutEntry w = workout("W1", "Full Body", "Beginner", true);

        MemberSchedule current = schedule(1L, month);
        MemberScheduleEntry e1 = entry(1L, target, w, 0, "PENDING");
        current.setEntries(List.of(e1));

        when(schedules.findByUserIdAndPlanMonth(7L, month)).thenReturn(Optional.of(current));
        when(schedules.save(any(MemberSchedule.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MemberScheduleResponse response = service.updateStatus(EMAIL, target, "completed");

        assertEquals("COMPLETED", e1.getStatus());
        assertEquals("COMPLETED", response.entries().get(0).status());
    }

    @Test
    @DisplayName("Update status: date null -> 400")
    void updateStatusRejectsNullDate() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.updateStatus(EMAIL, null, "COMPLETED"));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Update status: trạng thái không hợp lệ -> 400")
    void updateStatusRejectsInvalidStatus() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.updateStatus(EMAIL, LocalDate.now(), "DONE"));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Update status: status null -> 400")
    void updateStatusRejectsNullStatus() {
        assertThrows(ResponseStatusException.class,
                () -> service.updateStatus(EMAIL, LocalDate.now(), null));
    }

    @Test
    @DisplayName("Update status: chưa có lịch cho tháng -> 404")
    void updateStatusRejectsMissingSchedule() {
        stubUser();
        LocalDate month = LocalDate.now().withDayOfMonth(1);
        when(schedules.findByUserIdAndPlanMonth(7L, month)).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.updateStatus(EMAIL, LocalDate.now(), "COMPLETED"));
        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
    }

    @Test
    @DisplayName("Update status: ngày không có workout -> 404")
    void updateStatusRejectsDayWithoutWorkout() {
        stubUser();
        LocalDate month = LocalDate.now().withDayOfMonth(1);
        MemberSchedule current = schedule(1L, month);
        current.setEntries(List.of());
        when(schedules.findByUserIdAndPlanMonth(7L, month)).thenReturn(Optional.of(current));

        assertThrows(ResponseStatusException.class,
                () -> service.updateStatus(EMAIL, LocalDate.now(), "SKIPPED"));
    }

    // -------------------------------------------------------------- todayWorkouts

    @Test
    @DisplayName("Today workouts: trả buổi tập của ngày, sắp theo thứ tự trong ngày")
    void todayWorkoutsReturnsOrderedEntries() {
        stubUser();
        LocalDate month = LocalDate.now().withDayOfMonth(1);
        LocalDate target = LocalDate.now();
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "HEALTH", "REPS");
        WorkoutEntry w = workout("W1", "Full Body", "Beginner", true, item(pushUp, 3, 10, null, 60));

        MemberSchedule current = schedule(1L, month);
        current.setEntries(List.of(
                entry(2L, target, w, 1, "PENDING"),
                entry(1L, target, w, 0, "PENDING"),
                entry(3L, target.plusDays(1), w, 0, "PENDING")));

        when(schedules.findByUserIdAndPlanMonth(7L, month)).thenReturn(Optional.of(current));

        List<TodayWorkoutResponse> today = service.todayWorkouts(EMAIL, target);

        assertEquals(2, today.size());
        assertEquals("W1", today.get(0).workoutCode());
        assertEquals("HEALTH", today.get(0).category());
        assertEquals(1, today.get(0).exerciseCount());
        assertEquals("PENDING", today.get(0).status());
    }

    @Test
    @DisplayName("Today workouts: ngày không có lịch -> rỗng")
    void todayWorkoutsReturnsEmptyWhenNoSchedule() {
        stubUser();
        when(schedules.findByUserIdAndPlanMonth(eq(7L), any())).thenReturn(Optional.empty());

        assertTrue(service.todayWorkouts(EMAIL, LocalDate.now()).isEmpty());
    }

    @Test
    @DisplayName("Today workouts: bài HOLD hiển thị duration, bài REPS hiển thị reps")
    void todayWorkoutsMapsHoldAndReps() {
        stubUser();
        LocalDate month = LocalDate.now().withDayOfMonth(1);
        LocalDate target = LocalDate.now();
        Exercise plank = exercise("PLANK", "Plank", "HEALTH", "HOLD");
        plank.setDuration(45);
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "HEALTH", "REPS");

        WorkoutEntry w = workout("W1", "Full Body", "Beginner", true,
                item(plank, 3, null, 60, 45),
                item(pushUp, 3, null, null, 60));

        MemberSchedule current = schedule(1L, month);
        current.setEntries(List.of(entry(1L, target, w, 0, "PENDING")));
        when(schedules.findByUserIdAndPlanMonth(7L, month)).thenReturn(Optional.of(current));

        List<TodayWorkoutResponse> today = service.todayWorkouts(EMAIL, target);
        var exercises = today.get(0).exercises();

        assertEquals("HOLD", exercises.get(0).category());
        assertNull(exercises.get(0).reps());
        assertEquals(60, exercises.get(0).durationSeconds());
        assertEquals("REPS", exercises.get(1).category());
        assertEquals(10, exercises.get(1).reps());
        assertNull(exercises.get(1).durationSeconds());
    }

    @Test
    @DisplayName("Today workouts: tự tăng sets tối thiểu lên 1")
    void todayWorkoutsClampsSetsToAtLeastOne() {
        stubUser();
        LocalDate month = LocalDate.now().withDayOfMonth(1);
        LocalDate target = LocalDate.now();
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "HEALTH", "REPS");

        WorkoutEntry w = workout("W1", "Full Body", "Beginner", true, item(pushUp, 0, 10, null, 60));
        MemberSchedule current = schedule(1L, month);
        current.setEntries(List.of(entry(1L, target, w, 0, "PENDING")));
        when(schedules.findByUserIdAndPlanMonth(7L, month)).thenReturn(Optional.of(current));

        assertEquals(1, service.todayWorkouts(EMAIL, target).get(0).exercises().get(0).sets());
    }

    @Test
    @DisplayName("Today workouts: gom nhãn nhóm cơ của bài tập")
    void todayWorkoutsJoinsMuscleGroupNames() {
        stubUser();
        LocalDate month = LocalDate.now().withDayOfMonth(1);
        LocalDate target = LocalDate.now();
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "HEALTH", "REPS");
        pushUp.setMuscleGroups(List.of(
                link(pushUp, muscleGroup("Chest")),
                link(pushUp, muscleGroup("Arms"))));

        WorkoutEntry w = workout("W1", "Full Body", "Beginner", true, item(pushUp, 3, 10, null, 60));
        MemberSchedule current = schedule(1L, month);
        current.setEntries(List.of(entry(1L, target, w, 0, "PENDING")));
        when(schedules.findByUserIdAndPlanMonth(7L, month)).thenReturn(Optional.of(current));

        assertEquals("Chest · Arms",
                service.todayWorkouts(EMAIL, target).get(0).exercises().get(0).muscleGroup());
    }

    @Test
    @DisplayName("Today workouts: bài chưa gắn nhóm cơ -> nhãn rỗng")
    void todayWorkoutsHandlesMissingMuscleGroup() {
        stubUser();
        LocalDate month = LocalDate.now().withDayOfMonth(1);
        LocalDate target = LocalDate.now();
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "HEALTH", "REPS");

        WorkoutEntry w = workout("W1", "Full Body", "Beginner", true, item(pushUp, 3, 10, null, 60));
        MemberSchedule current = schedule(1L, month);
        current.setEntries(List.of(entry(1L, target, w, 0, "PENDING")));
        when(schedules.findByUserIdAndPlanMonth(7L, month)).thenReturn(Optional.of(current));

        assertEquals("", service.todayWorkouts(EMAIL, target).get(0).exercises().get(0).muscleGroup());
    }

    // ---------------------------------------------------------- ước lượng thời lượng

    @Test
    @DisplayName("Ước lượng thời lượng: workout rỗng -> 0 phút")
    void estimatedMinutesIsZeroForEmptyWorkout() {
        stubUser();
        stubProfileEmpty();
        WorkoutEntry empty = workout("W1", "Empty", "Beginner", true);

        when(workouts.findAll()).thenReturn(List.of(empty));
        when(templates.findAll()).thenReturn(List.of());

        assertEquals(0, service.availableWorkouts(EMAIL).get(0).durationMinutes());
    }

    @Test
    @DisplayName("Ước lượng thời lượng: 3 hiệp x 10 reps + nghỉ 60s -> 4 phút")
    void estimatedMinutesCountsRepsAndRest() {
        stubUser();
        stubProfileEmpty();
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "HEALTH", "REPS");
        WorkoutEntry w = workout("W1", "Full Body", "Beginner", true, item(pushUp, 3, 10, null, 60));

        when(workouts.findAll()).thenReturn(List.of(w));
        when(templates.findAll()).thenReturn(List.of());

        // 3 hiệp * (10 reps * 3s) = 90s + 2 * 60s nghỉ = 210s -> 4 phút (làm tròn)
        assertEquals(4, service.availableWorkouts(EMAIL).get(0).durationMinutes());
    }

    @Test
    @DisplayName("Ước lượng thời lượng: bài HOLD dùng durationSeconds")
    void estimatedMinutesUsesDurationForHoldExercises() {
        stubUser();
        stubProfileEmpty();
        Exercise plank = exercise("PLANK", "Plank", "HEALTH", "HOLD");
        WorkoutEntry w = workout("W1", "Full Body", "Beginner", true, item(plank, 3, null, 60, 30));

        when(workouts.findAll()).thenReturn(List.of(w));
        when(templates.findAll()).thenReturn(List.of());

        // 3 * 60s + 2 * 30s nghỉ = 240s -> 4 phút
        assertEquals(4, service.availableWorkouts(EMAIL).get(0).durationMinutes());
    }
}
