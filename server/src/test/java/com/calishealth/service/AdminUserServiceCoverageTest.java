package com.calishealth.service;

import com.calishealth.dtos.AdminUserDtos.AdminActionType;
import com.calishealth.dtos.AdminUserDtos.CreateUserRequest;
import com.calishealth.dtos.AdminUserDtos.StatusFilter;
import com.calishealth.dtos.AdminUserDtos.Summary;
import com.calishealth.dtos.AdminUserDtos.UserItem;
import com.calishealth.dtos.AdminUserDtos.UserPage;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.UserActivityRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho {@link AdminUserService}: lọc danh sách user, phân trang,
 * tạo tài khoản và tra cứu activity theo vai trò.
 */
class AdminUserServiceCoverageTest {

    private UserRepository users;
    private PasswordEncoder encoder;
    private UserActivityRepository activity;
    private AdminUserService service;

    private static final String ADMIN = "admin@calishealth.com";

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        encoder = mock(PasswordEncoder.class);
        activity = mock(UserActivityRepository.class);
        service = new AdminUserService(users, encoder, activity);
    }

    private User user(long id, UserRole role) {
        User user = new User();
        user.setId(id);
        user.setEmail("user" + id + "@x.com");
        user.setFullName("User " + id);
        user.setRole(role);
        user.setEnabled(true);
        user.setBlocked(false);
        return user;
    }

    @Test
    @DisplayName("list: khong co bo loc -> tra ve tat ca user")
    void listWithoutFiltersReturnsEveryone() {
        when(users.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(user(1L, UserRole.MEMBER))));

        UserPage page = service.list(null, null, null, null, "newest", 0, 10);

        assertThat(page.items()).hasSize(1);
        assertThat(page.items().get(0).userCode()).isEqualTo("USR-00001");
        assertThat(page.summary()).isNotNull();
    }

    @Test
    @DisplayName("list: size > MAX -> gioi han")
    void listClampsPageSize() {
        when(users.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        UserPage page = service.list(null, null, null, null, "newest", 0, 500);

        assertThat(page.size()).isEqualTo(AdminUserService.MAX_PAGE_SIZE);
    }

    @Test
    @DisplayName("list: size < 1 va page < 0 -> chuan hoa")
    void listNormalizesInvalidPaging() {
        when(users.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        UserPage page = service.list(null, null, null, null, "newest", -5, 0);

        assertThat(page.page()).isZero();
        assertThat(page.size()).isEqualTo(1);
    }

    @Test
    @DisplayName("list: sap xep theo oldest / name_asc / name_desc")
    void listSupportsAllSortModes() {
        when(users.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        service.list(null, null, null, null, "oldest", 0, 10);
        service.list(null, null, null, null, "name_asc", 0, 10);
        service.list(null, null, null, null, "name_desc", 0, 10);

        var captor = org.mockito.ArgumentCaptor.forClass(Pageable.class);
        verify(users, org.mockito.Mockito.times(3))
                .findAll(any(Specification.class), captor.capture());
        assertThat(captor.getAllValues().get(0).getSort().getOrderFor("createdAt").getDirection())
                .isEqualTo(org.springframework.data.domain.Sort.Direction.ASC);
        assertThat(captor.getAllValues().get(1).getSort().getOrderFor("fullName").isAscending()).isTrue();
        assertThat(captor.getAllValues().get(2).getSort().getOrderFor("fullName").isDescending()).isTrue();
    }

    @Test
    @DisplayName("list: bo loc q / role / status / ngay join -> ap dung vao truy van")
    void listAppliesEveryFilter() {
        when(users.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        service.list("bob", UserRole.ADMIN, StatusFilter.ACTIVE, LocalDate.of(2026, 1, 1), "newest", 0, 10);

        verify(users).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    @DisplayName("summary: dem theo tung vai tro")
    void summaryCountsRoles() {
        when(users.count()).thenReturn(5L);
        when(users.countByEnabledAndBlocked(true, false)).thenReturn(3L);
        when(users.countByRole(any(UserRole.class))).thenReturn(1L);

        Summary summary = service.summary();

        assertThat(summary.total()).isEqualTo(5L);
        assertThat(summary.active()).isEqualTo(3L);
        assertThat(summary.inactive()).isEqualTo(2L);
        assertThat(summary.byRole()).containsKeys(UserRole.ADMIN.name(), UserRole.MEMBER.name());
    }

    @Test
    @DisplayName("create: email trung -> 409")
    void createRejectsDuplicateEmail() {
        when(users.existsByEmail("cm@x.com")).thenReturn(true);

        assertThatThrownBy(() -> service.create(ADMIN, new CreateUserRequest("Cm", "cm@x.com", UserRole.CONTENT_MANAGER)))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value()).isEqualTo(409));
    }

    @Test
    @DisplayName("create: ghi log admin action")
    void createLogsAdminAction() {
        User admin = user(1L, UserRole.ADMIN);
        admin.setEmail(ADMIN);
        when(users.existsByEmail("cm@x.com")).thenReturn(false);
        when(encoder.encode(AdminUserService.DEFAULT_STAFF_PASSWORD)).thenReturn("HASH");
        when(users.saveAndFlush(any(User.class))).thenAnswer(i -> {
            User u = i.getArgument(0);
            u.setId(9L);
            return u;
        });
        when(users.findByEmail(ADMIN)).thenReturn(Optional.of(admin));

        UserItem created = service.create(ADMIN, new CreateUserRequest("Cm", "cm@x.com", UserRole.CONTENT_MANAGER));

        assertThat(created.id()).isEqualTo(9L);
        assertThat(created.role()).isEqualTo("CONTENT_MANAGER");
        verify(activity).logAdminAction(1L, 9L, AdminActionType.CREATE_ACCOUNT);
    }

    @Test
    @DisplayName("create: khong tim thay admin -> khong log nhung van tao tai khoan")
    void createWithoutActingAdminStillCreates() {
        when(users.existsByEmail("cm@x.com")).thenReturn(false);
        when(encoder.encode(AdminUserService.DEFAULT_STAFF_PASSWORD)).thenReturn("HASH");
        when(users.saveAndFlush(any(User.class))).thenAnswer(i -> {
            User u = i.getArgument(0);
            u.setId(9L);
            return u;
        });
        when(users.findByEmail(ADMIN)).thenReturn(Optional.empty());

        assertThat(service.create(ADMIN, new CreateUserRequest("Cm", "cm@x.com", UserRole.CONTENT_MANAGER)).id())
                .isEqualTo(9L);
        verify(activity, never()).logAdminAction(anyLong(), anyLong(), any());
    }

    @Test
    @DisplayName("setActive: trung id -> chi xu ly 1 lan")
    void setActiveDeduplicatesIds() {
        User target = user(2L, UserRole.MEMBER);
        when(users.findAllById(any())).thenReturn(List.of(target));

        var result = service.setActive(ADMIN, new com.calishealth.dtos.AdminUserDtos.BulkStatusRequest(
                List.of(2L, 2L), false));

        assertThat(result.affected()).isEqualTo(1);
    }

    @Test
    @DisplayName("setActive: kich hoat user -> mo khoa + xac thuc email")
    void setActiveActivatesUser() {
        User target = user(2L, UserRole.MEMBER);
        target.setEnabled(false);
        target.setBlocked(true);
        when(users.findAllById(any())).thenReturn(List.of(target));

        service.setActive(ADMIN, new com.calishealth.dtos.AdminUserDtos.BulkStatusRequest(List.of(2L), true));

        assertThat(target.isBlocked()).isFalse();
        assertThat(target.isEnabled()).isTrue();
    }

    @Test
    @DisplayName("setActive: khong tim thay admin -> van cap nhat nhung khong log")
    void setActiveWithoutAdminStillUpdates() {
        User target = user(2L, UserRole.MEMBER);
        when(users.findAllById(any())).thenReturn(List.of(target));
        when(users.findByEmail(ADMIN)).thenReturn(Optional.empty());

        service.setActive(ADMIN, new com.calishealth.dtos.AdminUserDtos.BulkStatusRequest(List.of(2L), false));

        assertThat(target.isBlocked()).isTrue();
        // Không tìm thấy admin -> adminId null nhưng vẫn ghi log hành động.
        verify(activity).logAdminAction(org.mockito.ArgumentMatchers.<Long>isNull(),
                org.mockito.ArgumentMatchers.eq(2L), org.mockito.ArgumentMatchers.eq(AdminActionType.DEACTIVATE));
    }

    @Test
    @DisplayName("detail: content manager -> hien thong tin content")
    void detailIncludesContentInfo() {
        User cm = user(3L, UserRole.CONTENT_MANAGER);
        cm.setPassword("HASH");
        when(users.findById(3L)).thenReturn(Optional.of(cm));
        when(encoder.matches(AdminUserService.DEFAULT_STAFF_PASSWORD, "HASH")).thenReturn(false);

        var detail = service.detail(ADMIN, 3L);

        assertThat(detail.passwordState()).isEqualTo("CHANGED");
        verify(activity).findContentInfo(3L);
    }

    @Test
    @DisplayName("detail: user khong ton tai -> 404")
    void detailOfMissingUser() {
        when(users.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.detail(ADMIN, 99L))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value()).isEqualTo(404));
    }

    @Test
    @DisplayName("systemLogs: dung cho moi vai tro")
    void systemLogsAvailableForAnyRole() {
        when(users.findById(4L)).thenReturn(Optional.of(user(4L, UserRole.MEMBER)));

        service.systemLogs(4L, null, null, 0, 10);

        verify(activity).findSystemLogs(4L, null, null, 0, 10);
    }

    @Test
    @DisplayName("systemLogs: user khong ton tai -> 404")
    void systemLogsOfMissingUser() {
        when(users.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.systemLogs(99L, null, null, 0, 10))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("adminActions: chi admin duoc xem")
    void adminActionsRequireAdminRole() {
        when(users.findById(4L)).thenReturn(Optional.of(user(4L, UserRole.MEMBER)));

        assertThatThrownBy(() -> service.adminActions(4L, null, null, 0, 10))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("not available for MEMBER");
    }

    @Test
    @DisplayName("contentActivity: chi content manager duoc xem")
    void contentActivityRequiresContentManagerRole() {
        when(users.findById(4L)).thenReturn(Optional.of(user(4L, UserRole.ADMIN)));

        assertThatThrownBy(() -> service.contentActivity(4L, null, null, 0, 10))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("workoutActivity: chi member duoc xem")
    void workoutActivityRequiresMemberRole() {
        when(users.findById(4L)).thenReturn(Optional.of(user(4L, UserRole.CONTENT_MANAGER)));

        assertThatThrownBy(() -> service.workoutActivity(4L, null, null, null, null, null, 0, 10))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("activity: paging bi gioi han ve MAX_PAGE_SIZE")
    void activityPagingIsClamped() {
        when(users.findById(5L)).thenReturn(Optional.of(user(5L, UserRole.MEMBER)));
        when(users.findById(6L)).thenReturn(Optional.of(user(6L, UserRole.ADMIN)));
        when(users.findById(7L)).thenReturn(Optional.of(user(7L, UserRole.CONTENT_MANAGER)));

        service.workoutActivity(5L, "q", null, null, null, null, -2, 9999);
        service.adminActions(6L, null, null, -2, 9999);
        service.contentActivity(7L, null, null, -2, 9999);

        verify(activity).findWorkoutActivity(anyLong(), any(), any(), any(), any(), any(), anyInt(),
                org.mockito.ArgumentMatchers.eq(AdminUserService.MAX_PAGE_SIZE));
        verify(activity).findAdminActions(anyLong(), any(), any(), anyInt(),
                org.mockito.ArgumentMatchers.eq(AdminUserService.MAX_PAGE_SIZE));
        verify(activity).findContentActivity(anyLong(), any(), any(), anyInt(),
                org.mockito.ArgumentMatchers.eq(AdminUserService.MAX_PAGE_SIZE));
    }
}
