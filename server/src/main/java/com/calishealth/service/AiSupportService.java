package com.calishealth.service;

import com.calishealth.dtos.AiSupportDtos;
import com.calishealth.dtos.AiSupportDtos.AnswerResponse;
import com.calishealth.dtos.AiSupportDtos.AskQuestionRequest;
import com.calishealth.dtos.AiSupportDtos.AskQuestionResponse;
import com.calishealth.dtos.AiSupportDtos.LikelyCause;
import com.calishealth.dtos.AiSupportDtos.QuotaResponse;
import com.calishealth.dtos.ExercisePhysiologyDTO;
import com.calishealth.dtos.PhysiologyAlertDTO;
import com.calishealth.exception.OpenAiException;
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
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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
@Slf4j
public class AiSupportService {

    /**
     * Số lượt hỏi/đáp cũ (trong cùng phiên chat) được gửi lại cho AI.
     *
     * AI nhớ được ngữ cảnh cuộc trò chuyện mà vẫn giữ prompt gọn và rẻ.
     */
    private static final int HISTORY_TURNS = 4;

    private final AiSupportUsageRepository usageRepository;
    private final AiSupportMessageRepository messageRepository;
    private final AiSupportSessionRepository sessionRepository;
    private final UserRepository users;
    private final ExerciseRepository exercises;
    private final FormRuleRepository formRules;
    private final OpenAiChatService openAi;
    private final GeminiChatService gemini;
    private final ContentModerationService moderation;
    /** Đọc hồ sơ sinh lý (V76) của bài tập để ground câu trả lời AI. */
    private final ExercisePhysiologyService physiologyService;
    /** Chọn luật cảnh báo sinh lý khớp với bài tập (V76). */
    private final PhysiologyAlertService physiologyAlerts;
    /** Chặn red flag y tế và đối chiếu chống chỉ định của bài. */
    private final ExerciseSafetyService safetyService;
    /**
     * Provider AI đang dùng: "gemini", "openai" hoặc null (không có API nào).
     *
     * Ưu tiên Gemini vì free tier không cần nạp credit; đổi sang OpenAI
     * bằng cách đặt AI_PROVIDER=openai trong .env.
     */
    private final String aiProvider;

    public AiSupportService(
            AiSupportUsageRepository usageRepository,
            AiSupportMessageRepository messageRepository,
            AiSupportSessionRepository sessionRepository,
            UserRepository users,
            ExerciseRepository exercises,
            FormRuleRepository formRules,
            OpenAiChatService openAi,
            GeminiChatService gemini,
            ContentModerationService moderation,
            ExercisePhysiologyService physiologyService,
            PhysiologyAlertService physiologyAlerts,
            ExerciseSafetyService safetyService,
            @Value("${app.ai.provider:auto}") String aiProvider) {
        this.usageRepository = usageRepository;
        this.messageRepository = messageRepository;
        this.sessionRepository = sessionRepository;
        this.users = users;
        this.exercises = exercises;
        this.formRules = formRules;
        this.openAi = openAi;
        this.gemini = gemini;
        this.moderation = moderation;
        this.physiologyService = physiologyService;
        this.physiologyAlerts = physiologyAlerts;
        this.safetyService = safetyService;
        this.aiProvider = aiProvider == null ? "" : aiProvider.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * Provider sẽ dùng cho lượt hỏi tiếp theo.
     *
     * "auto" -> ưu tiên Gemini (free tier), fallback sang OpenAI nếu Gemini
     * chưa có key. Trả null khi không provider nào sẵn sàng.
     */
    private AiChatProvider activeProvider() {
        boolean preferOpenAi = "openai".equals(aiProvider);
        if (!preferOpenAi && gemini.isConfigured()) {
            return gemini;
        }
        if (preferOpenAi && openAi.isConfigured()) {
            return openAi;
        }
        if (gemini.isConfigured()) {
            return gemini;
        }
        if (openAi.isConfigured()) {
            return openAi;
        }
        return null;
    }

    // ---------------------------------------------------------------- quota

    /** Trạng thái quota hôm nay của member (để mở popup mà không cần hỏi trước). */
    @Transactional(readOnly = true)
    public QuotaResponse quota(String email, String sessionId) {
        User user = users.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "The signed-in user no longer exists"));
        int used = usageRepository.findByUser_IdAndUsageDate(user.getId(), LocalDate.now())
                .map(AiSupportUsage::getQuestionCount)
                .orElse(0);
        AiChatProvider provider = activeProvider();
        return new QuotaResponse(
                used,
                AiSupportUsage.DAILY_QUESTION_LIMIT,
                Math.max(0, AiSupportUsage.DAILY_QUESTION_LIMIT - used),
                AiSupportUsage.SESSION_QUESTION_LIMIT,
                countSessionQuestions(user.getId(), sessionId),
                provider != null,
                provider == null ? null : provider.model(),
                provider == null ? openAi.isDemoFallbackEnabled() : provider.isDemoFallbackEnabled());
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
     * Cảnh báo sinh lý (V76) của một bài tập.
     *
     * <p>Member xem được cảnh báo mà không cần mở popup hỏi AI — ví dụ ở màn
     * chi tiết bài tập trước khi bắt đầu buổi tập.
     *
     * @param exerciseCode mã bài tập
     * @return danh sách luật cảnh báo khớp (rỗng nếu bài không có hồ sơ sinh lý)
     */
    @Transactional(readOnly = true)
    public List<PhysiologyAlertDTO> alertsFor(String exerciseCode) {
        return alertsFor(exerciseCode, null);
    }

