package com.calishealth.service;

import com.calishealth.dtos.MemberTrackingDtos.BmiMonthRecordDto;
import com.calishealth.dtos.MemberTrackingDtos.BodyMetricsDto;
import com.calishealth.dtos.MemberTrackingDtos.ExerciseDetailDto;
import com.calishealth.dtos.MemberTrackingDtos.HealthScoreDto;
import com.calishealth.dtos.MemberTrackingDtos.HealthTrackingOverviewResponse;
import com.calishealth.dtos.MemberTrackingDtos.PerformanceAnalyticsResponse;
import com.calishealth.dtos.MemberTrackingDtos.UpdateMeasurementsRequest;
import com.calishealth.dtos.MemberTrackingDtos.WorkoutHistoryResponse;
import com.calishealth.dtos.MemberTrackingDtos.WorkoutSessionDetailResponse;
import com.calishealth.repository.MemberTrackingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test cho {@link MemberTrackingService}: tổng quan sức khoẻ, ghi số đo,
 * lịch sử tập và chống truy cập chéo (IDOR).
 */
class MemberTrackingServiceTest {

    private MemberTrackingRepository repository;
    private MemberTrackingService service;

    private static final String EMAIL = "member@calishealth.vn";
    private static final Long PROFILE_ID = 7L;

    @BeforeEach
    void setUp() {
        repository = mock(MemberTrackingRepository.class);
        service = new MemberTrackingService(repository);
        when(repository.findProfileIdByEmail(EMAIL)).thenReturn(Optional.of(PROFILE_ID));
    }

    // -------------------------------------------------------------------- BMI

    @Test
    @DisplayName("calculateBmi: tinh dung chi so BMI")
    void calculateBmiComputesValue() {
        BigDecimal bmi = MemberTrackingService.calculateBmi(new BigDecimal("70"), new BigDecimal("175"));

        assertThat(bmi).isEqualByComparingTo("22.9");
    }

    @Test
    @DisplayName("calculateBmi: thieu so do -> null")
    void calculateBmiReturnsNullForMissingValues() {
        assertThat(MemberTrackingService.calculateBmi(null, new BigDecimal("175"))).isNull();
        assertThat(MemberTrackingService.calculateBmi(new BigDecimal("70"), null)).isNull();
        assertThat(MemberTrackingService.calculateBmi(new BigDecimal("70"), BigDecimal.ZERO)).isNull();
    }

    // ---------------------------------------------------------------- overview

    @Test
    @DisplayName("getOverview: BMI duoi 18.5 -> Underweight")
    void getOverviewClassifiesUnderweight() {
        stubOverview(new BodyMetricsDto(new BigDecimal("50"), new BigDecimal("180"), null, null, null, null));

        HealthTrackingOverviewResponse response = service.getOverview(EMAIL);

        assertThat(response.bmiOverview().classification()).isEqualTo("Underweight");
        assertThat(response.bmiOverview().tone()).isEqualTo("warning");
    }

    @Test
    @DisplayName("getOverview: BMI trong khoang 18.5-25 -> Healthy")
    void getOverviewClassifiesHealthy() {
        stubOverview(new BodyMetricsDto(new BigDecimal("70"), new BigDecimal("175"), null, null, null, null));

        HealthTrackingOverviewResponse response = service.getOverview(EMAIL);

        assertThat(response.bmiOverview().classification()).isEqualTo("Healthy");
        assertThat(response.bmiOverview().tone()).isEqualTo("healthy");
    }

    @Test
    @DisplayName("getOverview: BMI tu 25-30 -> Overweight")
    void getOverviewClassifiesOverweight() {
        stubOverview(new BodyMetricsDto(new BigDecimal("85"), new BigDecimal("170"), null, null, null, null));

        HealthTrackingOverviewResponse response = service.getOverview(EMAIL);

        assertThat(response.bmiOverview().classification()).isEqualTo("Overweight");
    }

