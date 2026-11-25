package com.calishealth.service;

import com.calishealth.dtos.MemberFeedbackDtos.CreateFeedbackRequest;
import com.calishealth.dtos.MemberFeedbackDtos.FeedbackListResponse;
import com.calishealth.dtos.MemberFeedbackDtos.FeedbackResponse;
import com.calishealth.dtos.MemberFeedbackDtos.HandleFeedbackRequest;
import com.calishealth.exception.RequestValidationException;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.models.MemberFeedback;
import com.calishealth.models.Notification;
import com.calishealth.models.User;
import com.calishealth.repository.MemberFeedbackRepository;
import com.calishealth.repository.NotificationRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MemberFeedbackServiceTest {
    @Mock private MemberFeedbackRepository feedbacks;
    @Mock private UserRepository users;
    @Mock private NotificationRepository notifications;
    @InjectMocks private MemberFeedbackService service;

    private static final String MEMBER = "member@example.test";
    private static final String MANAGER = "cm@example.test";
    private static final String ADMIN = "admin@example.test";

    private static User user(long id, String email, String fullName) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setFullName(fullName);
        return user;
    }

    private static MemberFeedback feedback(long id, MemberFeedback.Status status, MemberFeedback.Category category,
                                          String title, LocalDateTime createdAt) {
        MemberFeedback feedback = new MemberFeedback();
        feedback.setId(id);
        feedback.setMemberId(1L);
        feedback.setStatus(status);
        feedback.setCategory(category);
        feedback.setTitle(title);
        feedback.setContent("Content of " + title);
        feedback.setCreatedAt(createdAt);
        feedback.setUpdatedAt(createdAt);
        return feedback;
    }

    // ------------------------------------------------------------------- create

    @Test
    @DisplayName("Create: lưu đơn ở trạng thái PENDING và báo cho Content Manager")
    void createStoresPendingFeedback() {
        when(users.findByEmail(MEMBER)).thenReturn(Optional.of(user(1L, MEMBER, "Member")));
        when(feedbacks.save(any(MemberFeedback.class))).thenAnswer(invocation -> {
            MemberFeedback saved = invocation.getArgument(0);
            saved.setId(50L);
            return saved;
        });

        FeedbackResponse response = service.create(MEMBER,
                new CreateFeedbackRequest("Wrong video", "The demo video is broken", "TECHNICAL"));

        assertEquals(50L, response.id());
        assertEquals("Wrong video", response.title());
        assertEquals("TECHNICAL", response.category());
        assertEquals("PENDING", response.status());
        assertEquals("Member", response.memberName());

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notifications).save(captor.capture());
        assertEquals("CONTENT_MANAGER", captor.getValue().getTargetAudience());
        assertTrue(captor.getValue().getTitle().contains("Wrong video"));
    }

    @Test
    @DisplayName("Create: không gửi category thì mặc định GENERAL")
    void createDefaultsToGeneralCategory() {
        when(users.findByEmail(MEMBER)).thenReturn(Optional.of(user(1L, MEMBER, "Member")));
        when(feedbacks.save(any(MemberFeedback.class))).thenAnswer(invocation -> invocation.getArgument(0));

        FeedbackResponse response = service.create(MEMBER,
                new CreateFeedbackRequest("Hi", "Xin chào", null));

        assertEquals("GENERAL", response.category());
    }

    @Test
    @DisplayName("Create: category không hợp lệ -> 400")
    void createRejectsInvalidCategory() {
        when(users.findByEmail(MEMBER)).thenReturn(Optional.of(user(1L, MEMBER, "Member")));

        assertThrows(RequestValidationException.class,
                () -> service.create(MEMBER, new CreateFeedbackRequest("Hi", "Xin chào", "NOPE")));
    }

    @Test
    @DisplayName("Create: member không tồn tại -> 404")
    void createRejectsUnknownMember() {
        when(users.findByEmail(MEMBER)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> service.create(MEMBER, new CreateFeedbackRequest("Hi", "Xin chào", null)));
    }

    // ------------------------------------------------------------------ listMine

    @Test
    @DisplayName("List mine: trả về các đơn của chính member")
    void listMineReturnsOwnFeedback() {
        when(users.findByEmail(MEMBER)).thenReturn(Optional.of(user(1L, MEMBER, "Member")));
        when(feedbacks.findAllByMemberIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(
                feedback(1L, MemberFeedback.Status.PENDING, MemberFeedback.Category.GENERAL,
                        "First", LocalDateTime.of(2026, 1, 1, 10, 0)),
                feedback(2L, MemberFeedback.Status.RESOLVED, MemberFeedback.Category.TECHNICAL,
                        "Second", LocalDateTime.of(2026, 2, 1, 10, 0))));

        List<FeedbackResponse> items = service.listMine(MEMBER);

        assertEquals(2, items.size());
        assertEquals("First", items.get(0).title());
        assertEquals("member@example.test", items.get(0).memberEmail());
    }

    @Test
    @DisplayName("List mine: member không tồn tại -> 404")
    void listMineRejectsUnknownMember() {
        when(users.findByEmail(MEMBER)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.listMine(MEMBER));
    }

    // ------------------------------------------------------- listForContentManager

    @Test
    @DisplayName("List CM: không lọc trạng thái thì lấy toàn bộ hàng chờ")
    void listForContentManagerReturnsQueue() {
        when(feedbacks.findAllByStatusInOrderByCreatedAtDesc(any())).thenReturn(List.of(
                feedback(1L, MemberFeedback.Status.PENDING, MemberFeedback.Category.GENERAL,
                        "One", LocalDateTime.of(2026, 1, 1, 10, 0)),
                feedback(2L, MemberFeedback.Status.IN_REVIEW, MemberFeedback.Category.GENERAL,
                        "Two", LocalDateTime.of(2026, 1, 2, 10, 0))));
        when(users.findAllById(any())).thenReturn(List.of(user(1L, MEMBER, "Member")));

        FeedbackListResponse response = service.listForContentManager(
                null, null, null, null, null);

        assertEquals(2, response.total());
        assertEquals(1, response.pending());
        assertEquals(1, response.inReview());
    }

    @Test
    @DisplayName("List CM: lọc theo trạng thái cụ thể")
    void listForContentManagerFiltersByStatus() {
        when(feedbacks.findAllByStatusOrderByCreatedAtDesc(MemberFeedback.Status.RESOLVED))
                .thenReturn(List.of(feedback(1L, MemberFeedback.Status.RESOLVED,
                        MemberFeedback.Category.GENERAL, "Done", LocalDateTime.now())));
        when(users.findAllById(any())).thenReturn(List.of());

        FeedbackListResponse response = service.listForContentManager(
                MemberFeedback.Status.RESOLVED, null, null, null, null);

        assertEquals(1, response.total());
        assertEquals(1, response.resolved());
    }

    @Test
    @DisplayName("List CM: lọc theo nhóm nội dung")
    void listForContentManagerFiltersByCategory() {
        when(feedbacks.findAllByStatusInOrderByCreatedAtDesc(any())).thenReturn(List.of(
                feedback(1L, MemberFeedback.Status.PENDING, MemberFeedback.Category.TECHNICAL,
                        "Tech", LocalDateTime.now()),
                feedback(2L, MemberFeedback.Status.PENDING, MemberFeedback.Category.GENERAL,
                        "General", LocalDateTime.now())));
        when(users.findAllById(any())).thenReturn(List.of());

        FeedbackListResponse response = service.listForContentManager(
                null, MemberFeedback.Category.TECHNICAL, null, null, null);

        assertEquals(1, response.total());
        assertEquals("TECHNICAL", response.items().get(0).category());
    }

    @Test
    @DisplayName("List CM: tìm kiếm theo tiêu đề, nội dung, tên và email của member")
    void listForContentManagerSearchesMultipleFields() {
        LocalDateTime now = LocalDateTime.now();
        when(feedbacks.findAllByStatusInOrderByCreatedAtDesc(any())).thenReturn(List.of(
                feedback(1L, MemberFeedback.Status.PENDING, MemberFeedback.Category.GENERAL,
                        "Broken video", now),
                feedback(2L, MemberFeedback.Status.PENDING, MemberFeedback.Category.GENERAL,
                        "Other", now)));
        when(users.findAllById(any())).thenReturn(List.of(user(1L, MEMBER, "Nguyen Van A")));

        assertEquals(1, service.listForContentManager(null, null, "broken", null, null).total());
        assertEquals(1, service.listForContentManager(null, null, "Content of Broken", null, null).total());
        assertEquals(2, service.listForContentManager(null, null, "nguyen", null, null).total());
        assertEquals(2, service.listForContentManager(null, null, "member@", null, null).total());
        assertEquals(0, service.listForContentManager(null, null, "khong-ton-tai", null, null).total());
    }

    @Test
    @DisplayName("List CM: lọc theo khoảng ngày gửi")
    void listForContentManagerFiltersByDateRange() {
        when(feedbacks.findAllByStatusInOrderByCreatedAtDesc(any())).thenReturn(List.of(
                feedback(1L, MemberFeedback.Status.PENDING, MemberFeedback.Category.GENERAL,
                        "Old", LocalDateTime.of(2026, 1, 1, 10, 0)),
                feedback(2L, MemberFeedback.Status.PENDING, MemberFeedback.Category.GENERAL,
                        "New", LocalDateTime.of(2026, 3, 1, 10, 0))));
        when(users.findAllById(any())).thenReturn(List.of());

        assertEquals(1, service.listForContentManager(null, null, null,
                LocalDate.of(2026, 2, 1), null).total());
        assertEquals(1, service.listForContentManager(null, null, null,
                null, LocalDate.of(2026, 1, 31)).total());
        assertEquals(0, service.listForContentManager(null, null, null,
                LocalDate.of(2027, 1, 1), null).total());
    }

    @Test
    @DisplayName("List CM: đơn không có createdAt bị loại khi lọc theo ngày")
    void listForContentManagerSkipsRowsWithoutCreatedAt() {
        MemberFeedback row = feedback(1L, MemberFeedback.Status.PENDING, MemberFeedback.Category.GENERAL,
                "No date", LocalDateTime.now());
        row.setCreatedAt(null);
        when(feedbacks.findAllByStatusInOrderByCreatedAtDesc(any())).thenReturn(List.of(row));
        when(users.findAllById(any())).thenReturn(List.of());

        assertEquals(0, service.listForContentManager(null, null, null,
                LocalDate.of(2026, 1, 1), null).total());
    }

    // ------------------------------------------------------------------- detail

    @Test
    @DisplayName("Detail: trả về thông tin đơn kèm thông tin member")
    void detailReturnsFeedback() {
        MemberFeedback row = feedback(1L, MemberFeedback.Status.PENDING, MemberFeedback.Category.GENERAL,
                "Issue", LocalDateTime.now());
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));
        when(users.findById(1L)).thenReturn(Optional.of(user(1L, MEMBER, "Member")));

        FeedbackResponse response = service.detailForContentManager(1L);

        assertEquals("Issue", response.title());
        assertEquals("Member", response.memberName());
    }

    @Test
    @DisplayName("Detail: đơn không tồn tại -> 404")
    void detailRejectsUnknownFeedback() {
        when(feedbacks.findById(9L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.detailForContentManager(9L));
    }

    @Test
    @DisplayName("Detail: member đã bị xoá -> memberName null")
    void detailHandlesDeletedMember() {
        MemberFeedback row = feedback(1L, MemberFeedback.Status.PENDING, MemberFeedback.Category.GENERAL,
                "Issue", LocalDateTime.now());
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));
        when(users.findById(1L)).thenReturn(Optional.empty());

        FeedbackResponse response = service.detailForContentManager(1L);

        assertNull(response.memberName());
        assertNull(response.memberEmail());
    }

    // -------------------------------------------------------------- takeInReview

    @Test
    @DisplayName("Take in review: chuyển đơn sang IN_REVIEW")
    void takeInReviewChangesStatus() {
        MemberFeedback row = feedback(1L, MemberFeedback.Status.PENDING, MemberFeedback.Category.GENERAL,
                "Issue", LocalDateTime.now());
        when(users.findByEmail(MANAGER)).thenReturn(Optional.of(user(9L, MANAGER, "CM")));
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));
        when(users.findById(1L)).thenReturn(Optional.of(user(1L, MEMBER, "Member")));

        FeedbackResponse response = service.takeInReview(MANAGER, 1L);

        assertEquals("IN_REVIEW", response.status());
        assertEquals(9L, response.handledBy());
    }

    @Test
    @DisplayName("Take in review: đơn đã chuyển tiếp lên Admin -> 409")
    void takeInReviewRejectsEscalatedFeedback() {
        MemberFeedback row = feedback(1L, MemberFeedback.Status.ESCALATED, MemberFeedback.Category.GENERAL,
                "Issue", LocalDateTime.now());
        when(users.findByEmail(MANAGER)).thenReturn(Optional.of(user(9L, MANAGER, "CM")));
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.takeInReview(MANAGER, 1L));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    // ------------------------------------------------------ handleByContentManager

    @Test
    @DisplayName("Handle CM: APPROVE đóng đơn và báo cho member")
    void handleApproveClosesFeedback() {
        MemberFeedback row = feedback(1L, MemberFeedback.Status.IN_REVIEW, MemberFeedback.Category.GENERAL,
                "Issue", LocalDateTime.now());
        when(users.findByEmail(MANAGER)).thenReturn(Optional.of(user(9L, MANAGER, "CM")));
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));
        when(users.findById(1L)).thenReturn(Optional.of(user(1L, MEMBER, "Member")));

        FeedbackResponse response = service.handleByContentManager(MANAGER, 1L,
                new HandleFeedbackRequest("APPROVE", "Fixed it"));

        assertEquals("RESOLVED", response.status());
        assertEquals("Fixed it", response.resolutionNote());
        assertNotNull(response.resolvedAt());

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notifications).save(captor.capture());
        assertEquals(1L, captor.getValue().getUserId());
        assertEquals("SPECIFIC_USER", captor.getValue().getTargetAudience());
    }

    @Test
    @DisplayName("Handle CM: APPROVE không có ghi chú -> vẫn thông báo member")
    void handleApproveWithoutNote() {
        MemberFeedback row = feedback(1L, MemberFeedback.Status.IN_REVIEW, MemberFeedback.Category.GENERAL,
                "Issue", LocalDateTime.now());
        when(users.findByEmail(MANAGER)).thenReturn(Optional.of(user(9L, MANAGER, "CM")));
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));
        when(users.findById(1L)).thenReturn(Optional.of(user(1L, MEMBER, "Member")));

        FeedbackResponse response = service.handleByContentManager(MANAGER, 1L,
                new HandleFeedbackRequest("APPROVE", "   "));

        assertEquals("RESOLVED", response.status());
        assertNull(response.resolutionNote());
        verify(notifications).save(any(Notification.class));
    }

    @Test
    @DisplayName("Handle CM: ESCALATE chuyển đơn lên Admin")
    void handleEscalateNotifiesAdmins() {
        MemberFeedback row = feedback(1L, MemberFeedback.Status.IN_REVIEW, MemberFeedback.Category.GENERAL,
                "Issue", LocalDateTime.now());
        when(users.findByEmail(MANAGER)).thenReturn(Optional.of(user(9L, MANAGER, "CM")));
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));

        FeedbackResponse response = service.handleByContentManager(MANAGER, 1L,
                new HandleFeedbackRequest("ESCALATE", "System bug"));

        assertEquals("ESCALATED", response.status());
        assertNotNull(response.escalatedAt());

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notifications).save(captor.capture());
        assertEquals("ADMIN", captor.getValue().getTargetAudience());
    }

    @Test
    @DisplayName("Handle CM: REJECT báo member là không chấp nhận")
    void handleRejectNotifiesMember() {
        MemberFeedback row = feedback(1L, MemberFeedback.Status.IN_REVIEW, MemberFeedback.Category.GENERAL,
                "Issue", LocalDateTime.now());
        when(users.findByEmail(MANAGER)).thenReturn(Optional.of(user(9L, MANAGER, "CM")));
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));
        when(users.findById(1L)).thenReturn(Optional.of(user(1L, MEMBER, "Member")));

        FeedbackResponse response = service.handleByContentManager(MANAGER, 1L,
                new HandleFeedbackRequest("REJECT", "Out of scope"));

        assertEquals("REJECTED", response.status());

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notifications).save(captor.capture());
        assertTrue(captor.getValue().getTitle().contains("not accepted"));
    }

    @Test
    @DisplayName("Handle CM: đơn đã đóng -> 409")
    void handleRejectsClosedFeedback() {
        MemberFeedback row = feedback(1L, MemberFeedback.Status.RESOLVED, MemberFeedback.Category.GENERAL,
                "Issue", LocalDateTime.now());
        when(users.findByEmail(MANAGER)).thenReturn(Optional.of(user(9L, MANAGER, "CM")));
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.handleByContentManager(MANAGER, 1L,
                        new HandleFeedbackRequest("APPROVE", "x")));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    @DisplayName("Handle CM: đơn đã chuyển tiếp lên Admin -> 409")
    void handleRejectsEscalatedFeedback() {
        MemberFeedback row = feedback(1L, MemberFeedback.Status.ESCALATED, MemberFeedback.Category.GENERAL,
                "Issue", LocalDateTime.now());
        when(users.findByEmail(MANAGER)).thenReturn(Optional.of(user(9L, MANAGER, "CM")));
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.handleByContentManager(MANAGER, 1L,
                        new HandleFeedbackRequest("APPROVE", "x")));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    @DisplayName("Handle CM: action không hợp lệ -> 400")
    void handleRejectsInvalidAction() {
        MemberFeedback row = feedback(1L, MemberFeedback.Status.IN_REVIEW, MemberFeedback.Category.GENERAL,
                "Issue", LocalDateTime.now());
        when(users.findByEmail(MANAGER)).thenReturn(Optional.of(user(9L, MANAGER, "CM")));
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));

        assertThrows(RequestValidationException.class,
                () -> service.handleByContentManager(MANAGER, 1L,
                        new HandleFeedbackRequest("NOPE", "x")));
    }

    @Test
    @DisplayName("Handle CM: action rỗng -> 400")
    void handleRejectsBlankAction() {
        MemberFeedback row = feedback(1L, MemberFeedback.Status.IN_REVIEW, MemberFeedback.Category.GENERAL,
                "Issue", LocalDateTime.now());
        when(users.findByEmail(MANAGER)).thenReturn(Optional.of(user(9L, MANAGER, "CM")));
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));

        assertThrows(RequestValidationException.class,
                () -> service.handleByContentManager(MANAGER, 1L,
                        new HandleFeedbackRequest("  ", "x")));
    }

    // ------------------------------------------------------------- listForAdmin

    @Test
    @DisplayName("List admin: mặc định chỉ lấy đơn đã chuyển tiếp")
    void listForAdminReturnsEscalatedOnly() {
        when(feedbacks.findAllByEscalatedAtIsNotNullOrderByCreatedAtDesc()).thenReturn(List.of(
                feedback(1L, MemberFeedback.Status.ESCALATED, MemberFeedback.Category.GENERAL,
                        "Escalated", LocalDateTime.now())));
        when(users.findAllById(any())).thenReturn(List.of());

        FeedbackListResponse response = service.listForAdmin(null, null, null, null, null);

        assertEquals(1, response.total());
        assertEquals(1, response.escalated());
    }

    @Test
    @DisplayName("List admin: lọc theo trạng thái vẫn giữ điều kiện đã chuyển tiếp")
    void listForAdminFiltersByStatus() {
        when(feedbacks.findAllByEscalatedAtIsNotNullAndStatusOrderByCreatedAtDesc(
                MemberFeedback.Status.RESOLVED)).thenReturn(List.of(
                feedback(1L, MemberFeedback.Status.RESOLVED, MemberFeedback.Category.GENERAL,
                        "Resolved", LocalDateTime.now())));
        when(users.findAllById(any())).thenReturn(List.of());

        assertEquals(1, service.listForAdmin(
                MemberFeedback.Status.RESOLVED, null, null, null, null).total());
    }

    // -------------------------------------------------------------- handleByAdmin

    @Test
    @DisplayName("Handle admin: RESOLVE đóng đơn đã chuyển tiếp")
    void handleByAdminResolvesEscalated() {
        MemberFeedback row = feedback(1L, MemberFeedback.Status.ESCALATED, MemberFeedback.Category.GENERAL,
                "Issue", LocalDateTime.now());
        when(users.findByEmail(ADMIN)).thenReturn(Optional.of(user(99L, ADMIN, "Admin")));
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));
        when(users.findById(1L)).thenReturn(Optional.of(user(1L, MEMBER, "Member")));

        FeedbackResponse response = service.handleByAdmin(ADMIN, 1L,
                new HandleFeedbackRequest("RESOLVE", "Fixed by admin"));

        assertEquals("RESOLVED", response.status());
        assertEquals(99L, response.handledBy());
        verify(notifications).save(any(Notification.class));
    }

    @Test
    @DisplayName("Handle admin: REJECT đóng đơn dạng không chấp nhận")
    void handleByAdminRejectsEscalated() {
        MemberFeedback row = feedback(1L, MemberFeedback.Status.ESCALATED, MemberFeedback.Category.GENERAL,
                "Issue", LocalDateTime.now());
        when(users.findByEmail(ADMIN)).thenReturn(Optional.of(user(99L, ADMIN, "Admin")));
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));
        when(users.findById(1L)).thenReturn(Optional.of(user(1L, MEMBER, "Member")));

        FeedbackResponse response = service.handleByAdmin(ADMIN, 1L,
                new HandleFeedbackRequest("REJECT", "Cannot fix"));

        assertEquals("REJECTED", response.status());
    }

    @Test
    @DisplayName("Handle admin: đơn chưa chuyển tiếp -> 409")
    void handleByAdminRejectsNonEscalated() {
        MemberFeedback row = feedback(1L, MemberFeedback.Status.PENDING, MemberFeedback.Category.GENERAL,
                "Issue", LocalDateTime.now());
        when(users.findByEmail(ADMIN)).thenReturn(Optional.of(user(99L, ADMIN, "Admin")));
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.handleByAdmin(ADMIN, 1L, new HandleFeedbackRequest("RESOLVE", "x")));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    @DisplayName("Handle admin: action APPROVE không được phép -> 400")
    void handleByAdminRejectsApproveAction() {
        MemberFeedback row = feedback(1L, MemberFeedback.Status.ESCALATED, MemberFeedback.Category.GENERAL,
                "Issue", LocalDateTime.now());
        when(users.findByEmail(ADMIN)).thenReturn(Optional.of(user(99L, ADMIN, "Admin")));
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.handleByAdmin(ADMIN, 1L, new HandleFeedbackRequest("APPROVE", "x")));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Detail admin: trả về chi tiết đơn")
    void detailForAdminReturnsFeedback() {
        MemberFeedback row = feedback(1L, MemberFeedback.Status.ESCALATED, MemberFeedback.Category.GENERAL,
                "Issue", LocalDateTime.now());
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));
        when(users.findById(1L)).thenReturn(Optional.of(user(1L, MEMBER, "Member")));

        assertEquals("Issue", service.detailForAdmin(1L).title());
    }
}
