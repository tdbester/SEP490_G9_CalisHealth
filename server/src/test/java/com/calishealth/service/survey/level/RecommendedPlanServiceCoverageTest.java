package com.calishealth.service.survey.level;

import com.calishealth.dtos.SurveyDtos.ResultConfig;
import com.calishealth.models.DailyPlanDay;
import com.calishealth.models.DailyPlanTemplate;
import com.calishealth.models.Exercise;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.WorkoutEntry;
import com.calishealth.models.WorkoutExerciseItem;
import com.calishealth.repository.DailyPlanTemplateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bộ test cho {@link RecommendedPlanService}: chọn template và dựng nhịp tuần.
 */
class RecommendedPlanServiceCoverageTest {

    private DailyPlanTemplateRepository templates;
    private RecommendedPlanService service;

    @BeforeEach
    void setUp() {
        templates = mock(DailyPlanTemplateRepository.class);
        service = new RecommendedPlanService(templates);
    }

    private static FitnessLevel level(String name) {
        FitnessLevel level = new FitnessLevel();
        level.setId(1L);
        level.setName(name);
        return level;
    }

    private static Exercise exercise(String name) {
        Exercise exercise = new Exercise();
        exercise.setId(1L);
        exercise.setCode("EX_1");
        exercise.setName(name);
        return exercise;
    }

    private static WorkoutExerciseItem item(String name, int sets, Integer reps, Integer duration, int rest) {
        WorkoutExerciseItem item = new WorkoutExerciseItem();
        item.setExercise(exercise(name));
        item.setSets(sets);
        item.setReps(reps);
        item.setDurationSeconds(duration);
        item.setRestSeconds(rest);
        return item;
    }

    private static DailyPlanTemplate template(String level, int daysPerWeek, boolean active, LocalDateTime updatedAt) {
        DailyPlanTemplate template = new DailyPlanTemplate();
        template.setId(1L);
        template.setCode("TPL_1");
        template.setName("Plan " + level);
        template.setDescription("desc");
        template.setLevel(level);
        template.setDaysPerWeek(daysPerWeek);
        template.setActive(active);
        template.setUpdatedAt(updatedAt);
        return template;
    }

    private static DailyPlanDay day(int dayNumber, WorkoutEntry workout) {
        DailyPlanDay day = new DailyPlanDay();
        day.setDayNumber(dayNumber);
        day.setWorkout(workout);
        return day;
    }

    private static WorkoutEntry workout(String name, List<WorkoutExerciseItem> items) {
        WorkoutEntry workout = new WorkoutEntry();
        workout.setId(1L);
        workout.setCode("WO_1");
        workout.setName(name);
        workout.getExercises().addAll(items);
        return workout;
    }

    @Test
    @DisplayName("build: level null -> null")
    void buildReturnsNullWithoutLevel() {
        assertThat(service.build(null, 3, ResultConfig.defaults())).isNull();
    }

    @Test
    @DisplayName("build: khong co template active -> null")
    void buildReturnsNullWithoutTemplate() {
        when(templates.findAll()).thenReturn(List.of(template("Beginner", 3, false, LocalDateTime.now())));

        assertThat(service.build(level("Beginner"), 3, ResultConfig.defaults())).isNull();
    }

    @Test
    @DisplayName("build: template khong cung level -> null")
    void buildReturnsNullForOtherLevel() {
        when(templates.findAll()).thenReturn(List.of(template("Advanced", 3, true, LocalDateTime.now())));

        assertThat(service.build(level("Beginner"), 3, ResultConfig.defaults())).isNull();
    }

    @Test
    @DisplayName("build: dung so buoi/tuan -> chon template khop")
    void buildPicksExactMatch() {
        DailyPlanTemplate exact = template("Beginner", 3, true, LocalDateTime.of(2026, 1, 1, 0, 0));
        DailyPlanTemplate other = template("Beginner", 4, true, LocalDateTime.of(2026, 2, 1, 0, 0));
        when(templates.findAll()).thenReturn(List.of(other, exact));
        exact.setDays(exercisesOf(1));

        var plan = service.build(level("Beginner"), 3, ResultConfig.defaults());

        assertThat(plan).isNotNull();
        assertThat(plan.name()).isEqualTo("Plan Beginner");
        assertThat(plan.sessionsPerWeek()).isEqualTo(3);
        assertThat(plan.weeks()).isEqualTo(4);
    }

    @Test
    @DisplayName("build: khong dung so buoi/tuan -> chon template gan nhat")
    void buildPicksClosestMatch() {
        DailyPlanTemplate three = template("Beginner", 3, true, LocalDateTime.of(2026, 1, 1, 0, 0));
        DailyPlanTemplate four = template("Beginner", 4, true, LocalDateTime.of(2026, 2, 1, 0, 0));
        when(templates.findAll()).thenReturn(List.of(three, four));
        three.setDays(exercisesOf(1));

        var plan = service.build(level("Beginner"), 4, ResultConfig.defaults());

        assertThat(plan).isNotNull();
        assertThat(plan.sessionsPerWeek()).isEqualTo(4);
    }