    @Test
    @DisplayName("getOverview: BMI tu 30 tro len -> Obese")
    void getOverviewClassifiesObese() {
        stubOverview(new BodyMetricsDto(new BigDecimal("110"), new BigDecimal("170"), null, null, null, null));

        HealthTrackingOverviewResponse response = service.getOverview(EMAIL);

        assertThat(response.bmiOverview().classification()).isEqualTo("Obese");
        assertThat(response.bmiOverview().tone()).isEqualTo("danger");
    }

    @Test
    @DisplayName("getOverview: chua co so do -> classification mac dinh")
    void getOverviewWithoutMeasurements() {
        stubOverview(null);

        HealthTrackingOverviewResponse response = service.getOverview(EMAIL);

        assertThat(response.bmiOverview().classification()).isEqualTo("Healthy");
        assertThat(response.bmiOverview().currentBmi()).isNull();
        assertThat(response.bmiOverview().latestReadingTimestamp()).isNull();
    }

    @Test
    @DisplayName("getOverview: co ban ghi BMI -> gan timestamp moi nhat")
    void getOverviewWithBmiRecords() {
        stubOverview(new BodyMetricsDto(new BigDecimal("70"), new BigDecimal("175"), null, null, null, null));
        when(repository.findBmiRecordsLast6Months(PROFILE_ID)).thenReturn(List.of(
                new BmiMonthRecordDto("2026-01", new BigDecimal("23.0"))));

        HealthTrackingOverviewResponse response = service.getOverview(EMAIL);

        assertThat(response.bmiOverview().records()).hasSize(1);
        assertThat(response.bmiOverview().latestReadingTimestamp()).isNotNull();
        verify(repository).syncFromSurveyIfMissing(PROFILE_ID);
    }

