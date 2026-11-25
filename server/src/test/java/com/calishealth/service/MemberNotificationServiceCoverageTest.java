package com.calishealth.service;

import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.models.Notification;
import com.calishealth.models.NotificationRead;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.NotificationReadRepository;
import com.calishealth.repository.NotificationRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho {@link MemberNotificationService}: đánh dấu đã đọc và quyền thấy thông báo.
 */
class MemberNotificationServiceCoverageTest {

    private NotificationRepository notifications;
    private NotificationReadRepository reads;
    private UserRepository users;
    private MemberNotificationService service;

    private static final String EMAIL = "member@example.com";

    @BeforeEach
    void setUp() {
        notifications = mock(NotificationRepository.class);
        reads = mock(NotificationReadRepository.class);
        users = mock(UserRepository.class);
        service = new MemberNotificationService(notifications, reads, users);
    }

    private User member(UserRole role, long id) {
        User user = new User();
        user.setId(id);
        user.setEmail(EMAIL);
        user.setRole(role);
        return user;
    }

    private Notification notification(Long id, String audience, String status) {
        Notification notification = new Notification();
        notification.setId(id);
        notification.setTitle("Title " + id);
        notification.setMessage("Message");
        notification.setType("ANNOUNCEMENT");
        notification.setStatus(status);
        notification.setTargetAudience(audience);
        return notification;
    }