    /**
     * Cảnh báo sinh lý của bài tập, có tính ngữ cảnh buổi tập của member.
     *
     * @param exerciseCode mã bài tập
     * @param userId       id member (null nếu chưa đăng nhập)
     * @return danh sách luật cảnh báo khớp (rỗng nếu bài không có hồ sơ sinh lý)
     */
    @Transactional(readOnly = true)
    public List<PhysiologyAlertDTO> alertsFor(String exerciseCode, Long userId) {
        Exercise exercise = exercises.findByCode(exerciseCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Exercise not found"));
        int staticCount = physiologyAlerts.countStaticExercisesInLatestSession(userId);
        return physiologyAlerts.evaluate(physiologyService.loadProfile(exercise.getId()), staticCount, userId);
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

        // Hồ sơ sinh lý (V76) của bài tập — chỉ bài SYSTEM mới có. Dùng để
        // ground câu trả lời AI bằng dữ liệu sinh lý có trích dẫn bằng chứng.
        ExercisePhysiologyDTO physiology = physiologyService.loadProfile(exercise.getId());
        int staticCount = physiologyAlerts.countStaticExercisesInLatestSession(user.getId());
        List<PhysiologyAlertDTO> alerts = physiologyAlerts.evaluate(physiology, staticCount, user.getId());

        // Lớp bảo vệ 1: red flag y tế -> KHÔNG gọi AI, hướng member tới bác sĩ.
        String redFlag = safetyService.redFlagMessage(question);
        if (redFlag != null) {
            AnswerResponse safe = redFlagAnswer(redFlag);
            return finishAsk(user, exercise, sessionId, question, safe,
                    usage, sessionIndex, "safety-guard", 0, "MEDICAL_RED_FLAG", alerts);
        }

        // Lớp bảo vệ 2: member nhắc tới bệnh nền nằm trong chống chỉ định của bài.
        List<String> contraindicationHits =
                safetyService.matchedContraindications(physiology, question);

        String systemPrompt = buildSystemPrompt(
                exercise, rules, request.formIssues(), request.accuracy(),
                physiology, alerts, contraindicationHits);

        AnswerResponse answer;
        int tokens;
        String provider;
        String notice = null;
        AiChatProvider active = activeProvider();
        if (active != null) {
            try {
                List<AiChatProvider.ChatMessage> chat =
                        buildChatHistory(user.getId(), sessionId, question);
                AiChatProvider.ChatResult result = active.chat(systemPrompt, chat);
                answer = active.toAnswer(result.content());
                tokens = result.totalTokens();
                provider = active.model();
            } catch (OpenAiException exception) {
                // Chế độ demo: API lỗi (hết credit, mạng, rate limit) -> trả lời
                // bằng rule nội bộ kèm cờ báo rõ, để demo vẫn chạy được.
                if (!active.isDemoFallbackEnabled()) {
                    throw exception;
                }
                log.warn("AI provider unavailable, serving the local demo answer: {}", exception.getCode());
                answer = fallbackAnswer(exercise, rules, request.formIssues(), question);
                tokens = 0;
                provider = "local-rules";
                notice = exception.getCode();
            }
        } else {
            // Chưa cấu hình API key -> trả lời bằng rule nội bộ kèm cờ báo rõ.
            answer = fallbackAnswer(exercise, rules, request.formIssues(), question);
            tokens = 0;
            provider = "local-rules";
            notice = "AI_NOT_CONFIGURED";
        }

        return finishAsk(user, exercise, sessionId, question, answer,
                usage, sessionIndex, provider, tokens, notice, alerts);
    }

    /**
     * Lưu lịch sử, cập nhật bộ đếm quota và dựng response trả về cho client.
     *
     * @param user       member đang hỏi
     * @param exercise   bài tập liên quan
     * @param sessionId  id phiên chat
     * @param question   câu hỏi của member
     * @param answer     câu trả lời đã cấu trúc
     * @param usage      dòng quota hôm nay (đã khoá)
     * @param sessionIndex số thứ tự câu hỏi trong phiên
     * @param provider   nguồn câu trả lời
     * @param tokens     số token đã dùng
     * @param notice     mã lý do dùng câu trả lời nội bộ (null nếu AI thật)
     * @param alerts     luật cảnh báo sinh lý khớp với bài tập
     */
    private AskQuestionResponse finishAsk(User user, Exercise exercise, String sessionId,
                                          String question, AnswerResponse answer,
                                          AiSupportUsage usage, int sessionIndex,
                                          String provider, int tokens, String notice,
                                          List<PhysiologyAlertDTO> alerts) {
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
                AiSupportUsage.SESSION_QUESTION_LIMIT,
                provider,
                tokens,
                notice,
                alerts);
    }