    @Test
    @DisplayName("getOverview: khong tim thay ho so -> 404")
    void getOverviewRequiresProfile() {
        when(repository.findProfileIdByEmail("nobody@calishealth.vn")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getOverview("nobody@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.NOT_FOUND));
    }

    // ------------------------------------------------------- recordMeasurements

    @Test
    @DisplayName("recordMeasurements: luu so do va cap nhat profile")
    void recordMeasurementsSavesAndUpdates() {
        when(repository.calculateWeightChangeThisMonth(PROFILE_ID, new BigDecimal("70.5")))
                .thenReturn(new BigDecimal("1.5"));

        BodyMetricsDto result = service.recordMeasurements(EMAIL,
                new UpdateMeasurementsRequest(new BigDecimal("70.5"), new BigDecimal("175"), "  note  "));

        assertThat(result.weightChangeKg()).isEqualByComparingTo("1.5");
        assertThat(result.weightNote()).isEqualTo("+1.5 kg this month");
        verify(repository).saveBodyMetric(eq(PROFILE_ID), eq(new BigDecimal("70.5")), eq(new BigDecimal("175")),
                any(BigDecimal.class), eq("note"));
        verify(repository).updateMemberProfileMeasurements(PROFILE_ID, new BigDecimal("70.5"), new BigDecimal("175"));
    }

    @Test
    @DisplayName("recordMeasurements: giam can -> khong co dau cong")
    void recordMeasurementsNegativeChange() {
        when(repository.calculateWeightChangeThisMonth(PROFILE_ID, new BigDecimal("68.0")))
                .thenReturn(new BigDecimal("-2.0"));

        BodyMetricsDto result = service.recordMeasurements(EMAIL,
                new UpdateMeasurementsRequest(new BigDecimal("68.0"), new BigDecimal("175"), null));

        assertThat(result.weightNote()).isEqualTo("-2.0 kg this month");
        verify(repository).saveBodyMetric(eq(PROFILE_ID), any(BigDecimal.class), any(BigDecimal.class),
                any(BigDecimal.class), eq("Member updated stats via web"));
    }

    @Test
    @DisplayName("recordMeasurements: khong co thay doi -> khong co ghi chu")
    void recordMeasurementsWithoutChange() {
        when(repository.calculateWeightChangeThisMonth(PROFILE_ID, new BigDecimal("70.0"))).thenReturn(null);

        BodyMetricsDto result = service.recordMeasurements(EMAIL,
                new UpdateMeasurementsRequest(new BigDecimal("70.0"), new BigDecimal("175"), null));

        assertThat(result.weightNote()).isNull();
    }

    @Test
    @DisplayName("recordMeasurements: chieu cao khong hop le -> 400")
    void recordMeasurementsRejectsInvalidHeight() {
        assertThatThrownBy(() -> service.recordMeasurements(EMAIL,
                new UpdateMeasurementsRequest(new BigDecimal("70"), BigDecimal.ZERO, null)))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    // ------------------------------------------------------------ workout history

    @Test
    @DisplayName("getWorkoutHistory: tra ve lich su tap")
    void getWorkoutHistoryDelegatesToRepository() {
        WorkoutHistoryResponse history = new WorkoutHistoryResponse(null, List.of());
        when(repository.findWorkoutHistory(PROFILE_ID, "HEALTH", LocalDate.of(2026, 1, 5)))
                .thenReturn(history);

        assertThat(service.getWorkoutHistory(EMAIL, "HEALTH", LocalDate.of(2026, 1, 5))).isSameAs(history);
    }

    // ---------------------------------------------------------- session detail

    @Test
    @DisplayName("getWorkoutSessionDetail: buoi tap khong ton tai -> 404")
    void getWorkoutSessionDetailNotFound() {
        when(repository.findWorkoutSessionDetail(9L)).thenReturn(null);

        assertThatThrownBy(() -> service.getWorkoutSessionDetail(EMAIL, 9L))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("getWorkoutSessionDetail: buoi tap cua member khac -> 403")
    void getWorkoutSessionDetailRejectsForeignSession() {
        when(repository.findWorkoutSessionDetail(9L)).thenReturn(sessionDetail());
        when(repository.isSessionOwnedByMember(9L, PROFILE_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.getWorkoutSessionDetail(EMAIL, 9L))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    @DisplayName("getWorkoutSessionDetail: buoi tap cua member -> tra ve chi tiet")
    void getWorkoutSessionDetailReturnsOwnedSession() {
        when(repository.findWorkoutSessionDetail(9L)).thenReturn(sessionDetail());
        when(repository.isSessionOwnedByMember(9L, PROFILE_ID)).thenReturn(true);

        WorkoutSessionDetailResponse result = service.getWorkoutSessionDetail(EMAIL, 9L);

        assertThat(result.id()).isEqualTo(9L);
        assertThat(result.exercises()).hasSize(1);
    }

    // ---------------------------------------------------------------- analytics

    @Test
    @DisplayName("getPerformanceAnalytics: khoang rong -> mac dinh 1M")
    void getPerformanceAnalyticsDefaultsRange() {
        when(repository.findPerformanceAnalytics(PROFILE_ID, "1M")).thenReturn(new PerformanceAnalyticsResponse(
                "1M", 0, null, null, List.of(), null, null));

        assertThat(service.getPerformanceAnalytics(EMAIL, null).range()).isEqualTo("1M");
        verify(repository).findPerformanceAnalytics(PROFILE_ID, "1M");
    }

    @Test
    @DisplayName("getPerformanceAnalytics: khoang '3m' -> chuan hoa chu hoa")
    void getPerformanceAnalyticsNormalisesRange() {
        when(repository.findPerformanceAnalytics(PROFILE_ID, "3M")).thenReturn(new PerformanceAnalyticsResponse(
                "3M", 2, null, null, List.of(), null, null));

        assertThat(service.getPerformanceAnalytics(EMAIL, " 3m ").range()).isEqualTo("3M");
    }

    // ------------------------------------------------------------------ helpers

    private void stubOverview(BodyMetricsDto metrics) {
        when(repository.findLatestBodyMetrics(PROFILE_ID)).thenReturn(metrics);
        when(repository.findBmiRecordsLast6Months(PROFILE_ID)).thenReturn(List.of());
        when(repository.calculateHealthScore(any(), any())).thenReturn(
                new HealthScoreDto(80, 5, 60, "Tốt", "Bạn đang tập đều"));
    }

    private static WorkoutSessionDetailResponse sessionDetail() {
        return new WorkoutSessionDetailResponse(9L, "Push day", "HEALTH", null, 30, 92,
                List.of(new ExerciseDetailDto(1L, "Push-up", "HEALTH", false, 3, 10, 0, 0.95)));
    }
}
