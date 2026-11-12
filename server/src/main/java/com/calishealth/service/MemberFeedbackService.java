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
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Luồng góp ý & khiếu nại của Member.
 *
 * <p>Luồng xử lý:
 * <ol>
 *   <li>Member gửi đơn -> trạng thái {@code PENDING}, Content Manager nhận thông báo.</li>
 *   <li>Content Manager tự giải quyết được -> {@code RESOLVED} + ghi chú, Member
 *       nhận thông báo kết quả.</li>
 *   <li>Vấn đề thuộc về hệ thống -> {@code ESCALATED}, Admin nhận thông báo để
 *       xử lý tiếp.</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
public class MemberFeedbackService {
    /**
     * Trạng thái mà Content Manager theo dõi — gồm cả đơn chưa xử lý, đơn đã
     * chuyển tiếp lên Admin và đơn đã đóng (để CM xem lại lịch sử xử lý).
     */
    private static final Set<MemberFeedback.Status> CONTENT_MANAGER_QUEUE = EnumSet.of(
            MemberFeedback.Status.PENDING,
            MemberFeedback.Status.IN_REVIEW,
            MemberFeedback.Status.ESCALATED,
            MemberFeedback.Status.RESOLVED,
            MemberFeedback.Status.REJECTED
    );

    private final MemberFeedbackRepository feedbacks;
    private final UserRepository users;
    private final NotificationRepository notifications;

    // ------------------------------------------------------------------
    // Member
    // ------------------------------------------------------------------

    /** Member tạo đơn góp ý — đơn luôn vào hàng chờ của Content Manager. */
    @Transactional
    public FeedbackResponse create(String memberEmail, CreateFeedbackRequest request) {
        User member = requireUser(memberEmail);
        MemberFeedback feedback = new MemberFeedback();
        feedback.setMemberId(member.getId());
        feedback.setTitle(request.title().trim());
        feedback.setContent(request.content().trim());
        feedback.setCategory(parseCategory(request.categoryOrDefault()));
        feedback.setStatus(MemberFeedback.Status.PENDING);
        feedback.setCreatedAt(java.time.LocalDateTime.now());
        feedback.setUpdatedAt(java.time.LocalDateTime.now());

        MemberFeedback saved = feedbacks.save(feedback);
        notifyContentManagers(saved);
        return toResponse(saved, member);
    }

    /** Danh sách đơn của chính Member. */
    @Transactional(readOnly = true)
    public List<FeedbackResponse> listMine(String memberEmail) {
        User member = requireUser(memberEmail);
        List<MemberFeedback> rows = feedbacks.findAllByMemberIdOrderByCreatedAtDesc(member.getId());
        List<FeedbackResponse> items = new ArrayList<>(rows.size());
        for (MemberFeedback row : rows) {
            items.add(toResponse(row, member));
        }
        return items;
    }

    // ------------------------------------------------------------------
    // Content Manager
    // ------------------------------------------------------------------

    /**
     * Content Manager xem toàn bộ đơn.
     *
     * @param status lọc theo trạng thái (null = tất cả)
     * @param category lọc theo nhóm nội dung (null = tất cả)
     * @param search tìm theo tên/email thành viên hoặc tiêu đề/nội dung đơn
     * @param fromDate chỉ lấy đơn gửi từ ngày này (bao gồm)
     * @param toDate chỉ lấy đơn gửi đến hết ngày này
     */
    @Transactional(readOnly = true)
    public FeedbackListResponse listForContentManager(MemberFeedback.Status status,
                                                       MemberFeedback.Category category,
                                                       String search,
                                                       LocalDate fromDate,
                                                       LocalDate toDate) {
        List<MemberFeedback> rows = status == null
                ? feedbacks.findAllByStatusInOrderByCreatedAtDesc(CONTENT_MANAGER_QUEUE)
                : feedbacks.findAllByStatusOrderByCreatedAtDesc(status);
        return buildListResponse(filterRows(rows, category, search, fromDate, toDate));
    }

    /** Chi tiết một đơn góp ý — dùng cho màn chi tiết của Content Manager. */
    @Transactional(readOnly = true)
    public FeedbackResponse detailForContentManager(Long feedbackId) {
        MemberFeedback feedback = requireFeedback(feedbackId);
        return toResponse(feedback, memberOf(feedback));
    }