    /**
     * Câu trả lời an toàn khi câu hỏi chứa triệu chứng red flag y tế.
     *
     * <p>Không gọi AI và không đưa vào prompt — AI Support không được phép chẩn
     * đoán hay tư vấn y tế. Member được hướng dẫn tới chuyên gia.
     */
    private AnswerResponse redFlagAnswer(String guidance) {
        List<LikelyCause> causes = List.of(new LikelyCause(
                "Cần bác sĩ đánh giá trực tiếp",
                guidance));
        return new AnswerResponse(
                causes,
                "Hãy dừng bài này và đi khám bác sĩ. AI Support chỉ hỗ trợ về kỹ thuật "
                        + "tập, không thể chẩn đoán hay tư vấn y tế.",
                List.of("Làm sao để tôi tập lại an toàn sau khi đã khám?"));
    }

    /**
     * Dựng lịch sử hội thoại để gửi kèm lệnh gọi AI.
     *
     * Chỉ lấy các lượt trong cùng phiên chat và giới hạn số lượt gần nhất để
     * không làm prompt phình to. Mỗi lượt cũ được gửi lại đúng 2 message
     * (user hỏi + assistant trả lời) để AI nhớ được ngữ cảnh.
     *
     * @param userId    id member đang hỏi
     * @param sessionId id phiên chat (null/blank -> chỉ gửi câu hỏi mới)
     * @param question  câu hỏi mới của member
     */
    private List<AiChatProvider.ChatMessage> buildChatHistory(Long userId, String sessionId, String question) {
        List<AiChatProvider.ChatMessage> messages = new ArrayList<>();
        if (sessionId != null && !sessionId.isBlank()) {
            List<AiSupportMessage> previous = messageRepository
                    .findByUser_IdAndSessionIdOrderByCreatedAtAsc(userId, sessionId);
            // Chỉ giữ N lượt gần nhất -> prompt gọn, giá rẻ.
            int from = Math.max(0, previous.size() - HISTORY_TURNS);
            for (AiSupportMessage item : previous.subList(from, previous.size())) {
                messages.add(AiChatProvider.ChatMessage.user(item.getQuestion()));
                String answer = item.getAnswer();
                if (answer != null && !answer.isBlank()) {
                    messages.add(AiChatProvider.ChatMessage.assistant(answerAsPlainText(answer)));
                }
            }
        }
        messages.add(AiChatProvider.ChatMessage.user(question));
        return messages;
    }

