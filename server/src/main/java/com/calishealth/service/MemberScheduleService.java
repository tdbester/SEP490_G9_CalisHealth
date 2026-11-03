package com.calishealth.service;

import com.calishealth.dtos.MemberScheduleDtos.AvailableWorkoutResponse;
import com.calishealth.dtos.MemberScheduleDtos.MemberScheduleResponse;
import com.calishealth.dtos.MemberScheduleDtos.PlanInfoResponse;
import com.calishealth.dtos.MemberScheduleDtos.SaveScheduleRequest;
import com.calishealth.dtos.MemberScheduleDtos.ScheduleEntryRequest;
import com.calishealth.dtos.MemberScheduleDtos.ScheduleEntryResponse;
import com.calishealth.dtos.MemberScheduleDtos.TodayExerciseResponse;
import com.calishealth.dtos.MemberScheduleDtos.TodayWorkoutResponse;
import com.calishealth.models.DailyPlanTemplate;
import com.calishealth.models.Exercise;
import com.calishealth.models.MemberProfile;
import com.calishealth.models.MemberSchedule;
import com.calishealth.models.MemberScheduleEntry;
import com.calishealth.models.User;
import com.calishealth.models.WorkoutEntry;
import com.calishealth.models.WorkoutExerciseItem;
import com.calishealth.repository.DailyPlanTemplateRepository;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.MemberScheduleRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * Member tự xếp lịch tập theo tháng: kéo các workout (lấy từ Daily Training Plan
 * Template do Content Manager tạo) vào từng ngày cụ thể trên lịch tháng, rồi lưu.
 * Mỗi member có đúng một lịch cho mỗi tháng.
 */
@Service
@RequiredArgsConstructor
public class MemberScheduleService {
    private static final String CATEGORY_HEALTH = "HEALTH";
    private static final String CATEGORY_SKILL = "SKILL";

    private static final Set<String> ALLOWED_STATUS = Set.of("PENDING", "COMPLETED", "SKIPPED");

    /** Giây ước lượng cho 1 rep khi bài tập tính theo số lần. */
    private static final int SECONDS_PER_REP = 3;
    /** Thời lượng mặc định cho 1 hiệp khi bài tập không khai báo gì. */
    private static final int DEFAULT_SET_SECONDS = 30;

    private final MemberScheduleRepository schedules;
    private final WorkoutRepository workouts;
    private final DailyPlanTemplateRepository templates;
    private final MemberProfileRepository profiles;
    private final UserRepository users;

    // ------------------------------------------------------------------ workouts

    /** Card workout ở sidebar trái: workout hệ thống đang publish và có thể xếp lịch. */
    @Transactional(readOnly = true)
    public List<AvailableWorkoutResponse> availableWorkouts(String email) {
        User user = loadUser(email);
        Optional<String> memberLevel = memberLevel(user);

        List<WorkoutEntry> pool = schedulableWorkouts().stream()
                .filter(workout -> memberLevel.isEmpty()
                        || memberLevel.get().equalsIgnoreCase(workout.getLevel()))
                .toList();

        // Chưa xếp được level (member chưa làm survey) thì trả toàn bộ để sidebar không rỗng.
        List<WorkoutEntry> target = pool.isEmpty() ? schedulableWorkouts() : pool;

        return target.stream()
                .map(this::toWorkoutCard)
                .sorted(Comparator.comparing(AvailableWorkoutResponse::category)
                        .thenComparing(AvailableWorkoutResponse::level)
                        .thenComparing(AvailableWorkoutResponse::name))
                .toList();
    }

    /**
     * Thẻ "Plan info" của màn Review: template đang active khớp level của member.
     * Trả rỗng khi member chưa có template phù hợp để FE tự ẩn thẻ này.
     */
    @Transactional(readOnly = true)
    public Optional<PlanInfoResponse> planInfo(String email) {
        User user = loadUser(email);
        Optional<String> memberLevel = memberLevel(user);
        return templates.findAll().stream()
                .filter(DailyPlanTemplate::isActive)
                .filter(template -> memberLevel.isEmpty()
                        || memberLevel.get().equalsIgnoreCase(template.getLevel()))
                .min(Comparator.comparingInt(DailyPlanTemplate::getMonthNumber))
                .map(template -> new PlanInfoResponse(
                        template.getCode(),
                        template.getName(),
                        template.getLevel(),
                        template.getMonthNumber(),
                        template.getDaysPerWeek(),
                        LocalDate.now().getYear()));
    }

