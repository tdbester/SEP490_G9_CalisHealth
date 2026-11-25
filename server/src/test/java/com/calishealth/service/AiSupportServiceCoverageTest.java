package com.calishealth.service;

import com.calishealth.dtos.AiSupportDtos.AskQuestionRequest;
import com.calishealth.dtos.AiSupportDtos.AskQuestionResponse;
import com.calishealth.dtos.AiSupportDtos.HistoryItem;
import com.calishealth.dtos.AiSupportDtos.LikelyCause;
import com.calishealth.dtos.ExercisePhysiologyDTO;
import com.calishealth.dtos.PhysiologyAlertDTO;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho {@link AiSupportService}: lịch sử hỏi đáp, cảnh báo sinh lý,
 * các nhánh fallback của câu trả lời nội bộ và escape JSON.
 */
class AiSupportServiceCoverageTest {

    private AiSupportUsageRepository usageRepository;
    private AiSupportMessageRepository messageRepository;
    private AiSupportSessionRepository sessionRepository;
    private UserRepository users;
    private ExerciseRepository exercises;
    private FormRuleRepository formRules;
    private OpenAiChatService openAi;
    private GeminiChatService gemini;
    private ContentModerationService moderation;
    private ExercisePhysiologyService physiologyService;
    private PhysiologyAlertService physiologyAlerts;
    private ExerciseSafetyService safetyService;

    private User member;
    private Exercise exercise;

    private static final String EMAIL = "member@calishealth.vn";

    @BeforeEach
    void setUp() {
        usageRepository = mock(AiSupportUsageRepository.class);
        messageRepository = mock(AiSupportMessageRepository.class);
        sessionRepository = mock(AiSupportSessionRepository.class);
        users = mock(UserRepository.class);
        exercises = mock(ExerciseRepository.class);
        formRules = mock(FormRuleRepository.class);
        openAi = mock(OpenAiChatService.class);
        gemini = mock(GeminiChatService.class);
        moderation = mock(ContentModerationService.class);
        physiologyService = mock(ExercisePhysiologyService.class);
        physiologyAlerts = mock(PhysiologyAlertService.class);
        safetyService = new ExerciseSafetyService();

        member = new User();
        member.setId(7L);
        member.setEmail(EMAIL);

        exercise = new Exercise();
        exercise.setId(3L);
        exercise.setCode("SQUAT");
        exercise.setName("Squat");

        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(exercises.findByCode("SQUAT")).thenReturn(Optional.of(exercise));
        lenient().when(formRules.findByExerciseCode("SQUAT")).thenReturn(List.of());
        lenient().when(moderation.findFlaggedWords(anyString(), any(), any(), any())).thenReturn(List.of());
        lenient().when(physiologyService.loadProfile(anyLong())).thenReturn(null);
        lenient().when(physiologyAlerts.evaluate(any(), anyInt(), any())).thenReturn(List.of());
        lenient().when(physiologyAlerts.countStaticExercisesInLatestSession(anyLong())).thenReturn(0);
        lenient().when(messageRepository.findByUser_IdAndSessionIdOrderByCreatedAtAsc(anyLong(), anyString()))
                .thenReturn(List.of());
        lenient().when(sessionRepository.findForUpdate(anyLong(), anyString()))
                .thenAnswer(inv -> {
                    AiSupportSession session = new AiSupportSession();
                    session.setUser(member);
                    session.setSessionId(inv.getArgument(1));
                    session.setQuestionCount(0);
                    return Optional.of(session);
                });
    }

    private AiSupportService service(String provider) {
        return new AiSupportService(
                usageRepository, messageRepository, sessionRepository,
                users, exercises, formRules, openAi, gemini, moderation,
                physiologyService, physiologyAlerts, safetyService, provider);
    }

    private AiSupportUsage usage(int used) {
        AiSupportUsage usage = new AiSupportUsage();
        usage.setUser(member);
        usage.setUsageDate(LocalDate.now());
        usage.setQuestionCount(used);
        usage.setTotalTokens(0);
        return usage;
    }