    /**
     * Đổi câu trả lời đã lưu (JSON) thành văn bản thuần cho AI đọc.
     *
     * Lịch sử chỉ để AI nhớ ngữ cảnh, không cần đúng định dạng JSON đầy đủ —
     * dạng text dễ đọc hơn và tiết kiệm token.
     */
    private String answerAsPlainText(String answerJson) {
        AnswerResponse answer = openAi.toAnswer(answerJson);
        StringBuilder builder = new StringBuilder();
        for (LikelyCause cause : answer.causes()) {
            if (cause.title() != null && !cause.title().isBlank()) {
                builder.append("- ").append(cause.title());
                if (cause.detail() != null && !cause.detail().isBlank()) {
                    builder.append(": ").append(cause.detail());
                }
                builder.append('\n');
            }
        }
        if (answer.tip() != null && !answer.tip().isBlank()) {
            builder.append("Tip: ").append(answer.tip()).append('\n');
        }
        return builder.toString().trim();
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
     * <p>Ngữ cảnh lấy từ dữ liệu thật (form rules do Content Manager khai báo)
     * để AI không nói chung chung mà bám đúng bài member vừa tập.
     *
     * <p>Ngoài ra prompt được ground bằng hồ sơ sinh lý (V76) của bài tập và các
     * luật cảnh báo sinh lý đã được kiểm chứng, để AI giải thích đúng cơ chế
     * (VD: bài co tĩnh làm huyết áp tĩnh tăng) thay vì đoán mò.
     */
    private String buildSystemPrompt(Exercise exercise, List<FormRule> rules,
                                     List<String> formIssues, Double accuracy,
                                     ExercisePhysiologyDTO physiology,
                                     List<PhysiologyAlertDTO> alerts,
                                     List<String> contraindicationHits) {
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

        appendPhysiologyContext(prompt, physiology, alerts, contraindicationHits);

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

    /**
     * Thêm ngữ cảnh sinh lý (V76) vào system prompt.
     *
     * <p>Hồ sơ sinh lý do Content Manager khai báo và đã đối chiếu với nguồn học
     * thuật. AI được phép dùng các dữ kiện này để giải thích cơ chế, nhưng vẫn
     * không được chẩn đoán hay khuyến nghị điều trị.
     */
    private void appendPhysiologyContext(StringBuilder prompt, ExercisePhysiologyDTO physiology,
                                         List<PhysiologyAlertDTO> alerts,
                                         List<String> contraindicationHits) {
        if (physiology == null && (alerts == null || alerts.isEmpty())) {
            return;
        }
        prompt.append("\n\nPhysiology profile for this exercise");
        prompt.append(" (declared by the content team and checked against published evidence).");
        prompt.append(" Use it to explain WHY a form error happens and how to train safely.");

        if (physiology != null) {
            if (physiology.contractionType() != null) {
                prompt.append("\n- contraction type: ").append(physiology.contractionType());
            }
            if (physiology.leverGrade() != null) {
                prompt.append("\n- lever grade (1-5, higher means further from the joint axis): ")
                        .append(physiology.leverGrade());
            }
            if (physiology.cardiovascularLoad() != null) {
                prompt.append("\n- cardiovascular load (1-5): ").append(physiology.cardiovascularLoad());
            }
            if (physiology.hrZoneLow() != null && physiology.hrZoneHigh() != null) {
                prompt.append("\n- estimated target heart-rate zone: ")
                        .append(physiology.hrZoneLow()).append("-").append(physiology.hrZoneHigh())
                        .append("% of max HR (HRmax = 208 - 0.7 x age, Tanaka 2001)");
            }
            if (physiology.bloodPressureEffect() != null) {
                prompt.append("\n- blood-pressure effect: ").append(physiology.bloodPressureEffect());
            }
            if (physiology.valsalvaRisk() != null) {
                prompt.append("\n- breath-holding (Valsalva) risk: ").append(physiology.valsalvaRisk());
            }
            if (physiology.giRisk() != null) {
                prompt.append("\n- digestive discomfort risk: ").append(physiology.giRisk());
            }
            if (physiology.tendonLoad() != null) {
                prompt.append("\n- tendon load (1-5): ").append(physiology.tendonLoad());
            }
            if (physiology.primaryJoint() != null) {
                prompt.append("\n- primary joint: ").append(physiology.primaryJoint());
            }
            if (physiology.breathingCue() != null && !physiology.breathingCue().isBlank()) {
                prompt.append("\n- breathing cue: \"").append(physiology.breathingCue()).append('"');
            }
            if (physiology.physiologyNote() != null && !physiology.physiologyNote().isBlank()) {
                prompt.append("\n- note: \"").append(physiology.physiologyNote()).append('"');
            }
            if (physiology.evidences() != null && !physiology.evidences().isEmpty()) {
                prompt.append("\n- evidence sources (cite by name when you explain the mechanism): ");
                prompt.append(physiology.evidences().stream()
                        .map(com.calishealth.dtos.PhysiologyEvidenceDTO::title)
                        .filter(java.util.Objects::nonNull)
                        .limit(4)
                        .collect(java.util.stream.Collectors.joining("; ")));
            }
        }

        if (alerts != null && !alerts.isEmpty()) {
            prompt.append("\n\nSafety alerts for this exercise (severity in brackets):");
            for (PhysiologyAlertDTO alert : alerts) {
                prompt.append("\n- [").append(alert.severity()).append("] ")
                        .append(alert.title()).append(" (").append(alert.ruleCode()).append("): ")
                        .append(alert.messageTemplate());
            }
            prompt.append("\nMention the relevant alert when it explains the member's issue, "
                    + "and always include the practical advice it contains.");
        }

        if (contraindicationHits != null && !contraindicationHits.isEmpty()) {
            prompt.append("\n\nIMPORTANT: the member mentioned a health condition that is listed "
                    + "as a contraindication for this exercise (")
                    .append(String.join(", ", contraindicationHits)).append(").");
            prompt.append(" Do NOT diagnose and do NOT tell them to continue or stop medically.");
            prompt.append(" Advise them to consult a qualified clinician before training this exercise,");
            prompt.append(" and keep your technique advice general.");
        }
    }

    /** User prompt — câu hỏi của member kèm ngữ cảnh ngắn gọn. */
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
     *
     * Câu trả lời bám theo ý định câu hỏi (nhiệt, độ sâu, lỗi cụ thể...) và
     * ngữ cảnh thật của bài vừa tập, không phải một bộ cố định cho mọi câu.
     */
    private AnswerResponse fallbackAnswer(Exercise exercise, List<FormRule> rules,
                                          List<String> formIssues, String question) {
        List<LikelyCause> causes = new ArrayList<>();
        String joint = rules.isEmpty() ? "BODY" : rules.get(0).getJoint();
        String feedback = rules.isEmpty() ? null : rules.get(0).getFeedbackMessage();
        String name = exercise.getName();
        String lower = question == null ? "" : question.toLowerCase(Locale.ROOT);

        // Lỗi form đã phát hiện trong buổi tập — nguyên nhân đáng tin nhất.
        if (formIssues != null && !formIssues.isEmpty()) {
            for (String issue : formIssues) {
                if (issue == null || issue.isBlank()) {
                    continue;
                }
                String detail = "The AI tracker flagged \"" + issue.trim()
                        + "\" during your set, so this is the most likely cause.";
                causes.add(new LikelyCause(issue.trim(), detail));
            }
        }

        // Nguyên nhân theo ý định câu hỏi.
        if (mentions(lower, "warm", "warmup", "warm-up", "prepare", "stretch",
                "khởi động", "làm sắn", "giãn cơ")) {
            causes.add(new LikelyCause(
                    "Warm-up not specific enough",
                    "A general warm-up does not wake up the stabilisers that hold your " + joint.toLowerCase(Locale.ROOT)
                            + " in line. Add 2-3 activation sets of " + name
                            + " at a controlled tempo before your working sets."));
        }
        if (mentions(lower, "rest", "recover", "sleep", "tired", "fatigue", "break",
                "nghỉ", "nghi", "hồi phục", "mệt", "mỏi", "giữa các set")) {
            causes.add(new LikelyCause(
                    "Recovery not long enough between sets",
                    "Your stabiliser muscles need roughly 60-90 seconds on the same movement to recover fully. "
                            + "Chaining " + name + " sets back to back is the usual reason your form drops "
                            + "as the set gets harder."));
        }
        if (mentions(lower, "depth", "range", "rom", "low", "higher", "shallow",
                "độ sâu", "sâu", "thấp", "nông", "biên độ")) {
            causes.add(new LikelyCause(
                    "Range of motion shorter than required",
                    "The tracker scores a rep as clean only when your " + joint.toLowerCase(Locale.ROOT)
                            + " reaches the required depth"
                            + (rules.isEmpty() || rules.get(0).getRomDepth() == null
                            ? " for " + name
                            : " (" + rules.get(0).getRomDepth().stripTrailingZeros().toPlainString() + "°)")
                            + ", so stopping short marks the whole set as inaccurate."));
        }
        if (mentions(lower, "tempo", "fast", "slow", "speed", "pace", "bounce",
                "nhịp", "tốc độ", "nhanh", "chậm", "nhảy")) {
            causes.add(new LikelyCause(
                    "Tempo too fast to control the joint",
                    "A fast rep passes through the correct position without staying there, so the tracker "
                            + "never sees a stable joint angle and counts it as an inaccurate rep."));
        }
        if (mentions(lower, "weight", "heavier", "lighter", "difficulty", "easier", "harder", "load",
                "tạ", "nặng", "nhẹ", "khó", "dễ", "tăng", "giảm")) {
            causes.add(new LikelyCause(
                    "Load outpaces the current capacity",
                    "When the load is too high, the muscles that stabilise the " + joint.toLowerCase(Locale.ROOT)
                            + " give out before the target muscles fatigue. Drop to a lighter variation of "
                            + name + " and rebuild from there."));
        }
        if (mentions(lower, "shoulder", "elbow", "knee", "hip", "back", "wrist", "ankle", "neck",
                "vai", "khuỷu", "gối", "hông", "lưng", "cổ tay", "cổ chân", "cổ")) {
            String bodyPart = bodyPartIn(lower);
            causes.add(new LikelyCause(
                    bodyPart + " alignment under load",
                    "Your " + bodyPart + " drifts as the set gets harder, which means the muscles around it "
                            + "are not keeping the joint stacked over the correct axis of movement."));
        }
        if (mentions(lower, "why", "cause", "reason", "wrong", "happen", "mean",
                "vì sao", "tại sao", "là sao", "nguyên nhân", "sai", "lỗi")) {
            causes.add(new LikelyCause(
                    joint + " position drifts under load",
                    "Your " + joint.toLowerCase(Locale.ROOT)
                            + " alignment changes as the set gets harder, which usually means the stabiliser "
                            + "muscles fatigue before the target muscles do."));
        }
        if (mentions(lower, "fix", "correct", "improve", "how", "solve", "avoid",
                "sửa", "làm sao", "cải thiện", "tránh", "thực hiện")) {
            causes.add(new LikelyCause(
                    "Muscle memory of the old pattern",
                    "Repeating the same shape trains the pattern. Move slowly through the bottom position "
                            + "and pause there for a beat so the corrected pattern gets the attention it needs."));
        }

        // Chưa khớp ý định nào -> nói thẳng là chưa đủ thông tin, kèm gợi ý hỏi.
        if (causes.isEmpty()) {
            causes.add(new LikelyCause(
                    "Need more detail about the error",
                    "The tracker data for " + name + " does not say which joint moved, so the likely cause "
                            + "cannot be pinned down. Ask about the specific joint, the depth you reached, "
                            + "or how fast you performed the reps."));
        }

        // Bổ sung nguyên nhân theo ngữ cảnh thật cho tới khi đủ 3 nguyên nhân,
        // để member luôn nhận được gợi ý đủ thông tin.
        List<String> contextCauses = List.of(
                joint + " position drifts under load",
                "Insufficient range of motion",
                "Tempo not controlled");
        List<String> contextDetails = List.of(
                "Your " + joint.toLowerCase(Locale.ROOT)
                        + " alignment changes as the set gets harder, which usually means the stabiliser "
                        + "muscles fatigue before the target muscles do.",
                "The rep stops before the joint reaches the depth the AI tracker requires ("
                        + (rules.isEmpty() || rules.get(0).getRomDepth() == null
                        ? "see the exercise's form rule"
                        : rules.get(0).getRomDepth().stripTrailingZeros().toPlainString() + "°")
                        + "), so the set is scored as inaccurate.",
                "Moving too fast between positions means the joint passes through the correct range without "
                        + "staying there long enough to be counted as a clean rep.");
        for (int index = 0; index < contextCauses.size() && causes.size() < 3; index += 1) {
            causes.add(new LikelyCause(contextCauses.get(index), contextDetails.get(index)));
        }

        // Giới hạn 3 nguyên nhân như thiết kế.
        while (causes.size() > 3) {
            causes.remove(causes.size() - 1);
        }

        String tip = feedback != null && !feedback.isBlank()
                ? "Tip: " + feedback
                : "Tip: slow the set down and hold the correct position for a beat at the bottom.";

        List<String> followUps = List.of(
                "How do I warm up for " + name + "?",
                "What rest should I take between sets of " + name + "?");

        return new AnswerResponse(causes, tip, followUps);
    }

    /**
     * Kiểm tra câu hỏi có chứa một trong các từ khoá không.
     *
     * @param lower câu hỏi đã chuyển chữ thường
     * @param words  các từ khoá cần tìm
     */
    private boolean mentions(String lower, String... words) {
        for (String word : words) {
            if (lower.contains(word)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Tìm khớp cơ thể được nhắc tới trong câu hỏi.
     *
     * @param lower câu hỏi đã chuyển chữ thường
     */
    private String bodyPartIn(String lower) {
        for (String part : List.of("shoulder", "elbow", "knee", "hip", "wrist", "ankle", "back", "neck")) {
            if (lower.contains(part)) {
                return Character.toUpperCase(part.charAt(0)) + part.substring(1);
            }
        }
        for (String part : List.of("vai", "khuỷu", "gối", "hông", "cổ tay", "cổ chân", "lưng", "cổ")) {
            if (lower.contains(part)) {
                return Character.toUpperCase(part.charAt(0)) + part.substring(1);
            }
        }
        return "Joint";
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