    @Test
    @DisplayName("getNotifications: user khong ton tai -> 404")
    void unknownUserIsRejected() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getNotifications(EMAIL))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("markAsRead: thong bao chua publish -> 404")
    void markAsReadRejectsUnpublished() {
        User user = member(UserRole.MEMBER, 42L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(notifications.findById(1L)).thenReturn(Optional.of(notification(1L, "MEMBER", "DRAFT")));

        assertThatThrownBy(() -> service.markAsRead(1L, EMAIL))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("markAsRead: audience khong phu hop -> 404")
    void markAsReadRejectsInvisibleAudience() {
        User user = member(UserRole.MEMBER, 42L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(notifications.findById(1L)).thenReturn(Optional.of(notification(1L, "ADMIN", "PUBLISHED")));

        assertThatThrownBy(() -> service.markAsRead(1L, EMAIL))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("markAsRead: audience null -> 404")
    void markAsReadRejectsNullAudience() {
        User user = member(UserRole.MEMBER, 42L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(notifications.findById(1L)).thenReturn(Optional.of(notification(1L, null, "PUBLISHED")));

        assertThatThrownBy(() -> service.markAsRead(1L, EMAIL))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("markAsRead: chua doc -> luu ban ghi doc")
    void markAsReadStoresRecord() {
        User user = member(UserRole.MEMBER, 42L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(notifications.findById(1L)).thenReturn(Optional.of(notification(1L, "MEMBER", "PUBLISHED")));
        when(reads.existsByUserIdAndNotificationId(42L, 1L)).thenReturn(false);

        service.markAsRead(1L, EMAIL);

        verify(reads).save(any(NotificationRead.class));
    }

    @Test
    @DisplayName("markAsRead: da doc roi -> khong luu lai")
    void markAsReadIsIdempotent() {
        User user = member(UserRole.MEMBER, 42L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(notifications.findById(1L)).thenReturn(Optional.of(notification(1L, "MEMBER", "PUBLISHED")));
        when(reads.existsByUserIdAndNotificationId(42L, 1L)).thenReturn(true);

        service.markAsRead(1L, EMAIL);

        verify(reads, never()).save(any(NotificationRead.class));
    }

    @Test
    @DisplayName("markAsRead: user khong ton tai -> 404")
    void markAsReadRejectsUnknownUser() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.markAsRead(1L, EMAIL))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("visibility: member thay thong bao theo tung audience")
    void memberSeesSupportedAudiences() {
        User user = member(UserRole.MEMBER, 42L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(notifications.findById(1L)).thenReturn(Optional.of(notification(1L, "MEMBER", "PUBLISHED")));
        when(notifications.findById(2L)).thenReturn(Optional.of(notification(2L, "ALL_MEMBERS", "PUBLISHED")));
        when(notifications.findById(3L)).thenReturn(Optional.of(notification(3L, "SYSTEM_WIDE", "PUBLISHED")));
        when(notifications.findById(4L)).thenReturn(Optional.of(notification(4L, "ALL_USERS", "PUBLISHED")));
        when(notifications.findById(5L)).thenReturn(Optional.of(notification(5L, "GLOBAL", "PUBLISHED")));
        when(notifications.findById(6L)).thenReturn(Optional.of(notification(6L, "ALL_ROLES", "PUBLISHED")));

        for (long id = 1; id <= 6; id++) {
            service.markAsRead(id, EMAIL);
        }
        verify(reads, org.mockito.Mockito.times(6)).save(any(NotificationRead.class));
    }

    @Test
    @DisplayName("visibility: member khong thay thong bao rieng cua nguoi khac")
    void memberCannotSeeOtherUsersPrivateNotification() {
        User user = member(UserRole.MEMBER, 42L);
        Notification targeted = notification(9L, "SPECIFIC_USER", "PUBLISHED");
        targeted.setUserId(77L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(notifications.findById(9L)).thenReturn(Optional.of(targeted));

        assertThatThrownBy(() -> service.markAsRead(9L, EMAIL))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("visibility: admin khong thay thong bao rieng cua member")
    void adminCannotSeePrivateNotification() {
        User admin = member(UserRole.ADMIN, 1L);
        Notification targeted = notification(9L, "SPECIFIC_USER", "PUBLISHED");
        targeted.setUserId(42L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(admin));
        when(notifications.findById(9L)).thenReturn(Optional.of(targeted));

        assertThatThrownBy(() -> service.markAsRead(9L, EMAIL))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("visibility: content manager thay thong bao theo audience rieng")
    void contentManagerSeesOwnAudience() {
        User manager = member(UserRole.CONTENT_MANAGER, 43L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(manager));
        when(notifications.findById(1L)).thenReturn(Optional.of(notification(1L, "CONTENT_MANAGER", "PUBLISHED")));
        when(notifications.findById(2L)).thenReturn(Optional.of(notification(2L, "MEMBER", "PUBLISHED")));

        service.markAsRead(1L, EMAIL);
        assertThatThrownBy(() -> service.markAsRead(2L, EMAIL))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("visibility: admin thay thong bao theo audience rieng")
    void adminSeesOwnAudience() {
        User admin = member(UserRole.ADMIN, 1L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(admin));
        when(notifications.findById(1L)).thenReturn(Optional.of(notification(1L, "ADMIN", "PUBLISHED")));
        when(notifications.findById(2L)).thenReturn(Optional.of(notification(2L, "MEMBER", "PUBLISHED")));

        service.markAsRead(1L, EMAIL);
        assertThatThrownBy(() -> service.markAsRead(2L, EMAIL))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getNotifications: danh sach rong -> unread = 0")
    void emptyNotificationList() {
        User user = member(UserRole.MEMBER, 42L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(notifications.findVisibleToUserByStatusAudienceOrderByCreatedAtDesc(
                42L, "MEMBER", "PUBLISHED")).thenReturn(List.of());

        var result = service.getNotifications(EMAIL);

        assertThat(result.notifications()).isEmpty();
        assertThat(result.unreadCount()).isZero();
    }

    @Test
    @DisplayName("getNotifications: dem thong bao chua doc")
    void unreadCountIsComputed() {
        User user = member(UserRole.MEMBER, 42L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(notifications.findVisibleToUserByStatusAudienceOrderByCreatedAtDesc(
                42L, "MEMBER", "PUBLISHED")).thenReturn(List.of(
                notification(1L, "MEMBER", "PUBLISHED"),
                notification(2L, "MEMBER", "PUBLISHED"),
                notification(3L, "MEMBER", "PUBLISHED")));
        when(reads.findAllByUserIdAndNotificationIdIn(anyLong(), anyList()))
                .thenReturn(List.of(new NotificationRead(42L, 1L)));

        var result = service.getNotifications(EMAIL);

        assertThat(result.notifications()).hasSize(3);
        assertThat(result.unreadCount()).isEqualTo(2);
    }
}