    /** Content Manager nhận việc — chuyển đơn sang {@code IN_REVIEW}. */
    @Transactional
    public FeedbackResponse takeInReview(String handlerEmail, Long feedbackId) {
        User handler = requireUser(handlerEmail);
        MemberFeedback feedback = requireFeedback(feedbackId);
        if (feedback.getStatus() == MemberFeedback.Status.ESCALATED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This feedback has already been escalated to the admin");
        }
        feedback.setStatus(MemberFeedback.Status.IN_REVIEW);
        feedback.setHandledBy(handler.getId());
        feedbacks.save(feedback);
        return toResponse(feedback, memberOf(feedback));
    }

    /**
     * Content Manager xử lý đơn.
     *
     * @param action {@code APPROVE} (tự giải quyết) | {@code ESCALATE} (chuyển lên
     *               Admin) | {@code REJECT} (không chấp nhận)
     */
    @Transactional
    public FeedbackResponse handleByContentManager(String handlerEmail, Long feedbackId, HandleFeedbackRequest request) {
        User handler = requireUser(handlerEmail);
        MemberFeedback feedback = requireFeedback(feedbackId);
        if (feedback.getStatus().isClosed()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This feedback is already closed");
        }
        if (feedback.getStatus() == MemberFeedback.Status.ESCALATED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This feedback has already been escalated to the admin");
        }

        String action = parseAction(request.action());
        String note = request.resolutionNote() == null ? null : request.resolutionNote().trim();
        if (note != null && note.isEmpty()) {
            note = null;
        }
        feedback.setHandledBy(handler.getId());

        switch (action) {
            case "APPROVE" -> {
                feedback.setStatus(MemberFeedback.Status.RESOLVED);
                feedback.setResolutionNote(note);
                feedback.setResolvedAt(java.time.LocalDateTime.now());
                feedbacks.save(feedback);
                notifyMemberResolved(feedback, memberOf(feedback));
            }
            case "ESCALATE" -> {
                feedback.setStatus(MemberFeedback.Status.ESCALATED);
                feedback.setResolutionNote(note);
                feedback.setEscalatedAt(java.time.LocalDateTime.now());
                feedbacks.save(feedback);
                notifyAdminsEscalated(feedback);
            }
            case "REJECT" -> {
                feedback.setStatus(MemberFeedback.Status.REJECTED);
                feedback.setResolutionNote(note);
                feedback.setResolvedAt(java.time.LocalDateTime.now());
                feedbacks.save(feedback);
                notifyMemberRejected(feedback, memberOf(feedback));
            }
            default -> throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Action must be APPROVE, ESCALATE or REJECT");
        }

        return toResponse(feedback, memberOf(feedback));
    }

    // ------------------------------------------------------------------
    // Admin
    // ------------------------------------------------------------------

    /**
     * Admin xem các đơn đã được chuyển tiếp lên.
     *
     * <p>Admin chỉ quản lý những đơn Content Manager đã chuyển tiếp, nên danh
     * sách mặc định chỉ gồm các đơn có {@code escalatedAt} — tức đã từng được
     * chuyển tiếp lên Admin. Lọc theo trạng thái cũng giữ nguyên điều kiện này
     * để Admin không thấy đơn chưa từng chuyển tiếp.
     *
     * @param status lọc theo trạng thái (null = mọi đơn đã chuyển tiếp)
     * @param category lọc theo nhóm nội dung (null = tất cả)
     * @param search tìm theo tên/email thành viên hoặc tiêu đề/nội dung đơn
     * @param fromDate chỉ lấy đơn gửi từ ngày này (bao gồm)
     * @param toDate chỉ lấy đơn gửi đến hết ngày này
     */
    @Transactional(readOnly = true)
    public FeedbackListResponse listForAdmin(MemberFeedback.Status status,
                                             MemberFeedback.Category category,
                                             String search,
                                             LocalDate fromDate,
                                             LocalDate toDate) {
        List<MemberFeedback> rows = status == null
                ? feedbacks.findAllByEscalatedAtIsNotNullOrderByCreatedAtDesc()
                : feedbacks.findAllByEscalatedAtIsNotNullAndStatusOrderByCreatedAtDesc(status);
        return buildListResponse(filterRows(rows, category, search, fromDate, toDate));
    }