    @Test
    @DisplayName("build: ngay khong co workout -> bo qua")
    void buildSkipsDaysWithoutWorkout() {
        DailyPlanTemplate template = template("Beginner", 2, true, LocalDateTime.now());
        WorkoutEntry entry = workout("Day 1", List.of(item("Push-up", 3, 10, null, 60)));
        template.setDays(List.of(day(1, entry), day(2, null)));
        when(templates.findAll()).thenReturn(List.of(template));

        var plan = service.build(level("Beginner"), 2, ResultConfig.defaults());

        assertThat(plan.rhythm()).hasSize(1);
        assertThat(plan.rhythm().get(0).name()).isEqualTo("Day 1");
    }

    @Test
    @DisplayName("build: bai do theo giay -> chi tiet hien giay")
    void buildDescribesHoldExercise() {
        DailyPlanTemplate template = template("Beginner", 1, true, LocalDateTime.now());
        WorkoutEntry entry = workout("Plank", List.of(item("Plank", 3, null, 45, 60)));
        template.setDays(List.of(day(1, entry)));
        when(templates.findAll()).thenReturn(List.of(template));

        var plan = service.build(level("Beginner"), 1, ResultConfig.defaults());

        assertThat(plan.rhythm().get(0).exercises().get(0).detail())
                .contains("3 × 45s").contains("rest 60s");
    }

    @Test
    @DisplayName("build: bai do theo rep -> chi tiet hien rep")
    void buildDescribesRepsExercise() {
        DailyPlanTemplate template = template("Beginner", 1, true, LocalDateTime.now());
        WorkoutEntry entry = workout("Push", List.of(item("Push-up", 3, 12, null, 0)));
        template.setDays(List.of(day(1, entry)));
        when(templates.findAll()).thenReturn(List.of(template));

        var plan = service.build(level("Beginner"), 1, ResultConfig.defaults());

        assertThat(plan.rhythm().get(0).exercises().get(0).detail()).isEqualTo("3 × 12 reps");
    }

    @Test
    @DisplayName("build: bai khong co rep/gia -> chi tiet hien so set")
    void buildDescribesPlainSets() {
        DailyPlanTemplate template = template("Beginner", 1, true, LocalDateTime.now());
        WorkoutEntry entry = workout("Wall", List.of(item("Wall sit", 1, null, null, 0)));
        template.setDays(List.of(day(1, entry)));
        when(templates.findAll()).thenReturn(List.of(template));

        var plan = service.build(level("Beginner"), 1, ResultConfig.defaults());

        assertThat(plan.rhythm().get(0).exercises().get(0).detail()).isEqualTo("1 set");
    }

    @Test
    @DisplayName("build: item khong co bai tap -> bo qua")
    void buildSkipsItemsWithoutExercise() {
        DailyPlanTemplate template = template("Beginner", 1, true, LocalDateTime.now());
        WorkoutExerciseItem orphan = new WorkoutExerciseItem();
        WorkoutEntry entry = workout("Push", new ArrayList<>(List.of(orphan)));
        template.setDays(List.of(day(1, entry)));
        when(templates.findAll()).thenReturn(List.of(template));

        var plan = service.build(level("Beginner"), 1, ResultConfig.defaults());

        assertThat(plan.rhythm().get(0).exercises()).isEmpty();
    }

    @Test
    @DisplayName("build: template daysPerWeek = 0 -> dung 1")
    void buildDefaultsToOneSession() {
        DailyPlanTemplate template = template("Beginner", 0, true, LocalDateTime.now());
        template.setDays(exercisesOf(1));
        when(templates.findAll()).thenReturn(List.of(template));

        var plan = service.build(level("Beginner"), null, ResultConfig.defaults());

        assertThat(plan.sessionsPerWeek()).isEqualTo(1);
    }

    @Test
    @DisplayName("build: so buoi/tuan null -> chon template moi nhat")
    void buildPicksMostRecentWhenNoPreference() {
        DailyPlanTemplate older = template("Beginner", 3, true, LocalDateTime.of(2026, 1, 1, 0, 0));
        DailyPlanTemplate newer = template("Beginner", 5, true, LocalDateTime.of(2026, 5, 1, 0, 0));
        when(templates.findAll()).thenReturn(List.of(older, newer));
        older.setDays(exercisesOf(1));

        var plan = service.build(level("Beginner"), null, ResultConfig.defaults());

        assertThat(plan.sessionsPerWeek()).isEqualTo(5);
    }

    @Test
    @DisplayName("sameLevel: so sanh khong phan biet hoa thuong")
    void sameLevelIgnoresCase() {
        assertThat(RecommendedPlanService.sameLevel("Beginner", "beginner")).isTrue();
        assertThat(RecommendedPlanService.sameLevel(null, "beginner")).isFalse();
        assertThat(RecommendedPlanService.sameLevel("Beginner", null)).isFalse();
    }

    private static List<DailyPlanDay> exercisesOf(int count) {
        List<DailyPlanDay> days = new ArrayList<>();
        for (int index = 0; index < count; index++) {
            WorkoutEntry entry = workout("Day " + (index + 1), List.of(item("Push-up", 3, 10, null, 60)));
            days.add(day(index + 1, entry));
        }
        return days;
    }
}