    private AiSupportSession session(int used) {
        AiSupportSession session = new AiSupportSession();
        session.setUser(member);
        session.setSessionId("session-1");
        session.setQuestionCount(used);
        return session;
    }

    @Test
    @DisplayName("provider null -> chuan hoa thanh chuoi rong")
    void nullProviderIsNormalized() {
        assertThat(service(null)).isNotNull();
        assertThat(service("  ")).isNotNull();
    }

    @Test
    @DisplayName("quota: user khong ton tai -> 401")
    void quotaRejectsUnknownUser() {
        when(users.findByEmail("ghost@x.vn")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service("auto").quota("ghost@x.vn", "session-1"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(401));
    }

    @Test
    @DisplayName("quota: sessionId rong -> sessionUsed = 0")
    void quotaWithoutSessionReportsZero() {
        when(usageRepository.findByUser_IdAndUsageDate(7L, LocalDate.now()))
                .thenReturn(Optional.of(usage(3)));
        when(openAi.isConfigured()).thenReturn(true);
        when(openAi.model()).thenReturn("gpt-4o-mini");
        when(openAi.isDemoFallbackEnabled()).thenReturn(false);

        var response = service("openai").quota(EMAIL, "  ");

        assertThat(response.sessionUsed()).isZero();
        assertThat(response.model()).isEqualTo("gpt-4o-mini");
        assertThat(response.demoFallback()).isFalse();
    }

    @Test
    @DisplayName("quota: khong co provider -> model null, demoFallback theo openAi")
    void quotaWithoutProviderReportsNullModel() {
        when(usageRepository.findByUser_IdAndUsageDate(7L, LocalDate.now()))
                .thenReturn(Optional.empty());
        when(openAi.isConfigured()).thenReturn(false);
        when(openAi.isDemoFallbackEnabled()).thenReturn(true);

        var response = service("openai").quota(EMAIL, null);

        assertThat(response.aiEnabled()).isFalse();
        assertThat(response.model()).isNull();
        assertThat(response.demoFallback()).isTrue();
    }

    @Test
    @DisplayName("history: tra ve danh sach hoi dap hom nay")
    void historyReturnsTodayMessages() {
        AiSupportMessage message = new AiSupportMessage();
        message.setUser(member);
        message.setExercise(exercise);
        message.setSessionId("session-1");
        message.setQuestion("Why?");
        message.setAnswer("{}");
        message.setCreatedAt(LocalDateTime.now());
        when(messageRepository.findByUser_IdAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc(
                anyLong(), any(LocalDateTime.class))).thenReturn(List.of(message));

        List<HistoryItem> items = service("auto").history(EMAIL);

        assertThat(items).hasSize(1);
        assertThat(items.get(0).exerciseName()).isEqualTo("Squat");
        assertThat(items.get(0).question()).isEqualTo("Why?");
    }

    @Test
    @DisplayName("history: bai tap null -> ten null")
    void historyHandlesNullExercise() {
        AiSupportMessage message = new AiSupportMessage();
        message.setUser(member);
        message.setQuestion("General");
        message.setAnswer("{}");
        when(messageRepository.findByUser_IdAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc(
                anyLong(), any(LocalDateTime.class))).thenReturn(List.of(message));

        assertThat(service("auto").history(EMAIL).get(0).exerciseName()).isNull();
    }

    @Test
    @DisplayName("history: user khong ton tai -> 401")
    void historyRejectsUnknownUser() {
        when(users.findByEmail("ghost@x.vn")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service("auto").history("ghost@x.vn"))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("sessionHistory: sessionId rong -> danh sach rong")
    void sessionHistoryWithoutSessionIsEmpty() {
        assertThat(service("auto").sessionHistory(EMAIL, " ")).isEmpty();
    }

    @Test
    @DisplayName("sessionHistory: tra ve theo thu tu cu")
    void sessionHistoryReturnsMessages() {
        AiSupportMessage message = new AiSupportMessage();
        message.setUser(member);
        message.setExercise(exercise);
        message.setQuestion("Q1");
        message.setAnswer("A1");
        when(messageRepository.findByUser_IdAndSessionIdOrderByCreatedAtAsc(7L, "session-1"))
                .thenReturn(List.of(message));

        List<HistoryItem> items = service("auto").sessionHistory(EMAIL, "session-1");

        assertThat(items).hasSize(1);
        assertThat(items.get(0).answerJson()).isEqualTo("A1");
    }

    @Test
    @DisplayName("sessionHistory: user khong ton tai -> 401")
    void sessionHistoryRejectsUnknownUser() {
        when(users.findByEmail("ghost@x.vn")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service("auto").sessionHistory("ghost@x.vn", "s"))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("alertsFor: bai tap khong ton tai -> 404")
    void alertsForUnknownExercise() {
        when(exercises.findByCode("NOPE")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service("auto").alertsFor("NOPE"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(404));
    }

    @Test
    @DisplayName("alertsFor: tra ve danh sach canh bao")
    void alertsForReturnsAlerts() {
        when(physiologyService.loadProfile(3L)).thenReturn(new ExercisePhysiologyDTO(
                "ISOMETRIC", 4, 3, 60, 75, "RAISES", "HIGH", "NONE", 3, "SPINE",
                "Tho deu", List.of(), "note"));
        when(physiologyAlerts.evaluate(any(), anyInt(), any()))
                .thenReturn(List.of(new PhysiologyAlertDTO("R1", "Tich luy", "DANGER", "msg")));

        var alerts = service("auto").alertsFor("SQUAT", 7L);

        assertThat(alerts).hasSize(1);
        assertThat(alerts.get(0).ruleCode()).isEqualTo("R1");
    }

    @Test
    @DisplayName("ask: user khong ton tai -> 401")
    void askRejectsUnknownUser() {
        when(users.findByEmail("ghost@x.vn")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service("auto").ask("ghost@x.vn",
                new AskQuestionRequest("SQUAT", "Why?", "s", List.of(), null)))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("ask: bai tap khong ton tai -> 404")
    void askRejectsUnknownExercise() {
        when(exercises.findByCode("NOPE")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service("auto").ask(EMAIL,
                new AskQuestionRequest("NOPE", "Why?", "s", List.of(), null)))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value())
                        .isEqualTo(404));
    }

    @Test
    @DisplayName("ask: khoa quota that bai -> nem loi")
    void askFailsWhenQuotaRowMissing() {
        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service("auto").ask(EMAIL,
                new AskQuestionRequest("SQUAT", "Why?", "s", List.of(), null)))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("ask: khoa phien that bai -> nem loi")
    void askFailsWhenSessionRowMissing() {
        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.of(usage(0)));
        when(sessionRepository.findForUpdate(7L, "s")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service("auto").ask(EMAIL,
                new AskQuestionRequest("SQUAT", "Why?", "s", List.of(), null)))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("ask: khong co sessionId -> sessionIndex = 1")
    void askWithoutSessionUsesIndexOne() {
        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.of(usage(0)));

        AskQuestionResponse response = service("auto").ask(EMAIL,
                new AskQuestionRequest("SQUAT", "Why?", null, List.of(), null));

        assertThat(response.sessionIndex()).isEqualTo(1);
    }

    @Test
    @DisplayName("ask: prompt chua category, co muscle group va form rules")
    void askBuildsRichPrompt() {
        FormRule rule = new FormRule();
        rule.setJoint("KNEE");
        rule.setAngleThreshold(new BigDecimal("180.000"));
        rule.setRomDepth(new BigDecimal("90.500"));
        when(formRules.findByExerciseCode("SQUAT")).thenReturn(List.of(rule));
        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.of(usage(0)));
        when(openAi.isConfigured()).thenReturn(true);
        when(openAi.model()).thenReturn("gpt-4o-mini");
        when(openAi.chat(anyString(), anyList())).thenReturn(new AiChatProvider.ChatResult("{}", 5));
        when(openAi.toAnswer(anyString())).thenReturn(
                new com.calishealth.dtos.AiSupportDtos.AnswerResponse(List.of(), "", List.of()));

        exercise.setCategory("REPS");
        exercise.setMuscleGroup("Legs");

        service("openai").ask(EMAIL, new AskQuestionRequest(
                "SQUAT", "Why?", "s", List.of("Knee valgus"), 81.4));

        var captor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(openAi).chat(captor.capture(), anyList());
        String prompt = captor.getValue();
        assertThat(prompt).contains("(REPS)");
        assertThat(prompt).contains("target muscles: Legs");
        assertThat(prompt).contains("joint KNEE");
        assertThat(prompt).contains("fully extended at 180°");
        assertThat(prompt).contains("deep enough at 90.5°");
        assertThat(prompt).contains("Knee valgus");
        assertThat(prompt).contains("81%");
    }

    @Test
    @DisplayName("ask: luu lich su va cap nhat bo dem")
    void askStoresHistoryAndCounters() {
        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.of(usage(4)));
        when(sessionRepository.findForUpdate(7L, "s")).thenReturn(Optional.of(session(1)));

        AskQuestionResponse response = service("auto").ask(EMAIL,
                new AskQuestionRequest("SQUAT", "Why?", "s", List.of(), null));

        assertThat(response.questionCount()).isEqualTo(5);
        assertThat(response.sessionIndex()).isEqualTo(2);
        assertThat(response.provider()).isEqualTo("local-rules");
        verify(messageRepository).save(any(AiSupportMessage.class));
        verify(usageRepository).save(any(AiSupportUsage.class));
    }

