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

    @Test
    void communityStatsQueryWorkoutEntriesCreatedByMembers() {
        doReturn(List.of()).when(jdbcTemplate).query(anyString(), any(RowMapper.class));
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class))).thenReturn(0L);

        new DashboardService(jdbcTemplate).getDashboard(null);

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate, org.mockito.Mockito.times(3))
                .queryForObject(sqlCaptor.capture(), eq(Long.class));

        assertTrue(sqlCaptor.getAllValues().stream()
                .allMatch(sql -> sql.contains("workout_entries")
                        && sql.contains("created_by")));
    }

    @Test
    void exerciseDashboardQueriesIncludeAcceptedLibrarySeeds() {
        doReturn(List.of()).when(jdbcTemplate).query(anyString(), any(RowMapper.class));
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class))).thenReturn(0L);

        new DashboardService(jdbcTemplate).getDashboard(null);

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate, org.mockito.Mockito.times(2))
                .query(sqlCaptor.capture(), any(RowMapper.class));

        assertTrue(sqlCaptor.getAllValues().stream()
                .allMatch(sql -> sql.contains("e.moderation_status = 'ACTIVE'")));
    }
}