    // ------------------------------------------------------------------ schedule

    /** Lưu (upsert) lịch của tháng chứa {@code request.month()}. */
    @Transactional
    public MemberScheduleResponse save(String email, SaveScheduleRequest request) {
        if (request == null || request.month() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Month is required");
        }
        LocalDate month = firstOfMonth(request.month());
        User user = loadUser(email);

        MemberSchedule schedule = schedules.findByUserIdAndPlanMonth(user.getId(), month)
                .orElseGet(() -> {
                    MemberSchedule created = new MemberSchedule();
                    created.setUser(user);
                    created.setPlanMonth(month);
                    return created;
                });

        if (request.templateCode() != null && !request.templateCode().isBlank()) {
            schedule.setTemplate(templates.findByCode(request.templateCode().trim())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Training plan template not found: " + request.templateCode())));
        }

        // Xoá lịch cũ và flush NGAY: nếu chỉ clear() rồi addAll(), Hibernate sẽ
        // INSERT dòng mới trước khi DELETE dòng cũ và đụng unique key theo ngày.
        schedule.getEntries().clear();
        schedules.saveAndFlush(schedule);

        List<MemberScheduleEntry> entries = buildEntries(schedule, month, request.entries());
        schedule.getEntries().addAll(entries);

        return toResponse(schedules.saveAndFlush(schedule));
    }

    /** Lịch của tháng chứa {@code monthDate}; rỗng khi member chưa xếp gì. */
    @Transactional(readOnly = true)
    public Optional<MemberScheduleResponse> monthSchedule(String email, LocalDate monthDate) {
        User user = loadUser(email);
        LocalDate month = firstOfMonth(monthDate == null ? LocalDate.now() : monthDate);
        return schedules.findByUserIdAndPlanMonth(user.getId(), month).map(this::toResponse);
    }

    /** Lịch của tháng hiện tại; rỗng khi chưa xếp. */
    @Transactional(readOnly = true)
    public Optional<MemberScheduleResponse> currentSchedule(String email) {
        return monthSchedule(email, LocalDate.now());
    }

    @Transactional(readOnly = true)
    public List<MemberScheduleResponse> allSchedules(String email) {
        User user = loadUser(email);
        return schedules.findByUserIdOrderByPlanMonthDesc(user.getId()).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public MemberScheduleResponse updateStatus(String email, LocalDate date, String status) {
        if (date == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Date is required");
        }
        String normalized = status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED_STATUS.contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Status must be PENDING, COMPLETED, or SKIPPED");
        }

        User user = loadUser(email);
        MemberSchedule schedule = schedules
                .findByUserIdAndPlanMonth(user.getId(), firstOfMonth(date))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No schedule found for this month"));

        List<MemberScheduleEntry> matched = schedule.getEntries().stream()
                .filter(entry -> date.equals(entry.getScheduleDate()))
                .toList();
        if (matched.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "No workout scheduled on " + date);
        }
        matched.forEach(entry -> entry.setStatus(normalized));

        return toResponse(schedules.save(schedule));
    }

    // ------------------------------------------------------------------ today

    /**
     * Buổi tập đã xếp cho {@code date} (mặc định hôm nay). Trả rỗng khi ngày đó
     * là Rest day hoặc member chưa xếp lịch tháng này.
     */
    @Transactional(readOnly = true)
    public List<TodayWorkoutResponse> todayWorkouts(String email, LocalDate date) {
        LocalDate day = date == null ? LocalDate.now() : date;
        User user = loadUser(email);
        return schedules.findByUserIdAndPlanMonth(user.getId(), firstOfMonth(day))
                .map(schedule -> schedule.getEntries().stream()
                        .filter(entry -> day.equals(entry.getScheduleDate()))
                        .sorted(Comparator.comparingInt(MemberScheduleEntry::getOrderInDay))
                        .map(this::toTodayWorkout)
                        .toList())
                .orElseGet(List::of);
    }

    // ------------------------------------------------------------------ helpers

    private User loadUser(String email) {
        return users.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account not found"));
    }

    /** Level của member lấy từ hồ sơ sau khảo sát; rỗng khi chưa có. */
    private Optional<String> memberLevel(User user) {
        return profiles.findByUserId(user.getId())
                .map(MemberProfile::getFitnessLevel)
                .map(level -> level.getName());
    }