    /** Chi tiết một đơn góp ý — dùng cho màn chi tiết của Admin. */
    @Transactional(readOnly = true)
    public FeedbackResponse detailForAdmin(Long feedbackId) {
        MemberFeedback feedback = requireFeedback(feedbackId);
        return toResponse(feedback, memberOf(feedback));
    }

    /**
     * Admin quyết định cuối cùng cho đơn đã chuyển tiếp.
     *
     * @param action {@code RESOLVE} (đóng đơn) | {@code REJECT} (không chấp nhận)
     */
    @Transactional
    public FeedbackResponse handleByAdmin(String adminEmail, Long feedbackId, HandleFeedbackRequest request) {
        User admin = requireUser(adminEmail);
        MemberFeedback feedback = requireFeedback(feedbackId);
        if (feedback.getStatus() != MemberFeedback.Status.ESCALATED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Only escalated feedback can be handled by the admin");
        }

        String action = parseAction(request.action());
        if (!action.equals("RESOLVE") && !action.equals("REJECT")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Action must be RESOLVE or REJECT");
        }

        String note = request.resolutionNote() == null ? null : request.resolutionNote().trim();
        if (note != null && note.isEmpty()) {
            note = null;
        }
        feedback.setHandledBy(admin.getId());
        feedback.setResolutionNote(note);
        feedback.setResolvedAt(java.time.LocalDateTime.now());
        boolean rejected = action.equals("REJECT");
        feedback.setStatus(rejected
                ? MemberFeedback.Status.REJECTED
                : MemberFeedback.Status.RESOLVED);
        feedbacks.save(feedback);

        if (rejected) {
            notifyMemberRejected(feedback, memberOf(feedback));
        } else {
            notifyMemberResolved(feedback, memberOf(feedback));
        }
        return toResponse(feedback, memberOf(feedback));
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /**
     * Áp bộ lọc phía server: nhóm nội dung, từ khoá tìm kiếm và khoảng ngày gửi.
     *
     * <p>Tìm kiếm khớp theo tên/email thành viên, tiêu đề và nội dung đơn.
     */
    private List<MemberFeedback> filterRows(List<MemberFeedback> rows,
                                            MemberFeedback.Category category,
                                            String search,
                                            LocalDate fromDate,
                                            LocalDate toDate) {
        Map<Long, User> members = loadMembers(rows);
        String term = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        LocalDateTime from = fromDate == null ? null : fromDate.atStartOfDay();
        LocalDateTime toExclusive = toDate == null ? null : toDate.plusDays(1).atStartOfDay();

        List<MemberFeedback> filtered = new ArrayList<>(rows.size());
        for (MemberFeedback row : rows) {
            if (category != null && row.getCategory() != category) {
                continue;
            }
            if (from != null && (row.getCreatedAt() == null || row.getCreatedAt().isBefore(from))) {
                continue;
            }
            if (toExclusive != null && (row.getCreatedAt() == null || !row.getCreatedAt().isBefore(toExclusive))) {
                continue;
            }
            if (!term.isEmpty() && !matchesSearch(row, members.get(row.getMemberId()), term)) {
                continue;
            }
            filtered.add(row);
        }
        return filtered;
    }

    private boolean matchesSearch(MemberFeedback row, User member, String term) {
        if (contains(row.getTitle(), term) || contains(row.getContent(), term)) {
            return true;
        }
        if (member == null) {
            return false;
        }
        return contains(member.getFullName(), term) || contains(member.getEmail(), term);
    }

    private boolean contains(String value, String term) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(term);
    }

    private FeedbackListResponse buildListResponse(List<MemberFeedback> rows) {
        Map<Long, User> members = loadMembers(rows);
        List<FeedbackResponse> items = new ArrayList<>(rows.size());
        for (MemberFeedback row : rows) {
            items.add(toResponse(row, members.get(row.getMemberId())));
        }
        return new FeedbackListResponse(
                items,
                items.size(),
                rows.stream().filter(row -> row.getStatus() == MemberFeedback.Status.PENDING).count(),
                rows.stream().filter(row -> row.getStatus() == MemberFeedback.Status.IN_REVIEW).count(),
                rows.stream().filter(row -> row.getStatus() == MemberFeedback.Status.ESCALATED).count(),
                rows.stream().filter(row -> row.getStatus() == MemberFeedback.Status.RESOLVED).count()
        );
    }

