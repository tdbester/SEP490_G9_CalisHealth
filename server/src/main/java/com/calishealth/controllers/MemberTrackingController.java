package com.calishealth.controllers;

import com.calishealth.dtos.MemberTrackingDtos.*;
import com.calishealth.service.MemberTrackingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/member/tracking")
@RequiredArgsConstructor
@Validated
@Tag(name = "Member Tracking", description = "Các API phục vụ theo dõi sức khỏe và lịch sử luyện tập của thành viên")
public class MemberTrackingController {

    private final MemberTrackingService trackingService;

    @Operation(summary = "Màn 5.1: Health Tracking Overview", description = "Lấy điểm Health Score, chỉ số cơ thể hiện tại và lịch sử BMI 6 tháng gần nhất")
    @GetMapping("/overview")
    public HealthTrackingOverviewResponse getOverview(Authentication authentication) {
        return trackingService.getOverview(authentication.getName());
    }

    @Operation(summary = "Màn 5.2: Cập nhật chỉ số cơ thể (Body Measurements)", description = "Cập nhật cân nặng và chiều cao mới, tự động tính BMI và lưu lịch sử biến thiên")
    @PostMapping("/measurements")
    @ResponseStatus(HttpStatus.CREATED)
    public BodyMetricsDto updateMeasurements(
            Authentication authentication,
            @Valid @RequestBody UpdateMeasurementsRequest request
    ) {
        return trackingService.recordMeasurements(authentication.getName(), request);
    }

    @Operation(summary = "Màn 5.3: Lịch sử luyện tập (Workout History)", description = "Lấy danh sách các buổi tập đã hoàn thành, hỗ trợ lọc theo thể loại và ngày, kèm bộ 3 chỉ số tổng hợp")
    @GetMapping("/workout-history")
    public WorkoutHistoryResponse getWorkoutHistory(
            Authentication authentication,
            @RequestParam(required = false, defaultValue = "all") String category,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return trackingService.getWorkoutHistory(authentication.getName(), category, date);
    }

    @Operation(summary = "Màn 5.4: Chi tiết nhật ký buổi tập (Workout Log)", description = "Xem chi tiết các bài tập, sets, reps và thời gian thực hiện của một buổi tập cụ thể")
    @GetMapping("/workout-sessions/{sessionId}")
    public WorkoutSessionDetailResponse getWorkoutSessionDetail(
            Authentication authentication,
            @PathVariable Long sessionId
    ) {
        return trackingService.getWorkoutSessionDetail(authentication.getName(), sessionId);
    }

    @Operation(summary = "Màn 5.5: Phân tích hiệu suất tập luyện (Performance Analytics)", description = "Phân tích tỉ lệ lỗi form AI, clean rep ratio, tiến độ volume và phân bố thời gian theo dải 1M, 3M, 1Y")
    @GetMapping("/analytics")
    public PerformanceAnalyticsResponse getAnalytics(
            Authentication authentication,
            @RequestParam(defaultValue = "1M")
            @Pattern(regexp = "^(?i)(1M|3M|1Y)$", message = "Khoảng thời gian (range) chỉ chấp nhận: 1M, 3M hoặc 1Y")
            String range
    ) {
        return trackingService.getPerformanceAnalytics(authentication.getName(), range);
    }
}
