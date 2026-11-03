package com.calishealth.controllers;

import com.calishealth.dtos.MemberScheduleDtos.AvailableWorkoutResponse;
import com.calishealth.dtos.MemberScheduleDtos.MemberScheduleResponse;
import com.calishealth.dtos.MemberScheduleDtos.PlanInfoResponse;
import com.calishealth.dtos.MemberScheduleDtos.SaveScheduleRequest;
import com.calishealth.dtos.MemberScheduleDtos.TodayWorkoutResponse;
import com.calishealth.service.MemberScheduleService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * Member tự xếp lịch tập theo tháng (màn "Workout schedule" và "Review workout plan").
 * Bảo vệ bởi Spring Security: chỉ cần đăng nhập, dữ liệu luôn lọc theo user trong token.
 */
@RestController
@RequestMapping("/api/member/schedule")
@RequiredArgsConstructor
public class MemberScheduleController {
    private final MemberScheduleService scheduleService;

    /** Sidebar trái: workout có thể kéo vào lịch. */
    @GetMapping("/workouts")
    public List<AvailableWorkoutResponse> availableWorkouts(Authentication authentication) {
        return scheduleService.availableWorkouts(authentication.getName());
    }

    /** Thẻ "Plan info" của màn Review. Trả null khi member chưa có template phù hợp. */
    @GetMapping("/plan-info")
    public PlanInfoResponse planInfo(Authentication authentication) {
        return scheduleService.planInfo(authentication.getName()).orElse(null);
    }

    /** Lưu lịch tháng (upsert theo tháng). */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MemberScheduleResponse save(
            @RequestBody SaveScheduleRequest request,
            Authentication authentication) {
        return scheduleService.save(authentication.getName(), request);
    }

    /** Lịch của tháng hiện tại; null khi chưa xếp. */
    @GetMapping("/current")
    public MemberScheduleResponse current(Authentication authentication) {
        return scheduleService.currentSchedule(authentication.getName()).orElse(null);
    }

    /** Lịch của tháng chứa {@code month}; null khi chưa xếp. */
    @GetMapping
    public MemberScheduleResponse byMonth(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate month,
            Authentication authentication) {
        return scheduleService.monthSchedule(authentication.getName(), month).orElse(null);
    }

    /** Buổi tập đã xếp cho hôm nay (màn "Daily workout plan"); rỗng khi là Rest day. */
    @GetMapping("/today")
    public List<TodayWorkoutResponse> today(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            Authentication authentication) {
        return scheduleService.todayWorkouts(authentication.getName(), date);
    }

    @GetMapping("/all")
    public List<MemberScheduleResponse> all(Authentication authentication) {
        return scheduleService.allSchedules(authentication.getName());
    }

    /** Đánh dấu hoàn thành / bỏ qua buổi tập của một ngày. */
    @PatchMapping("/status")
    public MemberScheduleResponse updateStatus(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam String status,
            Authentication authentication) {
        return scheduleService.updateStatus(authentication.getName(), date, status);
    }
}
