package com.calishealth.service;

import com.calishealth.dtos.AdminUserDtos.*;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.UserActivityRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AdminUserServiceTest {
    private final UserRepository users = mock(UserRepository.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);
    private final UserActivityRepository activity = mock(UserActivityRepository.class);
    private final AdminUserService service = new AdminUserService(users, encoder, activity);

    private static User user(long id, String email, boolean enabled) {
        User u = new User();
        u.setId(id);
        u.setEmail(email);
        u.setFullName("User " + id);
        u.setEnabled(enabled);
        return u;
    }

    @Test
    void formatsUserCodeWithFiveDigits() {
        assertEquals("USR-00124", AdminUserService.userCode(124L));
    }

    private User createAndCapture(String email, UserRole role) {
        when(users.existsByEmail(email.trim().toLowerCase())).thenReturn(false);
        when(encoder.encode("Test@123")).thenReturn("HASH");
        when(users.saveAndFlush(any(User.class))).thenAnswer(i -> {
            User u = i.getArgument(0);
            u.setId(7L);
            return u;
        });
        service.create("admin@calishealth.com", new CreateUserRequest("Staff", email, role));
        var saved = org.mockito.ArgumentCaptor.forClass(User.class);
        verify(users).saveAndFlush(saved.capture());
        return saved.getValue();
    }

    @Test
    void createRejectsMemberRole() {
        var req = new CreateUserRequest("Bob", "bob@x.com", UserRole.MEMBER);
        assertThrows(ResponseStatusException.class, () -> service.create("admin@calishealth.com", req));
        verify(users, never()).saveAndFlush(any());
    }

    @Test
    void createRejectsDuplicateEmail() {
        when(users.existsByEmail("bob@x.com")).thenReturn(true);
        var req = new CreateUserRequest("Bob", " Bob@X.com ", UserRole.ADMIN);
        assertThrows(ResponseStatusException.class, () -> service.create("admin@calishealth.com", req));
    }

    @Test
    void contentManagerGetsDefaultPasswordAndMustChangeIt() {
        User u = createAndCapture("CM@x.com", UserRole.CONTENT_MANAGER);
        assertEquals("cm@x.com", u.getEmail());
        assertEquals("HASH", u.getPassword()); // encoded "Test@123"
        assertTrue(u.isEnabled());
        assertFalse(u.isBlocked());
        assertTrue(u.isMustChangePassword());
    }

    @Test
    void adminGetsDefaultPasswordWithoutForcedChange() {
        User u = createAndCapture("boss@x.com", UserRole.ADMIN);
        assertEquals("HASH", u.getPassword());
        assertFalse(u.isMustChangePassword());
    }

    @Test
    void createMapsRaceOnUniqueEmailToConflict() {
        when(users.existsByEmail("cm@x.com")).thenReturn(false);
        when(encoder.encode("Test@123")).thenReturn("HASH");
        when(users.saveAndFlush(any(User.class)))
                .thenThrow(new org.springframework.dao.DataIntegrityViolationException("dup"));
        var ex = assertThrows(ResponseStatusException.class, () -> service.create("admin@calishealth.com", 
                new CreateUserRequest("Cm", "cm@x.com", UserRole.CONTENT_MANAGER)));
        assertEquals(409, ex.getStatusCode().value());
    }

    @Test
    void cannotDeactivateOwnAccount() {
        when(users.findAllById(List.of(1L, 2L)))
                .thenReturn(List.of(user(1, "admin@calishealth.com", true), user(2, "a@x.com", true)));
        var req = new BulkStatusRequest(List.of(1L, 2L), false);
        assertThrows(ResponseStatusException.class, () -> service.setActive("Admin@calishealth.com", req));
        verify(users, never()).saveAll(any());
    }

    @Test
    void setActiveCountsOnlyChangedUsers() {
        when(users.findAllById(List.of(2L, 3L)))
                .thenReturn(List.of(user(2, "a@x.com", true), user(3, "b@x.com", false)));
        BulkResult res = service.setActive("admin@calishealth.com", new BulkStatusRequest(List.of(2L, 3L), false));
        assertEquals(1, res.affected());
    }

    @Test
    void missingUserIdsReturnNotFound() {
        when(users.findAllById(List.of(2L, 99L))).thenReturn(List.of(user(2, "a@x.com", true)));
        assertThrows(ResponseStatusException.class,
                () -> service.setActive("admin@calishealth.com", new BulkStatusRequest(List.of(2L, 99L), true)));
    }

    @Test
    void deactivateBlocksAndActivateUnblocks() {
        User active = user(2, "a@x.com", true);
        User blocked = user(3, "b@x.com", true);
        blocked.setBlocked(true);

        when(users.findAllById(List.of(2L))).thenReturn(List.of(active));
        service.setActive("admin@calishealth.com", new BulkStatusRequest(List.of(2L), false));
        assertTrue(active.isBlocked());
        assertFalse(active.isActive());

        when(users.findAllById(List.of(3L))).thenReturn(List.of(blocked));
        service.setActive("admin@calishealth.com", new BulkStatusRequest(List.of(3L), true));
        assertFalse(blocked.isBlocked());
        assertTrue(blocked.isActive());
    }

    @Test
    void summaryCountsInactiveAsTotalMinusActive() {
        when(users.count()).thenReturn(10L);
        when(users.countByEnabledAndBlocked(true, false)).thenReturn(7L);
        Summary s = service.summary();
        assertEquals(10, s.total());
        assertEquals(7, s.active());
        assertEquals(3, s.inactive());
    }

    @Test
    void invalidSortIsRejected() {
        assertThrows(ResponseStatusException.class, () -> service.list(null, null, null, null, "bogus", 0, 10));
    }

    // ---- user detail & activity log ----

    private static User withRole(long id, String email, UserRole role, boolean enabled) {
        User u = user(id, email, enabled);
        u.setRole(role);
        return u;
    }

    @Test
    void creatingAccountAndTogglingStatusAreLoggedAsAdminActions() {
        User admin = withRole(1, "admin@calishealth.com", UserRole.ADMIN, true);
        when(users.findByEmail("admin@calishealth.com")).thenReturn(java.util.Optional.of(admin));
        createAndCapture("new@x.com", UserRole.ADMIN);
        verify(activity).logAdminAction(1L, 7L, AdminActionType.CREATE_ACCOUNT);

        when(users.findAllById(List.of(2L, 3L)))
                .thenReturn(List.of(user(2, "a@x.com", true), user(3, "b@x.com", false)));
        service.setActive("admin@calishealth.com", new BulkStatusRequest(List.of(2L, 3L), false));
        // Only the user whose state really changed is logged.
        verify(activity).logAdminAction(1L, 2L, AdminActionType.DEACTIVATE);
        verify(activity, never()).logAdminAction(eq(1L), eq(3L), any());
    }

    @Test
    void detailOfUnknownUserIsNotFound() {
        when(users.findById(99L)).thenReturn(java.util.Optional.empty());
        var ex = assertThrows(ResponseStatusException.class, () -> service.detail("admin@calishealth.com", 99L));
        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    void detailFlagsOwnAccountAndDefaultPassword() {
        User admin = withRole(1, "admin@calishealth.com", UserRole.ADMIN, true);
        admin.setPassword("HASH");
        when(users.findById(1L)).thenReturn(java.util.Optional.of(admin));
        when(encoder.matches("Test@123", "HASH")).thenReturn(true);
        when(activity.findAdminInfo(1L)).thenReturn(new AdminInfo(6, 12, 4, 9, 3, 5));

        UserDetail own = service.detail("Admin@calishealth.com", 1L);
        assertTrue(own.self());
        assertEquals("DEFAULT", own.passwordState());
        assertEquals("USR-00001", own.userCode());
        assertEquals(12, own.admin().usersDeactivated());
        assertNull(own.member());
        assertNull(own.content());

        assertFalse(service.detail("other@calishealth.com", 1L).self());
    }

    @Test
    void memberDetailHasNoPasswordState() {
        User member = withRole(5, "m@x.com", UserRole.MEMBER, true);
        when(users.findById(5L)).thenReturn(java.util.Optional.of(member));
        when(activity.findMemberInfo(5L)).thenReturn(java.util.Optional.empty());

        UserDetail d = service.detail("admin@calishealth.com", 5L);
        assertNull(d.passwordState());
        assertNull(d.member());
        verify(encoder, never()).matches(any(), any());
    }

    @Test
    void roleSpecificActivityRejectsOtherRoles() {
        when(users.findById(5L)).thenReturn(java.util.Optional.of(withRole(5, "m@x.com", UserRole.MEMBER, true)));
        assertThrows(ResponseStatusException.class, () -> service.adminActions(5L, null, null, 0, 5));
        assertThrows(ResponseStatusException.class, () -> service.contentActivity(5L, null, null, 0, 5));

        when(users.findById(6L)).thenReturn(java.util.Optional.of(withRole(6, "a@x.com", UserRole.ADMIN, true)));
        assertThrows(ResponseStatusException.class, () -> service.workoutActivity(6L, null, null, null, null, null, 0, 5));
        verifyNoInteractions(activity);
    }

    @Test
    void activityPagingIsClamped() {
        when(users.findById(5L)).thenReturn(java.util.Optional.of(withRole(5, "m@x.com", UserRole.MEMBER, true)));
        service.workoutActivity(5L, null, null, null, null, null, -3, 5000);
        verify(activity).findWorkoutActivity(5L, null, null, null, null, null, 0, AdminUserService.MAX_PAGE_SIZE);
    }
}
