package com.calishealth.service.survey.level;

import com.calishealth.dtos.SurveyDtos.PlanDayItem;
import com.calishealth.dtos.SurveyDtos.PlanExerciseItem;
import com.calishealth.dtos.SurveyDtos.PlanResponse;
import com.calishealth.dtos.SurveyDtos.ResultConfig;
import com.calishealth.models.DailyPlanDay;
import com.calishealth.models.DailyPlanTemplate;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.WorkoutEntry;
import com.calishealth.models.WorkoutExerciseItem;
import com.calishealth.repository.DailyPlanTemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Dựng kế hoạch gợi ý cho màn "Result and recommended plan" từ các Daily Training Plan Template
 * đang active trong DB (bảng daily_plan_templates -> daily_plan_template_days -> workout_entries).
 *
 * <p>Template được chọn theo level của member (tên level khớp tên cột {@code level}) và số buổi/tuần
 * member muốn; nếu không có template khớp chính xác thì lấy template của level đó có số buổi gần nhất.
 * Nhịp tuần ánh xạ từ {@code day_number} của template sang thứ trong tuần (MON, WED, FRI...).</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RecommendedPlanService {
    /** Thứ trong tuần, thứ hai trước. */
    private static final String[] WEEK_DAYS = {"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"};

    private final DailyPlanTemplateRepository templates;

    /**
     * @param level             level member vừa được chấm, null = không có kế hoạch gợi ý
     * @param desiredDaysPerWeek số buổi/tuần member muốn (từ khảo sát hoặc cấu hình bước Result)
     * @param config            cấu hình bước Result (số tuần, phút/buổi)
     * @return kế hoạch gợi ý, null khi không có template nào cho level này
     */
    @Transactional(readOnly = true)
    public PlanResponse build(FitnessLevel level, Integer desiredDaysPerWeek, ResultConfig config) {
        if (level == null || level.getName() == null) {
            return null;
        }
        List<DailyPlanTemplate> active = templates.findAll().stream()
                .filter(DailyPlanTemplate::isActive)
                .toList();
        DailyPlanTemplate template = pick(active, level.getName(), desiredDaysPerWeek);
        if (template == null) {
            log.info("No active daily plan template for level {}", level.getName());
            return null;
        }

        int perWeek = template.getDaysPerWeek() > 0 ? template.getDaysPerWeek() : 1;
        List<PlanDayItem> rhythm = new ArrayList<>();
        List<DailyPlanDay> days = template.getDays().stream()
                .sorted(Comparator.comparingInt(DailyPlanDay::getDayNumber))
                .toList();
        for (int index = 0; index < days.size(); index++) {
            WorkoutEntry workout = days.get(index).getWorkout();
            if (workout == null) {
                continue;
            }
            rhythm.add(new PlanDayItem(
                    WEEK_DAYS[Math.min(index * WEEK_DAYS.length / days.size(), WEEK_DAYS.length - 1)],
                    workout.getName(),
                    exercises(workout)));
        }

        return new PlanResponse(
                template.getName(),
                template.getDescription(),
                "Built for your " + level.getName() + " level · " + perWeek + " sessions per week.",
                config.planDurationWeeks(),
                perWeek,
                config.minutesPerSession(),
                rhythm);
    }

    /** Template của level, ưu tiên đúng số buổi/tuần member muốn. */
    private DailyPlanTemplate pick(List<DailyPlanTemplate> active, String levelName, Integer desiredDaysPerWeek) {
        List<DailyPlanTemplate> forLevel = active.stream()
                .filter(item -> levelName.equalsIgnoreCase(item.getLevel()))
                .toList();
        if (forLevel.isEmpty()) {
            return null;
        }
        if (desiredDaysPerWeek != null && desiredDaysPerWeek > 0) {
            DailyPlanTemplate exact = forLevel.stream()
                    .filter(item -> item.getDaysPerWeek() == desiredDaysPerWeek)
                    .min(Comparator.comparingInt(DailyPlanTemplate::getMonthNumber)
                            .thenComparing(DailyPlanTemplate::getId))
                    .orElse(null);
            if (exact != null) {
                return exact;
            }
        }
        return forLevel.stream()
                .min(Comparator.comparingInt((DailyPlanTemplate item) ->
                                desiredDaysPerWeek == null ? 0 : Math.abs(item.getDaysPerWeek() - desiredDaysPerWeek))
                        .thenComparingInt(DailyPlanTemplate::getMonthNumber)
                        .thenComparing(DailyPlanTemplate::getId))
                .orElse(null);
    }

    /** Bài tập của buổi tập: tên bài + số hiệp/số giây để member thấy ngay trong nhịp tuần. */
    private static List<PlanExerciseItem> exercises(WorkoutEntry workout) {
        List<PlanExerciseItem> items = new ArrayList<>();
        for (WorkoutExerciseItem item : workout.getExercises()) {
            if (item.getExercise() == null) {
                continue;
            }
            items.add(new PlanExerciseItem(item.getExercise().getName(), detail(item)));
        }
        return items;
    }

    private static String detail(WorkoutExerciseItem item) {
        int sets = item.getSets() > 0 ? item.getSets() : 1;
        String amount;
        if (item.getDurationSeconds() != null && item.getDurationSeconds() > 0) {
            amount = sets + " × " + item.getDurationSeconds() + "s";
        } else if (item.getReps() != null && item.getReps() > 0) {
            amount = sets + " × " + item.getReps() + " reps";
        } else {
            amount = sets + " set" + (sets == 1 ? "" : "s");
        }
        if (item.getRestSeconds() > 0) {
            amount = amount + " · rest " + item.getRestSeconds() + "s";
        }
        return amount;
    }

    /** Tên level trong DB so với tên level của template: so sánh không phân biệt hoa thường. */
    static boolean sameLevel(String levelName, String templateLevel) {
        if (levelName == null || templateLevel == null) {
            return false;
        }
        return levelName.trim().toLowerCase(Locale.ROOT).equals(templateLevel.trim().toLowerCase(Locale.ROOT));
    }
}