    /** Workout hệ thống, đang publish, không phải template daily plan. */
    private List<WorkoutEntry> schedulableWorkouts() {
        return workouts.findAll().stream()
                .filter(WorkoutEntry::isActive)
                .filter(workout -> "SYSTEM".equalsIgnoreCase(workout.getSource()))
                .filter(workout -> !"DAILY_TRAINING_PLAN".equalsIgnoreCase(workout.getType()))
                .toList();
    }

    /** Chuẩn hoá về ngày 1 của tháng chứa {@code date}. */
    private LocalDate firstOfMonth(LocalDate date) {
        return date.withDayOfMonth(1);
    }

    private List<MemberScheduleEntry> buildEntries(
            MemberSchedule schedule, LocalDate month, List<ScheduleEntryRequest> requests) {

        if (requests == null || requests.isEmpty()) {
            return new ArrayList<>();
        }

        LocalDate monthStart = firstOfMonth(month);
        LocalDate nextMonthStart = monthStart.plusMonths(1);
        List<MemberScheduleEntry> entries = new ArrayList<>();

        for (ScheduleEntryRequest request : requests) {
            if (request == null || request.date() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "A date is required for every workout");
            }
            if (request.workoutCode() == null || request.workoutCode().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Choose a workout for " + request.date());
            }
            if (request.date().isBefore(monthStart) || !request.date().isBefore(nextMonthStart)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        request.date() + " is outside the month being saved");
            }

