package com.calishealth.service;

import com.calishealth.dtos.AiSupportDtos;
import com.calishealth.dtos.AiSupportDtos.AnswerResponse;
import com.calishealth.dtos.AiSupportDtos.AskQuestionRequest;
import com.calishealth.dtos.AiSupportDtos.AskQuestionResponse;
import com.calishealth.dtos.AiSupportDtos.LikelyCause;
import com.calishealth.dtos.AiSupportDtos.QuotaResponse;
import com.calishealth.models.AiSupportMessage;
import com.calishealth.models.AiSupportSession;
import com.calishealth.models.AiSupportUsage;
import com.calishealth.models.Exercise;
import com.calishealth.models.FormRule;
import com.calishealth.models.User;
import com.calishealth.repository.AiSupportMessageRepository;
import com.calishealth.repository.AiSupportSessionRepository;
import com.calishealth.repository.AiSupportUsageRepository;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FormRuleRepository;
import com.calishealth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * AI Support — member hỏi AI về lỗi form sau buổi tập.
 *
 * Quota: mỗi member tối đa {@link AiSupportUsage#DAILY_QUESTION_LIMIT} câu/ngày
 * (reset 00:00 theo giờ server) và tối đa {@link AiSupportUsage#SESSION_QUESTION_LIMIT}
 * câu trong một phiên chat mở.
 *
 * Câu trả lời được bám theo ngữ cảnh thật của bài vừa tập: tên bài, ngưỡng
 * form rules, accuracy và danh sách lỗi form AI đã phát hiện.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiSupportService {

    private final AiSupportUsageRepository usageRepository;
    private final AiSupportMessageRepository messageRepository;
    private final AiSupportSessionRepository sessionRepository;
    private final UserRepository users;
    private final ExerciseRepository exercises;
    private final FormRuleRepository formRules;
    private final OpenAiChatService openAi;
    private final ContentModerationService moderation;

    // ---------------------------------------------------------------- quota

    /** Trạng thái quota hôm nay của member (để mở popup mà không cần hỏi trước). */
    @Transactional(readOnly = true)
    public QuotaResponse quota(String email, String sessionId) {
        User user = users.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "The signed-in user no longer exists"));
        int used = usageRepository.findByUser_IdAndUsageDate(user.getId(), LocalDate.now())
                .map(AiSupportUsage::getQuestionCount)
                .orElse(0);
        return new QuotaResponse(
                used,
                AiSupportUsage.DAILY_QUESTION_LIMIT,
                Math.max(0, AiSupportUsage.DAILY_QUESTION_LIMIT - used),
                AiSupportUsage.SESSION_QUESTION_LIMIT,
                countSessionQuestions(user.getId(), sessionId));
    }

    // ------------------------------------------------------------------ ask

    /**
     * Lịch sử hỏi của member hôm nay (mới nhất trước).
     *
     * Cho phép member mở lại popup sau khi đóng và vẫn thấy hội thoại hôm nay.
     */
    @Transactional(readOnly = true)
    public List<AiSupportDtos.HistoryItem> history(String email) {
        User user = users.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "The signed-in user no longer exists"));
        LocalDateTime from = LocalDate.now().atStartOfDay();
        return messageRepository
                .findByUser_IdAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc(user.getId(), from)
                .stream()
                .map(item -> new AiSupportDtos.HistoryItem(
                        item.getExercise() != null ? item.getExercise().getName() : null,
                        item.getQuestion(),
                        item.getAnswer(),
                        item.getSessionId(),
                        item.getCreatedAt()))
                .toList();
    }

    /**
     * Lịch sử hỏi của một phiên chat cụ thể (cũ nhất trước).
     *
     * Dùng để khôi phục hội thoại khi member đóng popup rồi mở lại.
     */
    @Transactional(readOnly = true)
    public List<AiSupportDtos.HistoryItem> sessionHistory(String email, String sessionId) {
        User user = users.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "The signed-in user no longer exists"));
        if (sessionId == null || sessionId.isBlank()) {
            return List.of();
        }
        return messageRepository
                .findByUser_IdAndSessionIdOrderByCreatedAtAsc(user.getId(), sessionId)
                .stream()
                .map(item -> new AiSupportDtos.HistoryItem(
                        item.getExercise() != null ? item.getExercise().getName() : null,
                        item.getQuestion(),
                        item.getAnswer(),
                        item.getSessionId(),
                        item.getCreatedAt()))
                .toList();
    }

    /**
     * Member đặt câu hỏi — trả về câu trả lời có cấu trúc.
     *
     * @param email  email member đang đăng nhập
     * @param request câu hỏi + bài tập liên quan
     */
    @Transactional
    public AskQuestionResponse ask(String email, AskQuestionRequest request) {
        User user = users.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "The signed-in user no longer exists"));
        Exercise exercise = exercises.findByCode(request.exerciseCode())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Exercise not found"));

        String question = request.question().trim();

        // Chặn câu hỏi chứa từ ngữ không phù hợp (dùng chung bộ lọc của khu vực
        // content) để tránh lạm dụng và trả lời nội dung không liên quan.
        String flagged = moderation.findFlaggedWords(question, null, null, null).stream().findFirst().orElse(null);
        if (flagged != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Please rephrase your question without inappropriate language.");
        }

        // Chặn chạm hạn mức ngày (khoá ghi để request song song không vượt).
        AiSupportUsage usage = lockUsage(user);
        if (usage.getQuestionCount() >= AiSupportUsage.DAILY_QUESTION_LIMIT) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "You've used all " + AiSupportUsage.DAILY_QUESTION_LIMIT
                            + " AI questions for today. Your quota resets tomorrow.");
        }

        // Chặn chạm hạn mức phiên chat (5 câu). Phiên do client sinh khi mở
        // popup và gửi kèm -> đếm chính xác số câu đã hỏi trong phiên này.
        String sessionId = request.sessionId();
        int sessionIndex = 1;
        if (sessionId != null && !sessionId.isBlank()) {
            AiSupportSession session = lockSession(user, sessionId);
            if (session.getQuestionCount() >= AiSupportUsage.SESSION_QUESTION_LIMIT) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "This AI support chat is limited to " + AiSupportUsage.SESSION_QUESTION_LIMIT
                                + " questions. Close it and open a new chat to keep going.");
            }
            sessionIndex = session.getQuestionCount() + 1;
            session.setQuestionCount(sessionIndex);
            sessionRepository.save(session);
        }

        List<FormRule> rules = formRules.findByExerciseCode(exercise.getCode());
        String systemPrompt = buildSystemPrompt(exercise, rules, request.formIssues(), request.accuracy());
        String userPrompt = buildUserPrompt(question, rules, request.formIssues(), request.accuracy());

        AnswerResponse answer;
        int tokens;
        if (openAi.isConfigured()) {
            try {
                OpenAiChatService.ChatResult result = openAi.chat(systemPrompt, userPrompt);
                answer = openAi.toAnswer(result.content());
                tokens = result.totalTokens();
            } catch (Exception exception) {
                log.error("OpenAI call failed, falling back to local answer", exception);
                answer = fallbackAnswer(exercise, rules, question);
                tokens = 0;
            }
        } else {
            // Chưa cấu hình API key -> vẫn trả lời được bằng rule nội bộ để
            // member không bị "chết" giữa chừng khi triển khai.
            answer = fallbackAnswer(exercise, rules, question);
            tokens = 0;
        }

        // Ghi lại lịch sử + bộ đếm quota.
        AiSupportMessage message = new AiSupportMessage();
        message.setUser(user);
        message.setExercise(exercise);
        message.setSessionId(sessionId);
        message.setQuestion(question);
        message.setAnswer(renderAnswerJson(answer));
        message.setTotalTokens(tokens);
        messageRepository.save(message);

        usage.setQuestionCount(usage.getQuestionCount() + 1);
        usage.setTotalTokens(usage.getTotalTokens() + tokens);
        usageRepository.save(usage);

        return new AskQuestionResponse(
                answer,
                usage.getQuestionCount(),
                AiSupportUsage.DAILY_QUESTION_LIMIT,
                usage.remaining(),
                sessionIndex,
                AiSupportUsage.SESSION_QUESTION_LIMIT);
    }

    /**
     * Lấy bản ghi quota kèm khóa ghi, tạo mới nếu chưa có.
     *
     * Khóa pessimistic để các request song song không vượt hạn mức ngày:
     * request sau phải chờ request trước trả về rồi mới đọc số lượt đã dùng.
     */
    private AiSupportUsage lockUsage(User user) {
        // Bảo đảm dòng của ngày tồn tại (idempotent, chịu được request song song).
        usageRepository.ensureUsageRow(user.getId(), LocalDate.now());
        return usageRepository.findForUpdate(user.getId(), LocalDate.now())
                .orElseThrow(() -> new IllegalStateException("Could not lock the AI support quota row"));
    }

    /**
     * Số câu đã hỏi trong một phiên chat.
     *
     * Phiên được client sinh khi mở popup và gửi kèm từng câu hỏi, nên đếm
     * theo (user, sessionId) là chính xác — không phụ thuộc thời gian.
     */
    private int countSessionQuestions(Long userId, String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return 0;
        }
        return sessionRepository.countQuestions(userId, sessionId);
    }

    /**
     * Lấy dòng phiên chat kèm khóa ghi, tạo mới nếu chưa có.
     *
     * Khóa pessimistic để các request song song không vượt giới hạn câu/phiên:
     * request sau phải chờ request trước commit rồi mới đọc số lượt.
     */
    private AiSupportSession lockSession(User user, String sessionId) {
        sessionRepository.ensureSessionRow(user.getId(), sessionId);
        return sessionRepository.findForUpdate(user.getId(), sessionId)
                .orElseThrow(() -> new IllegalStateException("Could not lock the AI support session row"));
    }

    // --------------------------------------------------------------- prompt

    /**
     * System prompt — persona AI coach + ngữ cảnh bài tập.
     *
     * Ngữ cảnh lấy từ dữ liệu thật (form rules do Content Manager khai báo)
     * để AI không nói chung chung mà bám đúng bài member vừa tập.
     */
    private String buildSystemPrompt(Exercise exercise, List<FormRule> rules,
                                     List<String> formIssues, Double accuracy) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("""
                You are CalisHealth AI Support, a calisthenics form coach.
                You answer a member's question about form errors detected by the
                AI pose tracker during their workout.

                Rules:
                - Answer ONLY about the exercise and form issues given below.
                - Be concrete: reference the joint, the angle threshold and the
                  form issues detected for THIS exercise.
                - Never give medical, injury-diagnosis or nutrition advice.
                - If the question is unrelated to form or training, politely say
                  you can only help with exercise form and technique.
                - Reply with JSON only, no markdown, using this exact shape:
                  {"causes":[{"title":"short cause name","detail":"one or two sentences"}],
                   "tip":"one actionable tip for this member",
                   "followUps":["suggested follow-up question","another one"]}
                - Provide exactly 3 causes and exactly 2 followUps.
                """);
        prompt.append("\n\nExercise: ").append(exercise.getName());
        if (exercise.getCategory() != null) {
            prompt.append(" (").append(exercise.getCategory()).append(')');
        }
        if (exercise.getMuscleGroup() != null && !exercise.getMuscleGroup().isBlank()) {
            prompt.append(" · target muscles: ").append(exercise.getMuscleGroup());
        }

        if (!rules.isEmpty()) {
            prompt.append("\n\nForm rules used by the AI tracker for this exercise:");
            for (FormRule rule : rules) {
                prompt.append("\n- joint ").append(rule.getJoint());
                if (rule.getAngleThreshold() != null) {
                    prompt.append(", considered fully extended at ")
                            .append(rule.getAngleThreshold().stripTrailingZeros().toPlainString())
                            .append("°");
                }
                if (rule.getRomDepth() != null) {
                    prompt.append(", counts as deep enough at ")
                            .append(rule.getRomDepth().stripTrailingZeros().toPlainString())
                            .append("°");
                }
                if (rule.getFeedbackMessage() != null && !rule.getFeedbackMessage().isBlank()) {
                    prompt.append("; tracker message: \"").append(rule.getFeedbackMessage()).append('"');
                }
            }
        }

        // Lỗi form AI đã phát hiện trong buổi tập — đây là ngữ cảnh quan trọng nhất.
        if (formIssues != null && !formIssues.isEmpty()) {
            prompt.append("\n\nForm issues detected for this member in the session just finished:");
            for (String issue : formIssues) {
                if (issue != null && !issue.isBlank()) {
                    prompt.append("\n- ").append(issue.trim());
                }
            }
        }
        if (accuracy != null) {
            prompt.append("\n\nSession accuracy for this exercise: ")
                    .append(Math.round(accuracy))
                    .append("%");
        }
        return prompt.toString();
    }

    /** User prompt — câu hỏi của member. */
    private String buildUserPrompt(String question, List<FormRule> rules,
                                   List<String> formIssues, Double accuracy) {
        StringBuilder prompt = new StringBuilder(question);
        if (!rules.isEmpty()) {
            prompt.append("\n\n(Form rules for this exercise: ");
            for (FormRule rule : rules) {
                prompt.append(rule.getJoint());
                if (rule.getRomDepth() != null) {
                    prompt.append(" romDepth=").append(rule.getRomDepth().stripTrailingZeros().toPlainString());
                }
                prompt.append("; ");
            }
            prompt.append(')');
        }
        if (formIssues != null && !formIssues.isEmpty()) {
            prompt.append("\n(Detected form issues: ")
                    .append(String.join("; ", formIssues))
                    .append(')');
        }
        return prompt.toString();
    }

    // ------------------------------------------------------------- fallback

    /**
     * Trả lời khi chưa cấu hình API key hoặc lệnh gọi AI thất bại.
     *
     * Dùng nguyên nhân phổ biến theo khớp đang theo dõi + câu nhắc của
     * Content Manager, để member vẫn nhận được gợi ý hữu ích.
     */
    private AnswerResponse fallbackAnswer(Exercise exercise, List<FormRule> rules, String question) {
        List<LikelyCause> causes = new ArrayList<>();
        String joint = rules.isEmpty() ? "BODY" : rules.get(0).getJoint();
        String feedback = rules.isEmpty() ? null : rules.get(0).getFeedbackMessage();

        causes.add(new LikelyCause(
                joint + " position drifts under load",
                "Your " + joint.toLowerCase(Locale.ROOT)
                        + " alignment changes as the set gets harder, which usually means the stabiliser muscles "
                        + "fatigue before the target muscles do."));

        causes.add(new LikelyCause(
                "Insufficient range of motion",
                "The rep stops before the joint reaches the depth the AI tracker requires ("
                        + (rules.isEmpty() || rules.get(0).getRomDepth() == null
                        ? "see the exercise's form rule"
                        : rules.get(0).getRomDepth().stripTrailingZeros().toPlainString() + "°")
                        + "), so the set is scored as inaccurate."));

        causes.add(new LikelyCause(
                "Tempo not controlled",
                "Moving too fast between positions means the joint passes through the correct range without "
                        + "staying there long enough to be counted as a clean rep."));

        String tip = feedback != null && !feedback.isBlank()
                ? "Tip: " + feedback
                : "Tip: slow the set down and hold the correct position for a beat at the bottom.";

        List<String> followUps = List.of(
                "How do I warm up for " + exercise.getName() + "?",
                "What rest should I take between sets of " + exercise.getName() + "?");

        return new AnswerResponse(causes, tip, followUps);
    }

    /** Render câu trả lời thành JSON để client khôi phục lại hội thoại khi mở popup. */
    private String renderAnswerJson(AnswerResponse answer) {
        StringBuilder builder = new StringBuilder();
        builder.append("{\"causes\":[");
        for (int index = 0; index < answer.causes().size(); index += 1) {
            LikelyCause cause = answer.causes().get(index);
            if (index > 0) {
                builder.append(',');
            }
            builder.append("{\"title\":\"").append(escapeJson(cause.title()))
                    .append("\",\"detail\":\"").append(escapeJson(cause.detail()))
                    .append("\"}");
        }
        builder.append("],\"tip\":\"").append(escapeJson(answer.tip()))
                .append("\",\"followUps\":[");
        for (int index = 0; index < answer.followUps().size(); index += 1) {
            if (index > 0) {
                builder.append(',');
            }
            builder.append('"').append(escapeJson(answer.followUps().get(index))).append('"');
        }
        builder.append("]}");
        return builder.toString();
    }

    /** Escape ký tự đặc biệt cho JSON. */
    private String escapeJson(String value) {
        if (value == null) {
            return "";
        }
        StringBuilder builder = new StringBuilder(value.length() + 16);
        for (int index = 0; index < value.length(); index += 1) {
            char character = value.charAt(index);
            switch (character) {
                case '"' -> builder.append("\\\"");
                case '\\' -> builder.append("\\\\");
                case '\n' -> builder.append("\\n");
                case '\r' -> builder.append("\\r");
                case '\t' -> builder.append("\\t");
                default -> {
                    if (character < 0x20) {
                        builder.append(String.format("\\u%04x", (int) character));
                    } else {
                        builder.append(character);
                    }
                }
            }
        }
        return builder.toString();
    }
}
