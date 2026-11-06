package com.calishealth.security;

import com.calishealth.service.MaintenanceScheduleService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MaintenanceEnforcementFilterTest {
    private final MaintenanceScheduleService schedules = mock(MaintenanceScheduleService.class);
    private final MaintenanceEnforcementFilter filter = new MaintenanceEnforcementFilter(schedules);

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void blocksMemberExerciseUploadWithMaintenanceMessage() throws Exception {
        authenticateAs("MEMBER");
        when(schedules.isServiceUnderMaintenance(anyString())).thenReturn(false);
        when(schedules.isServiceUnderMaintenance("MEMBER_VIDEO_UPLOADS")).thenReturn(true);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/library/personal-exercises");
        MockHttpServletResponse response = new MockHttpServletResponse();
        boolean[] continued = {false};

        filter.doFilter(request, response, (req, res) -> continued[0] = true);

        assertEquals(503, response.getStatus());
        assertTrue(response.getContentAsString().contains(
                "Dịch vụ tải lên video bài tập đang trong thời gian bảo trì."));
        assertEquals(false, continued[0]);
    }

    @Test
    void leavesAdminRequestsAvailableDuringMemberAppMaintenance() throws Exception {
        authenticateAs("ADMIN");
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/dashboard");
        MockHttpServletResponse response = new MockHttpServletResponse();
        boolean[] continued = {false};

        filter.doFilter(request, response, (req, res) -> continued[0] = true);

        assertTrue(continued[0]);
        verify(schedules, never()).isServiceUnderMaintenance(anyString());
    }

    @Test
    void blocksPrivateMemberApiWhenMemberAppIsUnderMaintenance() throws Exception {
        authenticateAs("MEMBER");
        when(schedules.isServiceUnderMaintenance("MEMBER_APP_ACCESS")).thenReturn(true);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/library/overview");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> {
            throw new AssertionError("Private member API must be blocked during app maintenance");
        });

        assertEquals(503, response.getStatus());
        assertTrue(response.getContentAsString().contains("MEMBER_APP_ACCESS"));
    }

    @Test
    void leavesPublicLibraryReadsAvailableDuringMemberAppMaintenance() throws Exception {
        authenticateAs("MEMBER");
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/library/exercises");
        MockHttpServletResponse response = new MockHttpServletResponse();
        boolean[] continued = {false};

        filter.doFilter(request, response, (req, res) -> continued[0] = true);

        assertTrue(continued[0]);
        verify(schedules, never()).isServiceUnderMaintenance(anyString());
    }

    @Test
    void keepsMemberAuthenticationCheckAvailableDuringMemberAppMaintenance() throws Exception {
        authenticateAs("MEMBER");
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/auth/me");
        MockHttpServletResponse response = new MockHttpServletResponse();
        boolean[] continued = {false};

        filter.doFilter(request, response, (req, res) -> continued[0] = true);

        assertTrue(continued[0]);
        verify(schedules, never()).isServiceUnderMaintenance(anyString());
    }

    @Test
    void blocksPoseAssessmentResultSubmissionWhenAiServiceIsUnderMaintenance() throws Exception {
        authenticateAs("MEMBER");
        when(schedules.isServiceUnderMaintenance(anyString())).thenReturn(false);
        when(schedules.isServiceUnderMaintenance("AI_POSE_ASSESSMENT")).thenReturn(true);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/member/progression/results");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> {
            throw new AssertionError("Pose result submission must be blocked during AI maintenance");
        });

        assertEquals(503, response.getStatus());
        assertTrue(response.getContentAsString().contains("AI_POSE_ASSESSMENT"));
    }

    @Test
    void blocksMediaRequestsWhenStorageIsUnderMaintenance() throws Exception {
        when(schedules.isServiceUnderMaintenance("SYSTEM_STORAGE_CDN")).thenReturn(true);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/media/exercise-demos/demo.mp4");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> {
            throw new AssertionError("Media request must be blocked during CDN maintenance");
        });

        assertEquals(503, response.getStatus());
        verify(schedules).isServiceUnderMaintenance(eq("SYSTEM_STORAGE_CDN"));
    }

    private static void authenticateAs(String role) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        role.toLowerCase(),
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + role))
                )
        );
    }
}
