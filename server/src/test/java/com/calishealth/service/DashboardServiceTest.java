package com.calishealth.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {
    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private MuscleGroupStatsService muscleGroupStatsService;

    private DashboardService dashboardService() {
        when(muscleGroupStatsService.findAll()).thenReturn(List.of());
        return new DashboardService(jdbcTemplate, muscleGroupStatsService);
    }

    @Test
    void communityStatsQueryWorkoutEntriesCreatedByMembers() {
        doReturn(List.of()).when(jdbcTemplate).query(anyString(), any(RowMapper.class));
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class))).thenReturn(0L);

        dashboardService().getDashboard(null);

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate, org.mockito.Mockito.times(3))
                .queryForObject(sqlCaptor.capture(), eq(Long.class));

        assertTrue(sqlCaptor.getAllValues().stream()
                .anyMatch(sql -> sql.contains("workout_entries")
                        && sql.contains("is_shared_with_community")));
        // V29 dropped the legacy `is_system` / `author_id` columns; community is defined by source.
        assertTrue(sqlCaptor.getAllValues().stream()
                .anyMatch(sql -> sql.contains("workout_entries")
                        && sql.contains("source = 'CUSTOM'")));
        assertTrue(sqlCaptor.getAllValues().stream()
                .filter(sql -> sql.contains("FROM exercises"))
                .allMatch(sql -> sql.contains("moderation_status")
                        && !sql.contains("e.status = 'ACCEPTED'")
                        && !sql.contains("AND status = 'ACCEPTED'")));
        assertTrue(sqlCaptor.getAllValues().stream()
                .noneMatch(sql -> sql.contains("author_id") || sql.contains("is_system")));
    }

    @Test
    void exerciseDashboardQueriesMatchLibraryVisibilityRules() {
        doReturn(List.of()).when(jdbcTemplate).query(anyString(), any(RowMapper.class));
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class))).thenReturn(0L);

        dashboardService().getDashboard(null);

        // Muscle Focus now comes from MuscleGroupStatsService (shared with the Library
        // MUSCLE GROUP sidebar), so only the curated SKILL query still runs here.
        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate, org.mockito.Mockito.times(1))
                .query(sqlCaptor.capture(), any(RowMapper.class));

        String skillSql = sqlCaptor.getValue();
        assertTrue(skillSql.contains("source = 'SYSTEM'")
                && skillSql.contains("active = TRUE")
                && skillSql.contains("UPPER(e.moderation_status) IN ('ACTIVE', 'ACCEPTED')"));
        // Two representative skills per target_skill entry point (easiest + next step).
        assertTrue(skillSql.contains("target_skill IS NOT NULL")
                && skillSql.contains("rank_in_skill <= 2"));
        // Seeded duplicates (same skill name twice) must be collapsed before ranking.
        assertTrue(skillSql.contains("rank_in_name = 1"));
        // Cards without guide text would render a meaningless "0 steps".
        assertTrue(skillSql.contains("dedup.guide_text IS NOT NULL"));
        // No legacy columns removed by V29 may reappear in any dashboard query.
        assertTrue(sqlCaptor.getAllValues().stream()
                .noneMatch(sql -> sql.contains("muscle_group ")
                        || sql.contains("author_id")
                        || sql.contains("is_system")));
    }

    @Test
    void muscleFocusUsesSharedMuscleGroupCatalog() {
        doReturn(List.of()).when(jdbcTemplate).query(anyString(), any(RowMapper.class));
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class))).thenReturn(0L);
        when(muscleGroupStatsService.findAll()).thenReturn(List.of(
                new MuscleGroupStatsService.MuscleGroupStat(3L, "chest", "Chest", "fitness", "purple", 13, 2),
                new MuscleGroupStatsService.MuscleGroupStat(4L, "skill-only", "Neck", "fitness", "blue", 0, 4)
        ));

        var dashboard = new DashboardService(jdbcTemplate, muscleGroupStatsService).getDashboard(null);

        // Cards open the Health tab, so groups without HEALTH exercises are hidden and the
        // count shown must be the HEALTH count only.
        var groups = dashboard.get("muscleGroups");
        assertTrue(groups.size() == 1);
        assertTrue("Chest".equals(groups.get(0).get("name").asString()));
        assertTrue(groups.get(0).get("count").asInt() == 13);
    }
}
