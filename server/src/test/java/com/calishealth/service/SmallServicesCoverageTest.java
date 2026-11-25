package com.calishealth.service;

import com.calishealth.dtos.AdminDashboardDtos.SystemOverviewResponse;
import com.calishealth.models.Exercise;
import com.calishealth.models.FormRule;
import com.calishealth.models.MuscleGroup;
import com.calishealth.models.Notification;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FormRuleRepository;
import com.calishealth.repository.NotificationRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test cho các service nhỏ còn nhánh chưa chạy:
 * {@link MemberFormRuleService}, {@link AdminDashboardService}, {@link MuscleGroupStatsService},
 * {@link SystemNotificationService}.
 */
class SmallServicesCoverageTest {

    // ------------------------------------------------------- MemberFormRuleService

    @Test
    @DisplayName("MemberFormRuleService: tra ve danh sach rule cua bai tap")
    void formRulesAreReturned() {
        FormRuleRepository formRules = mock(FormRuleRepository.class);
        FormRule rule = new FormRule();
        rule.setId(1L);
        rule.setJoint("KNEE");
        rule.setAngleThreshold(new BigDecimal("120.000"));
        rule.setRomDepth(new BigDecimal("15.500"));
        when(formRules.findByExerciseCode("PUSH_UP")).thenReturn(List.of(rule));

        MemberFormRuleService service = new MemberFormRuleService(formRules);

        var response = service.getFormRules("PUSH_UP");

        assertThat(response.exerciseCode()).isEqualTo("PUSH_UP");
        assertThat(response.rules()).hasSize(1);
        assertThat(response.rules().get(0).joint()).isEqualTo("KNEE");
    }

    @Test
    @DisplayName("MemberFormRuleService: bai tap khong co rule -> danh sach rong")
    void formRulesEmpty() {
        FormRuleRepository formRules = mock(FormRuleRepository.class);
        when(formRules.findByExerciseCode(anyString())).thenReturn(List.of());

        var response = new MemberFormRuleService(formRules).getFormRules("X");

        assertThat(response.rules()).isEmpty();
    }

    // ------------------------------------------------------ AdminDashboardService

    @Test
    @DisplayName("AdminDashboardService: tong hop so lieu he thong")
    void adminDashboardAggregatesCounts() {
        UserRepository users = mock(UserRepository.class);
        ExerciseRepository exercises = mock(ExerciseRepository.class);
        WorkoutRepository workouts = mock(WorkoutRepository.class);
        when(users.count()).thenReturn(10L);
        when(exercises.countAcceptedSystemExercisesByType("SKILL")).thenReturn(4L);
        when(exercises.countAcceptedSystemExercisesByType("HEALTH")).thenReturn(8L);
        when(workouts.countSystemWorkoutsByType("SKILL")).thenReturn(2L);
        when(workouts.countSystemWorkoutsByType("HEALTH")).thenReturn(3L);

        SystemOverviewResponse response = new AdminDashboardService(users, exercises, workouts).getSystemOverview();

        assertThat(response.totalUsers()).isEqualTo(10L);
        assertThat(response.totalSkillExercises()).isEqualTo(4L);
        assertThat(response.totalHealthExercises()).isEqualTo(8L);
        assertThat(response.totalSkillWorkouts()).isEqualTo(2L);
        assertThat(response.totalHealthWorkouts()).isEqualTo(3L);
    }

    // ------------------------------------------------------ MuscleGroupStatsService

    @Test
    @DisplayName("MuscleGroupStatsService: doc danh muc nhom co, fallback code/icon/tone")
    void muscleGroupStatsAppliesFallbacks() throws Exception {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        MuscleGroupStatsService service = new MuscleGroupStatsService(jdbcTemplate);
        stubRow(jdbcTemplate, new Object[]{7L, null, "Chest", null, null, 3L, 1L});

        var stats = service.findAll();

        assertThat(stats).hasSize(1);
        assertThat(stats.get(0).id()).isEqualTo(7L);
        assertThat(stats.get(0).code()).isEqualTo("7");
        assertThat(stats.get(0).name()).isEqualTo("Chest");
        assertThat(stats.get(0).icon()).isEqualTo("fitness");
        assertThat(stats.get(0).tone()).isEqualTo("purple");
        assertThat(stats.get(0).healthCount()).isEqualTo(3L);
        assertThat(stats.get(0).skillCount()).isEqualTo(1L);
    }

    @Test
    @DisplayName("MuscleGroupStatsService: dung gia tri co san khi khong null")
    void muscleGroupStatsKeepsValues() throws Exception {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        MuscleGroupStatsService service = new MuscleGroupStatsService(jdbcTemplate);
        stubRow(jdbcTemplate, new Object[]{1L, "CHEST", "Chest", "chest-icon", "warm", 5L, 2L});

        var stats = service.findAll();

        assertThat(stats.get(0).code()).isEqualTo("CHEST");
        assertThat(stats.get(0).icon()).isEqualTo("chest-icon");
        assertThat(stats.get(0).tone()).isEqualTo("warm");
    }

    @SuppressWarnings("unchecked")
    private static void stubRow(JdbcTemplate jdbcTemplate, Object[] values) throws Exception {
        java.sql.ResultSet resultSet = mock(java.sql.ResultSet.class);
        when(resultSet.getLong("id")).thenReturn((Long) values[0]);
        when(resultSet.getString("dashboard_code")).thenReturn((String) values[1]);
        when(resultSet.getString("name")).thenReturn((String) values[2]);
        when(resultSet.getString("icon_key")).thenReturn((String) values[3]);
        when(resultSet.getString("tone")).thenReturn((String) values[4]);
        when(resultSet.getLong("health_count")).thenReturn((Long) values[5]);
        when(resultSet.getLong("skill_count")).thenReturn((Long) values[6]);

        when(jdbcTemplate.query(anyString(),
                org.mockito.ArgumentMatchers
                        .<org.springframework.jdbc.core.RowMapper<MuscleGroupStatsService.MuscleGroupStat>>any()))
                .thenAnswer(invocation -> {
                    org.springframework.jdbc.core.RowMapper<MuscleGroupStatsService.MuscleGroupStat> mapper =
                            invocation.getArgument(1);
                    return List.of(mapper.mapRow(resultSet, 0));
                });
    }

    // ----------------------------------------------------- SystemNotificationService

    @Test
    @DisplayName("SystemNotificationService: memberId null -> khong tao thong bao")
    void notificationSkipsWhenMemberMissing() {
        NotificationRepository notifications = mock(NotificationRepository.class);

        new SystemNotificationService(notifications).notifyExerciseModeration(null, "Push-up", true, null);

        verify(notifications, never()).save(any(Notification.class));
    }

    @Test
    @DisplayName("SystemNotificationService: thong bao cho content manager")
    void notificationForContentManagers() {
        NotificationRepository notifications = mock(NotificationRepository.class);
        when(notifications.save(any(Notification.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        new SystemNotificationService(notifications).notifyContentManagersPendingApproval("Push-up");

        org.mockito.ArgumentCaptor<Notification> captor =
                org.mockito.ArgumentCaptor.forClass(Notification.class);
        verify(notifications).save(captor.capture());
        assertThat(captor.getValue().getTargetAudience()).isEqualTo("CONTENT_MANAGER");
        assertThat(captor.getValue().getStatus()).isEqualTo("PUBLISHED");
    }
}
