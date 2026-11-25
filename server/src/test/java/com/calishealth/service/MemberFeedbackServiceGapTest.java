package com.calishealth.service;

import com.calishealth.dtos.MemberFeedbackDtos.HandleFeedbackRequest;
import com.calishealth.models.MemberFeedback;
import com.calishealth.models.User;
import com.calishealth.repository.MemberFeedbackRepository;
import com.calishealth.repository.NotificationRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bo sung coverage cho {@link MemberFeedbackService}: action la, ghi chuaong rong,
 * tim kiem khong co member va thong bao cho member khong ton tai.
 */
class MemberFeedbackServiceGapTest {

    private MemberFeedbackRepository feedbacks;
    private UserRepository users;
    private NotificationRepository notifications;
    private MemberFeedbackService service;

    @BeforeEach
    void setUp() {
        feedbacks = mock(MemberFeedbackRepository.class);
        users = mock(UserRepository.class);
        notifications = mock(NotificationRepository.class);
        service = new MemberFeedbackService(feedbacks, users, notifications);
    }

    private static User user(long id, String email, String fullName) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setFullName(fullName);
        return user;
    }

    private static MemberFeedback feedback(MemberFeedback.Status status) {
        MemberFeedback feedback = new MemberFeedback();
        feedback.setId(1L);
        feedback.setMemberId(7L);
        feedback.setTitle("Broken video");
        feedback.setContent("The demo does not play");
        feedback.setStatus(status);
        return feedback;
    }

    @Test
    @DisplayName("handleByContentManager: action la -> 400")
    void contentManagerRejectsUnknownAction() {
        User handler = user(2L, "cm@calishealth.vn", "CM");
        when(users.findByEmail("cm@calishealth.vn")).thenReturn(Optional.of(handler));
        when(feedbacks.findById(1L)).thenReturn(Optional.of(feedback(MemberFeedback.Status.IN_REVIEW)));

        assertThatThrownBy(() -> service.handleByContentManager("cm@calishealth.vn", 1L,
                new HandleFeedbackRequest("DELETE", "note")))
                .isInstanceOf(com.calishealth.exception.RequestValidationException.class);
    }

    @Test
    @DisplayName("handleByContentManager: ghi chuaong rong -> luu null")
    void contentManagerTreatsBlankNoteAsNull() {
        User handler = user(2L, "cm@calishealth.vn", "CM");
        when(users.findByEmail("cm@calishealth.vn")).thenReturn(Optional.of(handler));
        MemberFeedback row = feedback(MemberFeedback.Status.IN_REVIEW);
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));
        lenient().when(users.findById(7L)).thenReturn(Optional.of(user(7L, "m@calishealth.vn", "Member")));
        when(feedbacks.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = service.handleByContentManager("cm@calishealth.vn", 1L,
                new HandleFeedbackRequest("APPROVE", "   "));

        assertThat(response.resolutionNote()).isNull();
    }

    @Test
    @DisplayName("handleByContentManager: REJECT -> member nhan thong bao")
    void contentManagerRejectNotifiesMember() {
        User handler = user(2L, "cm@calishealth.vn", "CM");
        when(users.findByEmail("cm@calishealth.vn")).thenReturn(Optional.of(handler));
        MemberFeedback row = feedback(MemberFeedback.Status.IN_REVIEW);
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));
        when(users.findById(7L)).thenReturn(Optional.of(user(7L, "m@calishealth.vn", "Member")));
        when(feedbacks.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = service.handleByContentManager("cm@calishealth.vn", 1L,
                new HandleFeedbackRequest("REJECT", null));

        assertThat(response.status()).isEqualTo("REJECTED");
        org.mockito.Mockito.verify(notifications).save(any());
    }

    @Test
    @DisplayName("handleByContentManager: REJECT khi member khong ton tai -> khong nem loi")
    void contentManagerRejectToleratesMissingMember() {
        User handler = user(2L, "cm@calishealth.vn", "CM");
        when(users.findByEmail("cm@calishealth.vn")).thenReturn(Optional.of(handler));
        MemberFeedback row = feedback(MemberFeedback.Status.IN_REVIEW);
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));
        when(users.findById(7L)).thenReturn(Optional.empty());
        when(feedbacks.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = service.handleByContentManager("cm@calishealth.vn", 1L,
                new HandleFeedbackRequest("REJECT", null));

        assertThat(response.status()).isEqualTo("REJECTED");
    }

    @Test
    @DisplayName("handleByAdmin: RESOLVE -> member nhan thong bao")
    void adminResolveNotifiesMember() {
        User admin = user(3L, "admin@calishealth.vn", "Admin");
        when(users.findByEmail("admin@calishealth.vn")).thenReturn(Optional.of(admin));
        MemberFeedback row = feedback(MemberFeedback.Status.ESCALATED);
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));
        when(users.findById(7L)).thenReturn(Optional.of(user(7L, "m@calishealth.vn", "Member")));
        when(feedbacks.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = service.handleByAdmin("admin@calishealth.vn", 1L,
                new HandleFeedbackRequest("RESOLVE", "Fixed"));

        assertThat(response.status()).isEqualTo("RESOLVED");
        assertThat(response.resolutionNote()).isEqualTo("Fixed");
    }

    @Test
    @DisplayName("handleByAdmin: RESOLVE khi member khong ton tai -> khong nem loi")
    void adminResolveToleratesMissingMember() {
        User admin = user(3L, "admin@calishealth.vn", "Admin");
        when(users.findByEmail("admin@calishealth.vn")).thenReturn(Optional.of(admin));
        MemberFeedback row = feedback(MemberFeedback.Status.ESCALATED);
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));
        when(users.findById(7L)).thenReturn(Optional.empty());
        when(feedbacks.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = service.handleByAdmin("admin@calishealth.vn", 1L,
                new HandleFeedbackRequest("RESOLVE", "Fixed"));

        assertThat(response.status()).isEqualTo("RESOLVED");
    }

    @Test
    @DisplayName("handleByAdmin: RESOLVE ghi chuaong rong -> luu null")
    void adminTreatsBlankNoteAsNull() {
        User admin = user(3L, "admin@calishealth.vn", "Admin");
        when(users.findByEmail("admin@calishealth.vn")).thenReturn(Optional.of(admin));
        MemberFeedback row = feedback(MemberFeedback.Status.ESCALATED);
        when(feedbacks.findById(1L)).thenReturn(Optional.of(row));
        lenient().when(users.findById(7L)).thenReturn(Optional.of(user(7L, "m@calishealth.vn", "Member")));
        when(feedbacks.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = service.handleByAdmin("admin@calishealth.vn", 1L,
                new HandleFeedbackRequest("RESOLVE", "  "));

        assertThat(response.resolutionNote()).isNull();
    }

    @Test
    @DisplayName("listForAdmin: tu khoa khong khop -> danh sach rong")
    void adminListWithUnmatchedSearchIsEmpty() {
        MemberFeedback row = feedback(MemberFeedback.Status.ESCALATED);
        when(feedbacks.findAllByEscalatedAtIsNotNullAndStatusOrderByCreatedAtDesc(MemberFeedback.Status.ESCALATED))
                .thenReturn(List.of(row));

        var response = service.listForAdmin(MemberFeedback.Status.ESCALATED, null, "nothing-matches", null, null);

        assertThat(response.items()).isEmpty();
    }

    @Test
    @DisplayName("listForAdmin: tu khoa khop tieu de -> co ket qua")
    void adminListWithMatchingTitleHasResult() {
        MemberFeedback row = feedback(MemberFeedback.Status.ESCALATED);
        when(feedbacks.findAllByEscalatedAtIsNotNullAndStatusOrderByCreatedAtDesc(MemberFeedback.Status.ESCALATED))
                .thenReturn(List.of(row));
        lenient().when(users.findById(7L)).thenReturn(Optional.of(user(7L, "m@calishealth.vn", "Member")));

        var response = service.listForAdmin(MemberFeedback.Status.ESCALATED, null, "broken", null, null);

        assertThat(response.items()).hasSize(1);
    }

    @Test
    @DisplayName("listForAdmin: khong trang thai -> dung danh sach da chuyen tiep")
    void adminListWithoutStatusUsesEscalatedList() {
        MemberFeedback row = feedback(MemberFeedback.Status.ESCALATED);
        when(feedbacks.findAllByEscalatedAtIsNotNullOrderByCreatedAtDesc()).thenReturn(List.of(row));
        lenient().when(users.findById(7L)).thenReturn(Optional.of(user(7L, "m@calishealth.vn", "Member")));

        var response = service.listForAdmin(null, null, null, null, null);

        assertThat(response.items()).hasSize(1);
    }
}
