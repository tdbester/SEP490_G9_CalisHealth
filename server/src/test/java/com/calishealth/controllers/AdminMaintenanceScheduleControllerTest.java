package com.calishealth.controllers;

import com.calishealth.dtos.CreateMaintenanceScheduleRequestDto;
import com.calishealth.service.MaintenanceScheduleService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AdminMaintenanceScheduleControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MaintenanceScheduleService schedules;

    @Test
    void turnsADatabaseConstraintFailureIntoAReadableBadRequest() throws Exception {
        doThrow(new DataIntegrityViolationException(
                "could not execute statement [Data truncation: Data too long for column 'message' at row 1]"
                        + " [insert into notifications ...]; SQL [insert into notifications ...]"))
                .when(schedules).create(any(CreateMaintenanceScheduleRequestDto.class), anyString());

        mockMvc.perform(post("/api/admin/maintenance-schedules")
                        .with(SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN"))
                        .contentType("application/json")
                        .content("""
                                {
                                  "title": "Database upgrade",
                                  "message": "Too long",
                                  "startsAt": "2026-12-01T02:00:00",
                                  "endsAt": "2026-12-01T04:00:00",
                                  "affectedAreas": ["MEMBER_APP_ACCESS"],
                                  "notifyMembers": true,
                                  "reminderHours": 24
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail").value(
                        "could not execute statement [Data truncation: Data too long for column 'message' at row 1]"));
    }

    @Test
    void rejectsAMessageLongerThanTheAllowedLimit() throws Exception {
        mockMvc.perform(post("/api/admin/maintenance-schedules")
                        .with(SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN"))
                        .contentType("application/json")
                        .content("""
                                {
                                  "title": "Database upgrade",
                                  "message": "%s",
                                  "startsAt": "2026-12-01T02:00:00",
                                  "endsAt": "2026-12-01T04:00:00",
                                  "affectedAreas": ["MEMBER_APP_ACCESS"],
                                  "notifyMembers": true,
                                  "reminderHours": 24
                                }
                                """.formatted("x".repeat(2001))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.message")
                        .value("Message must not exceed 2000 characters"));
    }

    @Test
    void createsAScheduleWithAValidPayload() throws Exception {
        mockMvc.perform(post("/api/admin/maintenance-schedules")
                        .with(SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN"))
                        .contentType("application/json")
                        .content("""
                                {
                                  "title": "Database upgrade",
                                  "message": "Improving performance.",
                                  "startsAt": "2026-12-01T02:00:00",
                                  "endsAt": "2026-12-01T04:00:00",
                                  "affectedAreas": ["MEMBER_APP_ACCESS"],
                                  "notifyMembers": true,
                                  "reminderHours": 24
                                }
                                """))
                .andExpect(status().isCreated());
    }

    @Test
    void filtersTheListByTheDayTheMaintenanceStarts() throws Exception {
        when(schedules.getSchedules(0, "upgrade", LocalDateTime.of(2026, 11, 20, 0, 0),
                LocalDateTime.of(2026, 11, 20, 23, 59, 59)))
                .thenReturn(Page.empty(PageRequest.of(0, 5)));

        mockMvc.perform(get("/api/admin/maintenance")
                        .with(SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN"))
                        .param("title", "upgrade")
                        .param("startsFrom", "2026-11-20T00:00:00")
                        .param("startsBefore", "2026-11-20T23:59:59"))
                .andExpect(status().isOk());

        verify(schedules).getSchedules(0, "upgrade", LocalDateTime.of(2026, 11, 20, 0, 0),
                LocalDateTime.of(2026, 11, 20, 23, 59, 59));
    }
}
