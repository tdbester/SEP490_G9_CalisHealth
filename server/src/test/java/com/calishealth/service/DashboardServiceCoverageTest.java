package com.calishealth.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho {@link DashboardService}: dựng payload dashboard (skills, community,
 * health metrics) và các nhánh BMI.
 */
class DashboardServiceCoverageTest {

    private JdbcTemplate jdbcTemplate;
    private MuscleGroupStatsService muscleGroupStatsService;
    private DashboardService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = mock(JdbcTemplate.class);
        muscleGroupStatsService = mock(MuscleGroupStatsService.class);
        service = new DashboardService(jdbcTemplate, muscleGroupStatsService);
        when(muscleGroupStatsService.findAll()).thenReturn(List.of());
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class))).thenReturn(0L);
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), any(Object[].class)))
                .thenReturn(3L);
        when(jdbcTemplate.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of());
        when(jdbcTemplate.query(anyString(), any(RowMapper.class))).thenReturn(List.of());
    }

    @Test
    @DisplayName("getDashboard: email rong -> khoi tao rong")
    void dashboardForAnonymousUser() {
        var node = service.getDashboard("  ");

        assertThat(node.has("muscleGroups")).isTrue();
        assertThat(node.has("skills")).isTrue();
        assertThat(node.has("community")).isTrue();
        assertThat(node.get("healthMetrics").isEmpty()).isTrue();
    }

    @Test
    @DisplayName("getDashboard: anonymousUser -> khoi tao rong")
    void dashboardForAnonymousUserKeyword() {
        assertThat(service.getDashboard("anonymousUser").get("healthMetrics").isEmpty()).isTrue();
    }

    @Test
    @DisplayName("getDashboard: community -> so lieu 0 khi truy van tra null")
    void communityCountsDefaultToZero() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class))).thenReturn(null);

        var community = service.getDashboard(null).get("community");

        assertThat(community.get("workouts").asInt()).isZero();
        assertThat(community.get("athletes").asInt()).isZero();
        assertThat(community.get("exercises").asInt()).isZero();
    }

    @Test
    @DisplayName("getDashboard: skills -> ton mau theo vong lap")
    void skillsCycleTones() {
        when(jdbcTemplate.query(anyString(), any(RowMapper.class))).thenAnswer(invocation -> {
            RowMapper<?> mapper = invocation.getArgument(1);
            var rs = mock(java.sql.ResultSet.class);
            when(rs.getLong("id")).thenReturn(1L, 2L, 3L, 4L, 5L, 6L, 7L, 8L, 9L);
            when(rs.getString("name")).thenReturn("Tuck Front Lever", "Advanced Front Lever");
            when(rs.getInt("step_count")).thenReturn(3);
            when(rs.getString("difficulty_level")).thenReturn("Beginner");
            return List.of(mapper.mapRow(rs, 0), mapper.mapRow(rs, 1));
        });

        var skills = service.getDashboard(null).get("skills");

        assertThat(skills.size()).isEqualTo(2);
        assertThat(skills.get(0).get("id").asString()).isEqualTo("tuck-front-lever");
        assertThat(skills.get(0).get("tone").asString()).isEqualTo("purple");
        assertThat(skills.get(1).get("tone").asString()).isEqualTo("blue");
    }

    @Test
    @DisplayName("getDashboard: health metrics -> lay buoc do moi nhat")
    void healthMetricsReadsLatestMeasurement() {
        when(jdbcTemplate.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
            RowMapper<?> mapper = invocation.getArgument(1);
            var rs = mock(java.sql.ResultSet.class);
            when(rs.getBigDecimal("weight_kg")).thenReturn(new BigDecimal("70.5"));
            when(rs.getBigDecimal("height_cm")).thenReturn(new BigDecimal("175"));
            when(rs.getBigDecimal("bmi")).thenReturn(new BigDecimal("23.04"));
            return List.of(mapper.mapRow(rs, 0));
        });
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class))).thenReturn(3L);

        var metrics = service.getDashboard("member@x.com").get("healthMetrics");

        assertThat(metrics.get("weight").asDouble()).isEqualTo(70.5);
        assertThat(metrics.get("bmi").asDouble()).isEqualTo(23.0);
        assertThat(metrics.get("bmiLabel").asString()).isEqualTo("Normal");
        assertThat(metrics.get("weeklyGoal").asInt()).isEqualTo(50);
    }

    @Test
    @DisplayName("getDashboard: BMI duoi 18.5 -> Underweight")
    void bmiUnderweightLabel() {
        when(jdbcTemplate.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
            RowMapper<?> mapper = invocation.getArgument(1);
            var rs = mock(java.sql.ResultSet.class);
            when(rs.getBigDecimal("bmi")).thenReturn(new BigDecimal("17.0"));
            return List.of(mapper.mapRow(rs, 0));
        });

        assertThat(service.getDashboard("m@x.com").get("healthMetrics").get("bmiLabel").asString())
                .isEqualTo("Underweight");
    }

    @Test
    @DisplayName("getDashboard: BMI 25-30 -> Overweight")
    void bmiOverweightLabel() {
        when(jdbcTemplate.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
            RowMapper<?> mapper = invocation.getArgument(1);
            var rs = mock(java.sql.ResultSet.class);
            when(rs.getBigDecimal("bmi")).thenReturn(new BigDecimal("27.0"));
            return List.of(mapper.mapRow(rs, 0));
        });

        assertThat(service.getDashboard("m@x.com").get("healthMetrics").get("bmiLabel").asString())
                .isEqualTo("Overweight");
    }

    @Test
    @DisplayName("getDashboard: BMI >= 30 -> Obesity")
    void bmiObesityLabel() {
        when(jdbcTemplate.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
            RowMapper<?> mapper = invocation.getArgument(1);
            var rs = mock(java.sql.ResultSet.class);
            when(rs.getBigDecimal("bmi")).thenReturn(new BigDecimal("31.5"));
            return List.of(mapper.mapRow(rs, 0));
        });

        assertThat(service.getDashboard("m@x.com").get("healthMetrics").get("bmiLabel").asString())
                .isEqualTo("Obesity");
    }

    @Test
    @DisplayName("getDashboard: weekly goal > 6 buoi -> gioi han 100")
    void weeklyGoalIsCapped() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class))).thenReturn(12L);
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), any(Object[].class)))
                .thenReturn(12L);

        assertThat(service.getDashboard("m@x.com").get("healthMetrics").get("weeklyGoal").asInt())
                .isEqualTo(100);
    }

    @Test
    @DisplayName("getDashboard: khong co do do -> chi con weeklyGoal")
    void healthMetricsWithoutMeasurement() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), any(Object[].class)))
                .thenReturn(0L);
        var metrics = service.getDashboard("m@x.com").get("healthMetrics");

        assertThat(metrics.has("weight")).isFalse();
        assertThat(metrics.has("bmi")).isFalse();
        assertThat(metrics.get("weeklyGoal").asInt()).isZero();
    }
}