    private Map<Long, User> loadMembers(List<MemberFeedback> rows) {
        Set<Long> ids = new java.util.LinkedHashSet<>();
        rows.forEach(row -> ids.add(row.getMemberId()));
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, User> map = new HashMap<>();
        users.findAllById(ids).forEach(user -> map.put(user.getId(), user));
        return map;
    }

    private FeedbackResponse toResponse(MemberFeedback feedback, User member) {
        return new FeedbackResponse(
                feedback.getId(),
                feedback.getTitle(),
                feedback.getContent(),
                feedback.getCategory().name(),
                feedback.getStatus().name(),
                feedback.getResolutionNote(),
                feedback.getMemberId(),
                member == null ? null : member.getFullName(),
                member == null ? null : member.getEmail(),
                feedback.getHandledBy(),
                feedback.getEscalatedAt(),
                feedback.getResolvedAt(),
                feedback.getCreatedAt(),
                feedback.getUpdatedAt()
        );
    }

    private User memberOf(MemberFeedback feedback) {
        return users.findById(feedback.getMemberId()).orElse(null);
    }

    private void notifyContentManagers(MemberFeedback feedback) {
        Notification notification = new Notification();
        notification.setTargetAudience("CONTENT_MANAGER");
        notification.setTitle("New member feedback: " + feedback.getTitle());
        notification.setMessage(feedback.getContent());
        notification.setType("UPDATE");
        notification.setStatus("PUBLISHED");
        notifications.save(notification);
    }

    private void notifyAdminsEscalated(MemberFeedback feedback) {
        Notification notification = new Notification();
        notification.setTargetAudience("ADMIN");
        notification.setTitle("Feedback escalated to admin: " + feedback.getTitle());
        notification.setMessage(feedback.getContent());
        notification.setType("UPDATE");
        notification.setStatus("PUBLISHED");
        notifications.save(notification);
    }

    private void notifyMemberResolved(MemberFeedback feedback, User member) {
        if (member == null) {
            return;
        }
        Notification notification = new Notification();
        notification.setUserId(member.getId());
        notification.setTargetAudience("SPECIFIC_USER");
        notification.setTitle("Your feedback has been resolved");
        notification.setMessage(feedback.getResolutionNote() == null
                ? "Feedback \"" + feedback.getTitle() + "\" has been resolved."
                : feedback.getTitle() + ": " + feedback.getResolutionNote());
        notification.setType("UPDATE");
        notification.setStatus("PUBLISHED");
        notifications.save(notification);
    }

    private void notifyMemberRejected(MemberFeedback feedback, User member) {
        if (member == null) {
            return;
        }
        Notification notification = new Notification();
        notification.setUserId(member.getId());
        notification.setTargetAudience("SPECIFIC_USER");
        notification.setTitle("Your feedback was not accepted");
        notification.setMessage(feedback.getResolutionNote() == null
                ? "Feedback \"" + feedback.getTitle() + "\" could not be accepted."
                : feedback.getTitle() + ": " + feedback.getResolutionNote());
        notification.setType("UPDATE");
        notification.setStatus("PUBLISHED");
        notifications.save(notification);
    }

    private MemberFeedback requireFeedback(Long id) {
        return feedbacks.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Feedback not found: " + id));
    }

    private User requireUser(String email) {
        return users.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Authenticated user was not found"));
    }

    private MemberFeedback.Category parseCategory(String category) {
        try {
            return MemberFeedback.Category.valueOf(category.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new RequestValidationException(
                    "category",
                    "Category must be GENERAL, EXERCISE_CONTENT, WORKOUT_CONTENT, TECHNICAL or OTHER");
        }
    }

    private String parseAction(String action) {
        if (action == null || action.isBlank()) {
            throw new RequestValidationException("action", "Action is required");
        }
        String normalized = action.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("APPROVE", "ESCALATE", "REJECT", "RESOLVE").contains(normalized)) {
            throw new RequestValidationException(
                    "action",
                    "Action must be APPROVE, ESCALATE, REJECT or RESOLVE");
        }
        return normalized;
    }
}
