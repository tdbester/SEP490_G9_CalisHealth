package com.calishealth.service;

import com.calishealth.dtos.MemberScheduleDtos.AvailableWorkoutResponse;
import com.calishealth.dtos.MemberScheduleDtos.MemberScheduleResponse;
import com.calishealth.dtos.MemberScheduleDtos.PlanDayResponse;
import com.calishealth.dtos.MemberScheduleDtos.PlanInfoResponse;
import com.calishealth.dtos.MemberScheduleDtos.SaveScheduleRequest;
import com.calishealth.dtos.MemberScheduleDtos.SaveWeekRequest;
import com.calishealth.dtos.MemberScheduleDtos.ScheduleEntryRequest;
import com.calishealth.dtos.MemberScheduleDtos.ScheduleEntryResponse;
import com.calishealth.dtos.MemberScheduleDtos.TodayExerciseResponse;
import com.calishealth.dtos.MemberScheduleDtos.TodayWorkoutResponse;
import com.calishealth.dtos.MemberScheduleDtos.WeekRuleResponse;
import com.calishealth.models.DailyPlanTemplate;
import com.calishealth.models.DailyPlanDay;
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

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
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

    /** Số ngày tập tối đa mỗi tuần khi member chưa có template active. */
    private static final int DEFAULT_MAX_DAYS_PER_WEEK = 3;

    /**
     * Cùng level + cùng số buổi/tuần thì lấy plan cập nhật gần nhất.
     *
     * <p>Template không còn phân biệt "tháng training" nữa (mỗi level + số buổi/tuần
     * chỉ nên có 1 plan active), nên không thể sắp theo tháng như trước.</p>
     */
    private static final Comparator<DailyPlanTemplate> MOST_RECENT_TEMPLATE =
            Comparator.comparing(DailyPlanTemplate::getUpdatedAt,
                            Comparator.nullsFirst(Comparator.naturalOrder()))
                    .thenComparing(DailyPlanTemplate::getId)
                    .reversed();

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
     * Thẻ "Plan info" của màn Review: template đang active khớp level và số
     * buổi/tuần của member.
     *
     * <p>Số buổi/tuần lấy từ {@code member_profiles.days_per_week} — member tự
     * chọn ở profile/onboarding. Template được chọn theo (level, daysPerWeek);
     * nếu không có template nào khớp chính xác thì lấy template của level đó có
     * số buổi gần nhất (giống cách {@code RecommendedPlanService} chọn).</p>
     *
     * <p>Trả rỗng khi member chưa có template phù hợp để FE tự ẩn thẻ này.</p>
     */
    @Transactional(readOnly = true)
    public Optional<PlanInfoResponse> planInfo(String email) {
        User user = loadUser(email);
        Optional<String> memberLevel = memberLevel(user);
        int desiredDays = memberDaysPerWeek(user);
        return templates.findAll().stream()
                .filter(DailyPlanTemplate::isActive)
                .filter(template -> memberLevel.isEmpty()
                        || memberLevel.get().equalsIgnoreCase(template.getLevel()))
                .min(templateComparator(desiredDays))
                .map(template -> new PlanInfoResponse(
                        template.getCode(),
                        template.getName(),
                        template.getLevel(),
                        template.getDaysPerWeek(),
                        LocalDate.now().getYear(),
                        templateDays(template)));
    }

    /**
     * Ưu tiên template có đúng số buổi/tuần member đăng ký; khi không có thì
     * lấy template gần nhất. Cùng (level, số buổi) thì lấy plan cập nhật mới nhất.
     */
    private Comparator<DailyPlanTemplate> templateComparator(int desiredDays) {
        return Comparator
                .comparingInt((DailyPlanTemplate item) ->
                        Math.abs(item.getDaysPerWeek() - desiredDays))
                .thenComparing(MOST_RECENT_TEMPLATE);
    }

    /**
     * Các ngày tập của template, sắp theo Day 1..N.
     *
     * <p>Đây là phần Content Manager dựng và member "nhận" trong lịch của
     * mình: màn "Workout schedule" xếp sẵn các workout này vào đúng thứ tự
     * ngày tập, thay vì để member tự kéo thủ công từ sidebar.</p>
     */
    private List<PlanDayResponse> templateDays(DailyPlanTemplate template) {
        return template.getDays().stream()
                .filter(day -> day.getWorkout() != null)
                .sorted(Comparator.comparingInt(DailyPlanDay::getDayNumber))
                .map(day -> new PlanDayResponse(
                        day.getDayNumber(),
                        day.getWorkout().getCode(),
                        day.getWorkout().getName()))
                .toList();
    }

    // ------------------------------------------------------------------ schedule

    /**
     * Ràng buộc tuần hiện tại: chỉ được xếp trong tuần này, tối đa
     * {@code daysPerWeek} ngày tập, mỗi workout chỉ một lần.
     *
     * Tuần có thể trải qua hai tháng (ví dụ 30/11 – 06/12) nên lịch được gộp
     * từ cả lịch tháng trước và lịch tháng hiện tại.
     */
    @Transactional(readOnly = true)
    public WeekRuleResponse weekRule(String email) {
        User user = loadUser(email);
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.with(DayOfWeek.MONDAY);
        LocalDate weekEnd = weekStart.plusDays(6);

        int maxDays = maxDaysPerWeek(user);
        List<MemberScheduleEntry> weekEntries = weekEntries(user, weekStart, weekEnd);

        int usedDays = (int) weekEntries.stream()
                .map(MemberScheduleEntry::getScheduleDate)
                .distinct()
                .count();

        return new WeekRuleResponse(
                weekStart,
                weekEnd,
                maxDays,
                usedDays,
                weekEntries.size(),
                usedDays >= maxDays,
                weekEntries.stream().map(this::toEntryResponse).toList());
    }

    /**
     * Lưu lịch của tuần hiện tại. Chỉ phần thuộc tuần này bị thay đổi; các tuần
     * khác trong tháng giữ nguyên để không mất những buổi đã xếp sẵn.
     */
    @Transactional
    public MemberScheduleResponse saveWeek(String email, SaveWeekRequest request) {
        User user = loadUser(email);
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.with(DayOfWeek.MONDAY);
        LocalDate weekEnd = weekStart.plusDays(6);
        int maxDays = maxDaysPerWeek(user);

        List<ScheduleEntryRequest> requests = request == null ? List.of() : request.entries();
        if (requests == null || requests.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Pick at least one workout for this week before saving.");
        }

        // Tuần có thể nằm ở hai tháng → gom các tháng liên quan.
        Set<LocalDate> months = monthsOfWeek(weekStart, weekEnd);

        // Số ngày đang có sẵn trong tuần (trước khi lưu). Dữ liệu cũ có thể đã
        // vượt hạn mức (vd template 3 ngày/tuần nhưng lịch cũ có 4 ngày) — khi đó
        // member vẫn phải lưu được để tự sửa lịch, nên hạn mức thực tế khi lưu là
        // max(hạn mức của template, số ngày đang có sẵn).
        int existingDays = (int) weekEntries(user, weekStart, weekEnd).stream()
                .map(MemberScheduleEntry::getScheduleDate)
                .distinct()
                .count();

        // Validate TOÀN TUẦN trước (không tách theo tháng) để giới hạn ngày và
        // "mỗi workout một lần" được tính đúng cả khi tuần qua ranh giới tháng.
        validateWeekEntries(requests, weekStart, weekEnd, Math.max(maxDays, existingDays));

        // Ngày đã trôi qua là lịch sử: member không được thay đổi. Client gửi lên
        // cả các entry của ngày quá khứ (để giữ nguyên lịch đã tập) — ta giữ
        // chúng nguyên vẹn trong DB và chỉ xoá/thay các ngày chưa qua.
        List<ScheduleEntryRequest> editableRequests = requests.stream()
                .filter(item -> item != null && item.date() != null && !item.date().isBefore(today))
                .toList();

        // Xoá các entry của tuần này ở mọi tháng liên quan rồi flush NGAY:
        // nếu chỉ remove rồi addAll, Hibernate sẽ INSERT dòng mới trước khi
        // DELETE dòng cũ và đụng unique key theo ngày.
        for (LocalDate month : months) {
            MemberSchedule schedule = findOrCreateSchedule(user, month);
            List<MemberScheduleEntry> stale = schedule.getEntries().stream()
                    .filter(entry -> !entry.getScheduleDate().isBefore(weekStart)
                            && !entry.getScheduleDate().isAfter(weekEnd))
                    // Giữ nguyên entry của ngày đã trôi qua.
                    .filter(entry -> !entry.getScheduleDate().isBefore(today))
                    .toList();
            stale.forEach(schedule.getEntries()::remove);
            schedules.saveAndFlush(schedule);
        }

        // Gắn template vào các lịch liên quan.
        if (request.templateCode() != null && !request.templateCode().isBlank()) {
            DailyPlanTemplate template = templates.findByCode(request.templateCode().trim())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Training plan template not found: " + request.templateCode()));
            for (LocalDate month : months) {
                MemberSchedule schedule = findOrCreateSchedule(user, month);
                schedule.setTemplate(template);
                schedules.saveAndFlush(schedule);
            }
        }

        // Build entry cho từng tháng mà tuần chạm tới.
        for (LocalDate month : months) {
            List<ScheduleEntryRequest> forMonth = editableRequests.stream()
                    .filter(item -> item != null && item.date() != null)
                    .filter(item -> firstOfMonth(item.date()).equals(month))
                    .toList();
            if (forMonth.isEmpty()) {
                continue;
            }
            MemberSchedule schedule = findOrCreateSchedule(user, month);
            List<MemberScheduleEntry> built = buildEntries(schedule, forMonth);
            schedule.getEntries().addAll(built);
            schedules.saveAndFlush(schedule);
        }

        return monthSchedule(email, firstOfMonth(today)).orElse(null);
    }

    /**
     * Kiểm tra ràng buộc tuần: ngày phải thuộc tuần hiện tại, tối đa
     * {@code maxDaysPerWeek} ngày tập, và mỗi workout chỉ được xếp một lần.
     */
    private void validateWeekEntries(
            List<ScheduleEntryRequest> requests,
            LocalDate weekStart,
            LocalDate weekEnd,
            int maxDaysPerWeek) {

        Set<String> seenCodes = new LinkedHashSet<>();
        Set<LocalDate> distinctDays = new LinkedHashSet<>();

        for (ScheduleEntryRequest request : requests) {
            if (request == null || request.date() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "A date is required for every workout");
            }
            if (request.workoutCode() == null || request.workoutCode().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Choose a workout for " + request.date());
            }
            if (request.date().isBefore(weekStart) || request.date().isAfter(weekEnd)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        request.date() + " is outside the current week. You can only adjust "
                                + "this week (" + weekStart + " to " + weekEnd + ")");
            }

            String code = request.workoutCode().trim();
            if (!seenCodes.add(code)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "\"" + code + "\" is already planned this week. "
                                + "Move it to another day instead.");
            }
            distinctDays.add(request.date());
        }

        if (distinctDays.size() > maxDaysPerWeek) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "You can train on at most " + maxDaysPerWeek
                            + " days per week. Pick fewer days for this week.");
        }
    }

    /** Lịch của member cho tháng chứa {@code month}; tạo mới nếu chưa có. */
    private MemberSchedule findOrCreateSchedule(User user, LocalDate month) {
        return schedules.findByUserIdAndPlanMonth(user.getId(), month)
                .orElseGet(() -> {
                    MemberSchedule created = new MemberSchedule();
                    created.setUser(user);
                    created.setPlanMonth(month);
                    return schedules.save(created);
                });
    }

    /** Các entry của member nằm trong khoảng [weekStart, weekEnd]. */
    private List<MemberScheduleEntry> weekEntries(User user, LocalDate weekStart, LocalDate weekEnd) {
        List<MemberScheduleEntry> result = new ArrayList<>();
        for (LocalDate month : monthsOfWeek(weekStart, weekEnd)) {
            schedules.findByUserIdAndPlanMonth(user.getId(), month)
                    .ifPresent(schedule -> schedule.getEntries().stream()
                            .filter(entry -> !entry.getScheduleDate().isBefore(weekStart)
                                    && !entry.getScheduleDate().isAfter(weekEnd))
                            .forEach(result::add));
        }
        result.sort(Comparator.comparing(MemberScheduleEntry::getScheduleDate)
                .thenComparingInt(MemberScheduleEntry::getOrderInDay));
        return result;
    }

    /**
     * Các tháng mà tuần [weekStart, weekEnd] chạm tới — 1 hoặc 2 tháng.
     *
     * Dùng {@link LinkedHashSet} chứ không dùng {@code Set.of(...)}: khi tuần
     * nằm trọn trong một tháng thì hai phần tử trùng nhau và {@code Set.of}
     * ném {@link IllegalArgumentException}.
     */
    private Set<LocalDate> monthsOfWeek(LocalDate weekStart, LocalDate weekEnd) {
        Set<LocalDate> months = new LinkedHashSet<>();
        months.add(firstOfMonth(weekStart));
        months.add(firstOfMonth(weekEnd));
        return months;
    }

    /**
     * Số ngày tập tối đa mỗi tuần của member.
     *
     * <p>Nguồn chính là {@code member_profiles.days_per_week} — member tự chọn
     * ở profile/onboarding và đó là số buổi mà lịch tập được dựng theo.</p>
     *
     * <p>Nếu member đã lưu lịch với một template nhiều buổi hơn thì lấy giá trị
     * đó, để không khóa chính lịch họ đang dùng.</p>
     */
    private int maxDaysPerWeek(User user) {
        int fromProfile = memberDaysPerWeek(user);
        Optional<Integer> fromSchedule = weekSchedules(user).stream()
                .map(MemberSchedule::getTemplate)
                .filter(template -> template != null)
                .map(DailyPlanTemplate::getDaysPerWeek)
                .findFirst();
        return fromSchedule.map(days -> Math.max(days, fromProfile)).orElse(fromProfile);
    }

    /**
     * Lịch của các tháng mà tuần hiện tại chạm tới — 1 hoặc 2 tháng.
     *
     * Tuần có thể nằm ở tháng hiện tại và tháng kế tiếp (ví dụ hôm nay là
     * 30/11 thì tuần chạy tới 06/12), nên không thể chỉ lấy "tháng hiện tại +
     * tháng trước" — nếu không sẽ bỏ sót template đã gắn cho tháng kế tiếp.
     */
    private List<MemberSchedule> weekSchedules(User user) {
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.with(DayOfWeek.MONDAY);
        List<MemberSchedule> result = new ArrayList<>();
        for (LocalDate month : monthsOfWeek(weekStart, weekStart.plusDays(6))) {
            schedules.findByUserIdAndPlanMonth(user.getId(), month).ifPresent(result::add);
        }
        return result;
    }

    /**
     * Lưu (upsert) lịch của tháng chứa {@code request.month()}.
     *
     * @deprecated Màn "Workout schedule" giờ chỉ chỉnh tuần hiện tại nên dùng
     *             {@link #saveWeek(String, SaveWeekRequest)}. Endpoint này giữ lại
     *             cho tương thích và chỉ nhận entry trong tháng được chỉ định.
     */
    @Transactional
    public MemberScheduleResponse save(String email, SaveScheduleRequest request) {
        if (request == null || request.month() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Month is required");
        }
        LocalDate month = firstOfMonth(request.month());
        User user = loadUser(email);

        MemberSchedule schedule = findOrCreateSchedule(user, month);

        if (request.templateCode() != null && !request.templateCode().isBlank()) {
            schedule.setTemplate(templates.findByCode(request.templateCode().trim())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Training plan template not found: " + request.templateCode())));
        }

        // Xoá lịch cũ và flush NGAY: nếu chỉ clear() rồi addAll(), Hibernate sẽ
        // INSERT dòng mới trước khi DELETE dòng cũ và đụng unique key theo ngày.
        schedule.getEntries().clear();
        schedules.saveAndFlush(schedule);

        List<MemberScheduleEntry> entries = buildEntries(schedule, request.entries());
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

    /**
     * Số buổi tập mỗi tuần member đăng ký trong hồ sơ (profile / onboarding).
     * Đây là nguồn quyết định lịch tập: template active được chọn theo level và
     * đúng số buổi này, thay vì template bất kỳ của level đó.
     */
    private int memberDaysPerWeek(User user) {
        return profiles.findByUserId(user.getId())
                .map(MemberProfile::getDaysPerWeek)
                .filter(days -> days > 0)
                .orElse(DEFAULT_MAX_DAYS_PER_WEEK);
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

    /**
     * Dựng các entry cho một tháng từ danh sách request đã được validate.
     * Ràng buộc tuần đã được kiểm tra ở {@link #validateWeekEntries}.
     */
    private List<MemberScheduleEntry> buildEntries(
            MemberSchedule schedule,
            List<ScheduleEntryRequest> requests) {

        if (requests == null || requests.isEmpty()) {
            return new ArrayList<>();
        }

        LocalDate monthStart = firstOfMonth(schedule.getPlanMonth());
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
        List<TodayExerciseResponse> exercises = workout.getExercises().stream()
                .map(this::toTodayExercise)
                .toList();
        return new ScheduleEntryResponse(
                entry.getId(),
                entry.getScheduleDate(),
                workout.getCode(),
                workout.getName(),
                workout.getLevel(),
                primaryCategory(workout),
                estimatedMinutes(workout),
                exercises.size(),
                entry.getOrderInDay(),
                entry.getStatus(),
                exercises);
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