    @Test
    @DisplayName("ask: fallback do phat hien form -> nguyen nhan dau tien la loi do")
    void fallbackLeadsWithDetectedIssue() {
        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.of(usage(0)));

        AskQuestionResponse response = service("auto").ask(EMAIL, new AskQuestionRequest(
                "SQUAT", "Something", "s", List.of("Knee valgus", "  "), null));

        assertThat(response.answer().causes().get(0).title()).isEqualTo("Knee valgus");
    }

    @Test
    @DisplayName("ask: cau hoi ve warm-up -> goi y khởi động")
    void fallbackDetectsWarmUpIntent() {
        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.of(usage(0)));

        AskQuestionResponse response = service("auto").ask(EMAIL,
                new AskQuestionRequest("SQUAT", "how to warm up?", "s", List.of(), null));

        assertThat(response.answer().causes())
                .anyMatch(cause -> cause.title().toLowerCase().contains("warm-up"));
    }

    @Test
    @DisplayName("ask: cau hoi ve nghi -> goi y phuc hoi")
    void fallbackDetectsRestIntent() {
        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.of(usage(0)));

        AskQuestionResponse response = service("auto").ask(EMAIL,
                new AskQuestionRequest("SQUAT", "how long should I rest?", "s", List.of(), null));

        assertThat(response.answer().causes())
                .anyMatch(cause -> cause.title().toLowerCase().contains("recovery"));
    }

    @Test
    @DisplayName("ask: cau hoi ve do sau -> goi y bien do")
    void fallbackDetectsDepthIntent() {
        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.of(usage(0)));

        AskQuestionResponse response = service("auto").ask(EMAIL,
                new AskQuestionRequest("SQUAT", "my depth is too shallow", "s", List.of(), null));

        assertThat(response.answer().causes())
                .anyMatch(cause -> cause.title().toLowerCase().contains("range of motion"));
    }

    @Test
    @DisplayName("ask: cau hoi ve nhip -> goi y tempo")
    void fallbackDetectsTempoIntent() {
        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.of(usage(0)));

        AskQuestionResponse response = service("auto").ask(EMAIL,
                new AskQuestionRequest("SQUAT", "my tempo is too fast", "s", List.of(), null));

        assertThat(response.answer().causes())
                .anyMatch(cause -> cause.title().toLowerCase().contains("tempo"));
    }

    @Test
    @DisplayName("ask: cau hoi ve tai trong -> goi y tai trong")
    void fallbackDetectsLoadIntent() {
        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.of(usage(0)));

        AskQuestionResponse response = service("auto").ask(EMAIL,
                new AskQuestionRequest("SQUAT", "the load is too heavy", "s", List.of(), null));

        assertThat(response.answer().causes())
                .anyMatch(cause -> cause.title().toLowerCase().contains("load"));
    }

    @Test
    @DisplayName("ask: cau hoi ve khuỷu -> goi y canh bang khuỷu")
    void fallbackDetectsBodyPartIntent() {
        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.of(usage(0)));

        AskQuestionResponse response = service("auto").ask(EMAIL,
                new AskQuestionRequest("SQUAT", "my elbow hurts during push", "s", List.of(), null));

        assertThat(response.answer().causes())
                .anyMatch(cause -> cause.title().contains("Elbow"));
    }

    @Test
    @DisplayName("ask: cau hoi ve nguyen nhan -> goi y lech khop")
    void fallbackDetectsWhyIntent() {
        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.of(usage(0)));

        AskQuestionResponse response = service("auto").ask(EMAIL,
                new AskQuestionRequest("SQUAT", "why is this wrong?", "s", List.of(), null));

        assertThat(response.answer().causes())
                .anyMatch(cause -> cause.title().contains("position drifts"));
    }

    @Test
    @DisplayName("ask: cau hoi ve cach sua -> goi y muscle memory")
    void fallbackDetectsFixIntent() {
        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.of(usage(0)));

        AskQuestionResponse response = service("auto").ask(EMAIL,
                new AskQuestionRequest("SQUAT", "how do I fix this?", "s", List.of(), null));

        assertThat(response.answer().causes())
                .anyMatch(cause -> cause.title().contains("Muscle memory"));
    }

    @Test
    @DisplayName("ask: cau hoi khong khop -> bao can them chi tiet")
    void fallbackFallsBackToGenericCause() {
        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.of(usage(0)));

        AskQuestionResponse response = service("auto").ask(EMAIL,
                new AskQuestionRequest("SQUAT", "xyzzy", "s", List.of(), null));

        assertThat(response.answer().causes().get(0).title()).contains("Need more detail");
    }

    @Test
    @DisplayName("ask: khong co feedback tren rule -> tip dung cau mac dinh")
    void fallbackTipUsesBuiltInTip() {
        FormRule rule = new FormRule();
        rule.setJoint("KNEE");
        when(formRules.findByExerciseCode("SQUAT")).thenReturn(List.of(rule));
        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.of(usage(0)));

        AskQuestionResponse response = service("auto").ask(EMAIL,
                new AskQuestionRequest("SQUAT", "why?", "s", List.of(), null));

        assertThat(response.answer().tip()).contains("slow the set down");
    }

    @Test
    @DisplayName("ask: form rule co romDepth -> nhanh co goc do")
    void fallbackMentionsRomDepth() {
        FormRule rule = new FormRule();
        rule.setJoint("KNEE");
        rule.setRomDepth(new BigDecimal("95.000"));
        when(formRules.findByExerciseCode("SQUAT")).thenReturn(List.of(rule));
        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.of(usage(0)));

        AskQuestionResponse response = service("auto").ask(EMAIL,
                new AskQuestionRequest("SQUAT", "why is my depth low?", "s", List.of(), null));

        assertThat(response.answer().causes())
                .anyMatch(cause -> cause.detail().contains("95°"));
    }

    @Test
    @DisplayName("ask: chi co 3 nguyen nhan toi da")
    void fallbackLimitsCausesToThree() {
        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.of(usage(0)));

        AskQuestionResponse response = service("auto").ask(EMAIL, new AskQuestionRequest(
                "SQUAT", "why is my depth low and my tempo fast and my elbow hurts?", "s",
                List.of("issue a", "issue b"), null));

        assertThat(response.answer().causes()).hasSize(3);
    }

    @Test
    @DisplayName("ask: lich su duoc gui lai AI duoi dang van ban thuan")
    void historyIsSentAsPlainText() throws Exception {
        AiSupportMessage previous = new AiSupportMessage();
        previous.setUser(member);
        previous.setQuestion("Q1");
        previous.setAnswer("{}");
        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.of(usage(0)));
        when(sessionRepository.findForUpdate(7L, "s")).thenReturn(Optional.of(session(0)));
        when(messageRepository.findByUser_IdAndSessionIdOrderByCreatedAtAsc(7L, "s"))
                .thenReturn(List.of(previous));
        when(openAi.isConfigured()).thenReturn(true);
        when(openAi.model()).thenReturn("gpt-4o-mini");
        when(openAi.chat(anyString(), anyList())).thenReturn(new AiChatProvider.ChatResult("{}", 3));
        when(openAi.toAnswer(anyString())).thenReturn(
                new com.calishealth.dtos.AiSupportDtos.AnswerResponse(
                        List.of(new LikelyCause("Core fatigue", "Hips drop.")),
                        "Slow down.",
                        List.of()));

        service("openai").ask(EMAIL, new AskQuestionRequest("SQUAT", "Why?", "s", List.of(), null));

        var captor = org.mockito.ArgumentCaptor.forClass(List.class);
        verify(openAi).chat(anyString(), captor.capture());
        List<?> messages = captor.getValue();
        assertThat(messages).hasSize(3);
        assertThat(messages.get(1).toString()).contains("Core fatigue");
        assertThat(messages.get(1).toString()).contains("Tip: Slow down.");
    }

    @Test
    @DisplayName("escapeJson: escape ky tu dac biet")
    void escapeJsonEscapesSpecialCharacters() throws Exception {
        Method method = AiSupportService.class.getDeclaredMethod("escapeJson", String.class);
        method.setAccessible(true);

        assertThat((String) method.invoke(service("auto"), "a\"b\\c\nd\te"))
                .isEqualTo("a\\\"b\\\\c\\nd\\te");
        assertThat((String) method.invoke(service("auto"), (Object) null)).isEmpty();
    }

    @Test
    @DisplayName("renderAnswerJson: tao JSON hop le")
    void renderAnswerJsonBuildsJson() throws Exception {
        Method method = AiSupportService.class.getDeclaredMethod("renderAnswerJson",
                com.calishealth.dtos.AiSupportDtos.AnswerResponse.class);
        method.setAccessible(true);
        var answer = new com.calishealth.dtos.AiSupportDtos.AnswerResponse(
                List.of(new LikelyCause("A", "B"), new LikelyCause("C", "D")),
                "tip",
                List.of("q1", "q2"));

        String json = (String) method.invoke(service("auto"), answer);

        assertThat(json).contains("\"title\":\"A\"");
        assertThat(json).contains("\"tip\":\"tip\"");
        assertThat(json).contains("\"q2\"");
    }

    @Test
    @DisplayName("buildUserPrompt: them context rule va loi form")
    void buildUserPromptAppendsContext() throws Exception {
        Method method = AiSupportService.class.getDeclaredMethod("buildUserPrompt",
                String.class, List.class, List.class, Double.class);
        method.setAccessible(true);
        FormRule rule = new FormRule();
        rule.setJoint("KNEE");
        rule.setRomDepth(new BigDecimal("90.000"));

        String prompt = (String) method.invoke(service("auto"), "Why?",
                List.of(rule), List.of("Knee valgus"), null);

        assertThat(prompt).startsWith("Why?");
        assertThat(prompt).contains("(Form rules for this exercise: KNEE romDepth=90; ");
        assertThat(prompt).contains("(Detected form issues: Knee valgus)");
    }

    @Test
    @DisplayName("bodyPartIn: nhan dien khop theo tieng Anh va Viet")
    void bodyPartDetection() throws Exception {
        Method method = AiSupportService.class.getDeclaredMethod("bodyPartIn", String.class);
        method.setAccessible(true);

        assertThat((String) method.invoke(service("auto"), "my knee hurts"))
                .isEqualTo("Knee");
        assertThat((String) method.invoke(service("auto"), "khuỷu tay"))
                .isEqualTo("Khuỷu");
        assertThat((String) method.invoke(service("auto"), "nothing here"))
                .isEqualTo("Joint");
    }
}
