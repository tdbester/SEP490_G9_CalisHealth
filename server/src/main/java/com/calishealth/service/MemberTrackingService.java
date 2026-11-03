package com.calishealth.service;

import com.calishealth.dtos.MemberTrackingDtos.*;
import com.calishealth.repository.MemberTrackingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MemberTrackingService {

    private final MemberTrackingRepository trackingRepository;

    @Transactional
    public HealthTrackingOverviewResponse getOverview(String email) {
        Long profileId = getProfileId(email);

        // Tự động đồng bộ số đo từ completed survey nếu profile chưa có
        trackingRepository.syncFromSurveyIfMissing(profileId);

        // 1. Lấy chỉ số cơ thể mới nhất
        BodyMetricsDto bodyMetrics = trackingRepository.findLatestBodyMetrics(profileId);

        // 2. Lấy danh sách BMI theo 6 tháng gần nhất
        List<BmiMonthRecordDto> bmiRecords = trackingRepository.findBmiRecordsLast6Months(profileId);

        // 3. Tính phân loại BMI hiện tại
        BigDecimal currentBmi = bodyMetrics != null && bodyMetrics.weightKg() != null && bodyMetrics.heightCm() != null
                ? calculateBmi(bodyMetrics.weightKg(), bodyMetrics.heightCm())
                : null;

        String tone = "healthy";
        String classification = "Healthy";
        if (currentBmi != null) {
            double val = currentBmi.doubleValue();
            if (val < 18.5) {
                classification = "Underweight";
                tone = "warning";
            } else if (val < 25.0) {
                classification = "Healthy";
                tone = "healthy";
            } else if (val < 30.0) {
                classification = "Overweight";
                tone = "warning";
            } else {
                classification = "Obese";
                tone = "danger";
            }
        }

        LocalDateTime latestTimestamp = !bmiRecords.isEmpty()
                ? LocalDateTime.now()
                : null;

        BmiOverviewDto bmiOverview = new BmiOverviewDto(
                currentBmi,
                classification,
                tone,
                bmiRecords,
                latestTimestamp
        );

        // 4. Tính toán Health Score
        HealthScoreDto healthScore = trackingRepository.calculateHealthScore(profileId, currentBmi);

        return new HealthTrackingOverviewResponse(healthScore, bodyMetrics, bmiOverview);
    }

    @Transactional
    public BodyMetricsDto recordMeasurements(String email, UpdateMeasurementsRequest request) {
        Long profileId = getProfileId(email);

        BigDecimal bmi = calculateBmi(request.weightKg(), request.heightCm());
        if (bmi == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể tính chỉ số BMI từ số đo đã nhập");
        }

        // Lưu bản ghi vào bảng lịch sử member_body_metrics
        trackingRepository.saveBodyMetric(
                profileId,
                request.weightKg(),
                request.heightCm(),
                bmi,
                request.note() != null ? request.note().trim() : "Member updated stats via web"
        );

        // Cập nhật profile hiện tại
        trackingRepository.updateMemberProfileMeasurements(profileId, request.weightKg(), request.heightCm());

        BigDecimal weightChange = trackingRepository.calculateWeightChangeThisMonth(profileId, request.weightKg());
        String weightNote = weightChange != null
                ? (weightChange.compareTo(BigDecimal.ZERO) > 0 ? "+" : "") + weightChange + " kg this month"
                : null;

        return new BodyMetricsDto(
                request.weightKg(),
                request.heightCm(),
                weightChange,
                weightNote,
                "Healthy range",
                LocalDateTime.now()
        );
    }

    @Transactional(readOnly = true)
    public WorkoutHistoryResponse getWorkoutHistory(String email, String category, LocalDate date) {
        Long profileId = getProfileId(email);
        return trackingRepository.findWorkoutHistory(profileId, category, date);
    }

    @Transactional(readOnly = true)
    public WorkoutSessionDetailResponse getWorkoutSessionDetail(String email, Long sessionId) {
        Long profileId = getProfileId(email);
        WorkoutSessionDetailResponse detail = trackingRepository.findWorkoutSessionDetail(sessionId);

        if (detail == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy buổi tập luyện yêu cầu");
        }

        // Bảo mật IDOR: Xác thực buổi tập thuộc về chính member này
        if (!trackingRepository.isSessionOwnedByMember(sessionId, profileId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền xem chi tiết buổi tập này");
        }

        return detail;
    }

    @Transactional(readOnly = true)
    public PerformanceAnalyticsResponse getPerformanceAnalytics(String email, String range) {
        Long profileId = getProfileId(email);
        String normalizedRange = (range == null || range.isBlank()) ? "1M" : range.trim().toUpperCase();
        return trackingRepository.findPerformanceAnalytics(profileId, normalizedRange);
    }

    private Long getProfileId(String email) {
        return trackingRepository.findProfileIdByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy hồ sơ thành viên"));
    }

    public static BigDecimal calculateBmi(BigDecimal weightKg, BigDecimal heightCm) {
        if (weightKg == null || heightCm == null || heightCm.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        BigDecimal heightM = heightCm.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
        return weightKg.divide(heightM.multiply(heightM), 1, RoundingMode.HALF_UP);
    }
}