            WorkoutEntry workout = workouts.findByCode(request.workoutCode().trim())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "The workout for " + request.date() + " no longer exists"));
            if (!workout.isActive()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "\"" + workout.getName() + "\" is no longer available. Pick another workout");
            }

            // orderInDay tăng dần theo thứ tự client gửi lên trong cùng một ngày.
            int defaultOrder = (int) entries.stream()
                    .filter(entry -> entry.getScheduleDate().equals(request.date()))
                    .count();

            MemberScheduleEntry entry = new MemberScheduleEntry();
            entry.setSchedule(schedule);
            entry.setScheduleDate(request.date());
            entry.setWorkout(workout);
            entry.setOrderInDay(request.orderInDay() == null ? defaultOrder : request.orderInDay());
            entry.setStatus("PENDING");
            entries.add(entry);
        }

        entries.sort(Comparator.comparing(MemberScheduleEntry::getScheduleDate)
                .thenComparingInt(MemberScheduleEntry::getOrderInDay));
        return entries;
    }

    /** Buổi tập hôm nay kèm danh sách bài và cấu hình hiệp/lần thực tế. */
    private TodayWorkoutResponse toTodayWorkout(MemberScheduleEntry entry) {
        WorkoutEntry workout = entry.getWorkout();
        List<TodayExerciseResponse> exercises = workout.getExercises().stream()
                .map(this::toTodayExercise)
                .toList();

        return new TodayWorkoutResponse(
                entry.getScheduleDate(),
                workout.getCode(),
                workout.getName(),
                workout.getLevel(),
                primaryCategory(workout),
                estimatedMinutes(workout),
                exercises.size(),
                entry.getStatus(),
                exercises);
    }

    private TodayExerciseResponse toTodayExercise(WorkoutExerciseItem item) {
        Exercise exercise = item.getExercise();
        boolean hold = "HOLD".equalsIgnoreCase(exercise.getCategory());
        // Bài chưa khai báo cấu hình riêng trong workout thì lấy mặc định của bài.
        Integer reps = item.getReps() != null ? item.getReps() : exercise.getDefaultReps();
        Integer durationSeconds = item.getDurationSeconds() != null
                ? item.getDurationSeconds()
                : exercise.getDuration();
        return new TodayExerciseResponse(
                exercise.getCode(),
                exercise.getName(),
                hold ? "HOLD" : "REPS",
                muscleGroupLabel(exercise),
                Math.max(item.getSets(), 1),
                hold ? null : reps,
                hold ? durationSeconds : null,
                item.getRestSeconds());
    }

    /** "Chest · Arms"; null khi bài chưa gắn muscle group nào. */
    private String muscleGroupLabel(Exercise exercise) {
        String joined = exercise.getMuscleGroups().stream()
                .map(link -> link.getMuscleGroup().getName())
                .filter(name -> name != null && !name.isBlank())
                .distinct()
                .reduce((first, second) -> first + " · " + second)
                .orElse("");
        return joined;
    }

    private MemberScheduleResponse toResponse(MemberSchedule schedule) {        List<ScheduleEntryResponse> entries = schedule.getEntries().stream()
                .sorted(Comparator.comparing(MemberScheduleEntry::getScheduleDate)
                        .thenComparingInt(MemberScheduleEntry::getOrderInDay))
                .map(this::toEntryResponse)
                .toList();

        int plannedDays = (int) entries.stream()
                .map(ScheduleEntryResponse::date)
                .distinct()
                .count();

        DailyPlanTemplate template = schedule.getTemplate();
        return new MemberScheduleResponse(
                schedule.getId(),
                schedule.getPlanMonth(),
                template == null ? null : template.getCode(),
                template == null ? null : template.getName(),
                entries,
                plannedDays,
                entries.size(),
                schedule.getCreatedAt(),
                schedule.getUpdatedAt());
    }

    private ScheduleEntryResponse toEntryResponse(MemberScheduleEntry entry) {
        WorkoutEntry workout = entry.getWorkout();
        return new ScheduleEntryResponse(
                entry.getId(),
                entry.getScheduleDate(),
                workout.getCode(),
                workout.getName(),
                workout.getLevel(),
                primaryCategory(workout),
                estimatedMinutes(workout),
                workout.getExercises().size(),
                entry.getOrderInDay(),
                entry.getStatus());
    }

    private AvailableWorkoutResponse toWorkoutCard(WorkoutEntry workout) {
        List<String> categories = workout.getExercises().stream()
                .map(WorkoutExerciseItem::getExercise)
                .map(Exercise::getType)
                .filter(type -> type != null && !type.isBlank())
                .map(type -> type.toUpperCase(Locale.ROOT))
                .distinct()
                .sorted()
                .toList();

        List<String> muscles = workout.getExercises().stream()
                .map(WorkoutExerciseItem::getExercise)
                .flatMap(exercise -> exercise.getMuscleGroups().stream())
                .map(link -> link.getMuscleGroup().getName())
                .filter(name -> name != null && !name.isBlank())
                .distinct()
                .sorted()
                .toList();

        return new AvailableWorkoutResponse(
                workout.getCode(),
                workout.getName(),
                workout.getLevel(),
                primaryCategory(workout),
                estimatedMinutes(workout),
                workout.getExercises().size(),
                categories,
                muscles);
    }

    /**
     * HEALTH hoặc SKILL để FE tô màu badge/chip. Workout trộn lẫn vẫn mang tính chất
     * kỹ năng nên SKILL được ưu tiên; mặc định HEALTH khi không xác định được.
     */
    private String primaryCategory(WorkoutEntry workout) {
        List<String> types = workout.getExercises().stream()
                .map(WorkoutExerciseItem::getExercise)
                .map(Exercise::getType)
                .filter(type -> type != null && !type.isBlank())
                .map(type -> type.toUpperCase(Locale.ROOT))
                .toList();

        if (types.contains(CATEGORY_SKILL)) {
            return CATEGORY_SKILL;
        }
        if (types.contains(CATEGORY_HEALTH)) {
            return CATEGORY_HEALTH;
        }
        return CATEGORY_HEALTH;
    }

    /**
     * Ước lượng thời lượng workout (phút) từ cấu hình bài tập:
     * mỗi hiệp = reps * 3s (hoặc durationSeconds) + nghỉ giữa các hiệp.
     */
    private int estimatedMinutes(WorkoutEntry workout) {
        List<WorkoutExerciseItem> items = workout.getExercises();
        if (items.isEmpty()) {
            return 0;
        }

        int totalSeconds = 0;
        for (WorkoutExerciseItem item : items) {
            int sets = Math.max(item.getSets(), 1);
            totalSeconds += sets * secondsPerSet(item);
            totalSeconds += Math.max(sets - 1, 0) * item.getRestSeconds();
        }

        return (int) Math.max(1, Math.round(totalSeconds / 60.0));
    }

    private int secondsPerSet(WorkoutExerciseItem item) {
        if (item.getReps() != null && item.getReps() > 0) {
            return item.getReps() * SECONDS_PER_REP;
        }
        if (item.getDurationSeconds() != null && item.getDurationSeconds() > 0) {
            return item.getDurationSeconds();
        }
        Integer fallback = item.getExercise() == null ? null : item.getExercise().getDuration();
        if (fallback != null && fallback > 0) {
            return fallback;
        }
        return DEFAULT_SET_SECONDS;
    }
}
