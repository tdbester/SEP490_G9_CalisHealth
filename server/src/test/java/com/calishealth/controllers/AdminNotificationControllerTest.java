package com.calishealth.controllers;

import com.calishealth.dtos.NotificationCountsDto;
import com.calishealth.dtos.CreateNotificationRequestDto;
import com.calishealth.dtos.NotificationListResponseDto;
import com.calishealth.dtos.NotificationResponseDto;
import com.calishealth.dtos.UpdateNotificationRequestDto;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.service.AdminNotificationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.never;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AdminNotificationControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AdminNotificationService notifications;

    @Test
    void getsNotificationById() throws Exception {
        when(notifications.getNotification(12L)).thenReturn(new NotificationResponseDto(
                12L, "Holiday challenge", "Train three days.", "ANNOUNCEMENT", "DRAFT",
                LocalDateTime.of(2026, 10, 14, 9, 0)
        ));

        mockMvc.perform(get("/api/admin/notifications/12")
                        .with(SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(12))
                .andExpect(jsonPath("$.title").value("Holiday challenge"))
                .andExpect(jsonPath("$.status").value("DRAFT"));

        verify(notifications).getNotification(12L);
    }

    @Test
    void returnsNotFoundForUnknownNotification() throws Exception {
        when(notifications.getNotification(999L))
                .thenThrow(new ResourceNotFoundException("Notification not found: 999"));

        mockMvc.perform(get("/api/admin/notifications/999")
                        .with(SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN")))
                .andExpect(status().isNotFound());
    }

    @Test
    void updatesNotification() throws Exception {
        when(notifications.updateNotification(
                org.mockito.ArgumentMatchers.eq(12L),
                org.mockito.ArgumentMatchers.eq(new UpdateNotificationRequestDto(
                        "Updated title", "Updated message.", "ANNOUNCEMENT", "PUBLISHED"
                ))
        )).thenReturn(new NotificationResponseDto(
                12L, "Updated title", "Updated message.", "ANNOUNCEMENT", "PUBLISHED",
                LocalDateTime.of(2026, 10, 14, 9, 0)
        ));

        mockMvc.perform(put("/api/admin/notifications/12")
                        .contentType("application/json")
                        .content("""
                                {
                                  "title": "Updated title",
                                  "message": "Updated message.",
                                  "type": "ANNOUNCEMENT",
                                  "status": "PUBLISHED"
                                }
                                """)
                        .with(SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Updated title"))
                .andExpect(jsonPath("$.status").value("PUBLISHED"));
    }

    @Test
    void rejectsUpdateWithBlankTitleOrMessage() throws Exception {
        mockMvc.perform(put("/api/admin/notifications/12")
                        .contentType("application/json")
                        .content("""
                                {
                                  "title": " ",
                                  "message": "",
                                  "type": "ANNOUNCEMENT",
                                  "status": "PUBLISHED"
                                }
                                """)
                        .with(SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN")))
                .andExpect(status().isBadRequest());

        verify(notifications, never()).updateNotification(
                org.mockito.ArgumentMatchers.anyLong(),
                org.mockito.ArgumentMatchers.any(UpdateNotificationRequestDto.class)
        );
    }

    @Test
    void rejectsChangingMaintenanceType() throws Exception {
        when(notifications.updateNotification(
                org.mockito.ArgumentMatchers.eq(3L),
                org.mockito.ArgumentMatchers.any(UpdateNotificationRequestDto.class)
        )).thenThrow(new ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "Maintenance notifications must remain managed by Maintenance schedules"
        ));

        mockMvc.perform(put("/api/admin/notifications/3")
                        .contentType("application/json")
                        .content("""
                                {
                                  "title": "Maintenance notice",
                                  "message": "Message.",
                                  "type": "UPDATE",
                                  "status": "PUBLISHED"
                                }
                                """)
                        .with(SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createsPublishedNotificationAsAdmin() throws Exception {
        when(notifications.createNotification(
                new CreateNotificationRequestDto("New roadmap", "A new roadmap is available.", "UPDATE", "PUBLISHED"),
                "admin@example.com"
        )).thenReturn(new NotificationResponseDto(
                17L,
                "New roadmap",
                "A new roadmap is available.",
                "UPDATE",
                "PUBLISHED",
                LocalDateTime.of(2026, 10, 30, 12, 0)
        ));

        mockMvc.perform(post("/api/admin/notifications")
                        .contentType("application/json")
                        .content("""
                                {
                                  "title": "New roadmap",
                                  "message": "A new roadmap is available.",
                                  "type": "UPDATE",
                                  "status": "PUBLISHED"
                                }
                                """)
                        .with(SecurityMockMvcRequestPostProcessors.user("admin@example.com").roles("ADMIN")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(17))
                .andExpect(jsonPath("$.status").value("PUBLISHED"));

        verify(notifications).createNotification(
                new CreateNotificationRequestDto("New roadmap", "A new roadmap is available.", "UPDATE", "PUBLISHED"),
                "admin@example.com"
        );
    }

    @Test
    void createsDraftNotificationAsAdmin() throws Exception {
        when(notifications.createNotification(
                new CreateNotificationRequestDto("Draft", "Draft message.", "ANNOUNCEMENT", "DRAFT"),
                "admin@example.com"
        )).thenReturn(new NotificationResponseDto(
                18L, "Draft", "Draft message.", "ANNOUNCEMENT", "DRAFT", LocalDateTime.now()
        ));

        mockMvc.perform(post("/api/admin/notifications")
                        .contentType("application/json")
                        .content("""
                                {
                                  "title": "Draft",
                                  "message": "Draft message.",
                                  "type": "ANNOUNCEMENT",
                                  "status": "DRAFT"
                                }
                                """)
                        .with(SecurityMockMvcRequestPostProcessors.user("admin@example.com").roles("ADMIN")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"));
    }

    @Test
    void rejectsBlankNotificationTitle() throws Exception {
        mockMvc.perform(post("/api/admin/notifications")
                        .contentType("application/json")
                        .content("""
                                {
                                  "title": " ",
                                  "message": "A message.",
                                  "type": "ANNOUNCEMENT",
                                  "status": "PUBLISHED"
                                }
                                """)
                        .with(SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN")))
                .andExpect(status().isBadRequest());

        verify(notifications, never()).createNotification(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()
        );
    }

    @Test
    void rejectsBlankNotificationMessage() throws Exception {
        mockMvc.perform(post("/api/admin/notifications")
                        .contentType("application/json")
                        .content("""
                                {
                                  "title": "A title",
                                  "message": " ",
                                  "type": "ANNOUNCEMENT",
                                  "status": "PUBLISHED"
                                }
                                """)
                        .with(SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsMaintenanceNotificationType() throws Exception {
        mockMvc.perform(post("/api/admin/notifications")
                        .contentType("application/json")
                        .content("""
                                {
                                  "title": "Scheduled maintenance",
                                  "message": "Maintenance message.",
                                  "type": "MAINTENANCE",
                                  "status": "PUBLISHED"
                                }
                                """)
                        .with(SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void forbidsMembersFromCreatingNotifications() throws Exception {
        mockMvc.perform(post("/api/admin/notifications")
                        .contentType("application/json")
                        .content("""
                                {
                                  "title": "New announcement",
                                  "message": "A message.",
                                  "type": "ANNOUNCEMENT",
                                  "status": "PUBLISHED"
                                }
                                """)
                        .with(SecurityMockMvcRequestPostProcessors.user("member").roles("MEMBER")))
                .andExpect(status().isForbidden());

        verify(notifications, never()).createNotification(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()
        );
    }

    @Test
    void returnsNotificationsAndCounts() throws Exception {
        when(notifications.getNotifications("ALL")).thenReturn(new NotificationListResponseDto(
                List.of(new NotificationResponseDto(
                        1L,
                        "Scheduled maintenance",
                        "Database upgrade",
                        "MAINTENANCE",
                        "PUBLISHED",
                        LocalDateTime.of(2026, 10, 15, 9, 0)
                )),
                new NotificationCountsDto(4, 1, 2, 1)
        ));

        mockMvc.perform(get("/api/admin/notifications")
                        .with(SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notifications.length()").value(1))
                .andExpect(jsonPath("$.notifications[0].type").value("MAINTENANCE"))
                .andExpect(jsonPath("$.counts.allCount").value(4))
                .andExpect(jsonPath("$.counts.maintenanceCount").value(1))
                .andExpect(jsonPath("$.counts.announcementCount").value(2))
                .andExpect(jsonPath("$.counts.updateCount").value(1));
    }

    @Test
    void filtersNotificationsByType() throws Exception {
        when(notifications.getNotifications("UPDATE")).thenReturn(new NotificationListResponseDto(
                List.of(),
                new NotificationCountsDto(4, 1, 2, 1)
        ));

        mockMvc.perform(get("/api/admin/notifications").param("type", "UPDATE")
                        .with(SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notifications.length()").value(0))
                .andExpect(jsonPath("$.counts.updateCount").value(1));

        verify(notifications).getNotifications("UPDATE");
    }

    @Test
    void deletesNotificationsInBatch() throws Exception {
        mockMvc.perform(delete("/api/admin/notifications/batch")
                        .contentType("application/json")
                        .content("{\"ids\":[1,2]}")
                        .with(SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN")))
                .andExpect(status().isNoContent());

        verify(notifications).deleteNotifications(List.of(1L, 2L));
    }

    @Test
    void rejectsEmptyBatchDeleteIds() throws Exception {
        mockMvc.perform(delete("/api/admin/notifications/batch")
                        .contentType("application/json")
                        .content("{\"ids\":[]}")
                        .with(SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void returnsNotFoundWhenBatchContainsUnknownIds() throws Exception {
        doThrow(new ResourceNotFoundException("One or more notifications were not found"))
                .when(notifications).deleteNotifications(List.of(999L));

        mockMvc.perform(delete("/api/admin/notifications/batch")
                        .contentType("application/json")
                        .content("{\"ids\":[999]}")
                        .with(SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN")))
                .andExpect(status().isNotFound());
    }

    @Test
    void deletesOneNotification() throws Exception {
        mockMvc.perform(delete("/api/admin/notifications/4")
                        .with(SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN")))
                .andExpect(status().isNoContent());

        verify(notifications).deleteNotification(4L);
    }

    @Test
    void forbidsNonAdminUsers() throws Exception {
        mockMvc.perform(get("/api/admin/notifications")
                        .with(SecurityMockMvcRequestPostProcessors.user("member").roles("MEMBER")))
                .andExpect(status().isForbidden());
    }

}
