package com.calishealth.service;

import com.calishealth.dtos.SurveyDtos.AnswerItem;
import com.calishealth.dtos.SurveyDtos.LevelAssessment;
import com.calishealth.dtos.SurveyDtos.SaveAnswersRequest;
import com.calishealth.dtos.SurveyDtos.SessionQuestionResponse;
import com.calishealth.dtos.SurveyDtos.SessionResponse;
import com.calishealth.dtos.SurveyDtos.SessionStepResponse;
import com.calishealth.dtos.SurveyDtos.SessionSummaryResponse;
import com.calishealth.dtos.SurveyDtos.SurveyResultResponse;
import com.calishealth.exception.SurveyException;
import com.calishealth.exception.SurveyException.ErrorItem;
import com.calishealth.models.AssessmentAnswer;
import com.calishealth.models.Survey;
import com.calishealth.models.SurveySession;
import com.calishealth.models.User;
import com.calishealth.repository.AssessmentAnswerRepository;
import com.calishealth.repository.AssessmentQuestionRepository;
import com.calishealth.repository.SurveySessionRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.service.survey.SurveyDefinitionLoader;
import com.calishealth.service.survey.SurveyJson;
import com.calishealth.service.survey.definition.QuestionDefinition;
import com.calishealth.service.survey.definition.StepDefinition;
import com.calishealth.service.survey.definition.StepQuestion;
import com.calishealth.service.survey.definition.SurveyDefinition;
import com.calishealth.service.survey.level.LevelAssessmentService;
import com.calishealth.service.survey.questiontype.AnswerCheck;
import com.calishealth.service.survey.questiontype.QuestionTypeHandler;
import com.calishealth.service.survey.questiontype.QuestionTypeRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Vòng đời phiên khảo sát. Mọi thao tác ghi khóa dòng phiên (SELECT ... FOR UPDATE) nên các request
 * đồng thời trên cùng phiên chạy tuần tự; toàn bộ request lưu câu trả lời là 1 transaction:
 * chỉ cần 1 câu sai là không lưu gì.
 */
@Service
@RequiredArgsConstructor
public class SurveySessionService {
    private final SurveySessionRepository sessions;
    private final AssessmentAnswerRepository answers;
    private final AssessmentQuestionRepository questions;
    private final UserRepository users;
    private final SurveyService surveys;
    private final SurveyDefinitionLoader loader;
    private final QuestionTypeRegistry registry;

    public record StartResult(SessionResponse session, boolean created) {}

    /** Trả về phiên IN_PROGRESS nếu đã có (mọi version), nếu không thì tạo phiên mới trên version ACTIVE. */
    @Transactional
    public StartResult start(String email, String surveyCode) {
        User user = currentUser(email);
        Optional<SurveySession> inProgress = findInProgress(user, surveyCode);
        if (inProgress.isPresent()) {
            return new StartResult(view(inProgress.get()), false);
        }

        Survey survey = surveys.findActiveSurvey(surveyCode);
        LocalDateTime now = LocalDateTime.now();
        SurveySession session = new SurveySession();
        session.setUser(user);
        session.setSurvey(survey);
        session.setSurveyVersion(survey.getVersion());
        session.setStatus(SurveySession.Status.IN_PROGRESS);
        session.setStartedAt(now);
        session.setUpdatedAt(now);
        try {
            sessions.saveAndFlush(session);
        } catch (DataIntegrityViolationException exception) {
            // request song song đã tạo phiên trước (uk_survey_sessions_one_in_progress)
            throw SurveyException.conflict("ACTIVE_SESSION_EXISTS",
                    "An in-progress session was just created; call this endpoint again to resume it");
        }
        return new StartResult(view(session), true);
    }

    @Transactional(readOnly = true)
    public SessionResponse get(String email, Long sessionId) {
        return view(owned(sessions.findWithSurveyById(sessionId), currentUser(email)));
    }

    @Transactional(readOnly = true)
    public List<SessionSummaryResponse> list(String email, String surveyCode) {
        User user = currentUser(email);
        return sessions.findByUserAndSurveyCode(user.getId(), surveyCode).stream()
                .map(s -> new SessionSummaryResponse(s.getId(), s.getSurvey().getSurveyCode(), s.getSurveyVersion(),
                        s.getStatus().name(), s.getStartedAt(), s.getCompletedAt(), s.getSkippedAt()))
                .toList();
    }

    @Transactional
    public SessionResponse saveStepAnswers(String email, Long sessionId, String stepCode, SaveAnswersRequest request) {
        SurveySession session = owned(sessions.findByIdForUpdate(sessionId), currentUser(email));
        requireEditable(session);
        if (request.surveyVersion() != null && request.surveyVersion() != session.getSurveyVersion()) {
            throw SurveyException.conflict("SURVEY_VERSION_MISMATCH", "This session uses survey version "
                    + session.getSurveyVersion() + " but the request was built for version " + request.surveyVersion());
        }
        SurveyDefinition definition = loader.load(session.getSurvey());
        StepDefinition step = definition.step(stepCode)
                .orElseThrow(() -> SurveyException.notFound("STEP_NOT_FOUND",
                        "Step '" + stepCode + "' does not exist in this survey"));
        if (!step.active()) {
            throw SurveyException.badRequest("STEP_INACTIVE", "Step '" + stepCode + "' is no longer active");
        }

        Map<String, AssessmentAnswer> stored = storedAnswers(session);
        List<ErrorItem> errors = new ArrayList<>();
        // questionCode -> giá trị chuẩn hóa; null = xóa câu trả lời
        Map<String, JsonNode> accepted = new LinkedHashMap<>();
        Set<String> seen = new HashSet<>();

        for (AnswerItem item : request.answers()) {
            String code = item.getQuestionCode();
            if (!item.getUnknownFields().isEmpty()) {
                errors.add(error(stepCode, code, "UNKNOWN_FIELD", "Unsupported field(s) " + item.getUnknownFields().keySet()
                        + "; only questionCode and value are accepted"));
                continue;
            }
            if (!seen.add(code)) {
                errors.add(error(stepCode, code, "DUPLICATE_QUESTION", "Question is answered more than once in this request"));
                continue;
            }
            if (!item.isValuePresent()) {
                errors.add(error(stepCode, code, "VALUE_MISSING", "Field 'value' is required; send null to clear an answer"));
                continue;
            }
            Optional<StepQuestion> stepQuestion = step.question(code);
            if (stepQuestion.isEmpty()) {
                errors.add(unknownQuestion(definition, stepCode, code));
                continue;
            }
            if (!stepQuestion.get().active()) {
                errors.add(error(stepCode, code, "QUESTION_INACTIVE", "Question is no longer active"));
                continue;
            }
            if (SurveyJson.isNull(item.getValue())) {
                accepted.put(code, null);
                continue;
            }
            QuestionDefinition question = stepQuestion.get().question();
            AnswerCheck check = handler(question).check(question, item.getValue());
            if (check.valid()) {
                accepted.put(code, check.normalized());
            } else {
                errors.add(error(stepCode, code, check.errorCode(), check.message()));
            }
        }

        // Điều kiện xét trên trạng thái SAU khi áp dụng request (câu nguồn có thể nằm trong cùng request).
        Map<String, JsonNode> candidate = new HashMap<>(values(stored));
        accepted.forEach((code, value) -> {
            if (value == null) {
                candidate.remove(code);
            } else {
                candidate.put(code, value);
            }
        });
        accepted.forEach((code, value) -> {
            StepQuestion stepQuestion = step.question(code).orElseThrow();
            if (value != null && stepQuestion.condition() != null && !stepQuestion.condition().test(candidate)) {
                errors.add(error(stepCode, code, "QUESTION_NOT_APPLICABLE",
                        "Question does not apply with the current answers to " + stepQuestion.condition().referencedQuestions()));
            }
        });

        if (!errors.isEmpty()) {
            throw new SurveyException(HttpStatus.BAD_REQUEST, "SURVEY_VALIDATION_FAILED",
                    "Some answers are invalid. Nothing was saved.", errors);
        }

        LocalDateTime now = LocalDateTime.now();
        accepted.forEach((code, value) -> {
            AssessmentAnswer existing = stored.get(code);
            if (value == null) {
                if (existing != null) {
                    answers.delete(existing);
                    stored.remove(code);
                }
                return;
            }
            String json = SurveyJson.write(value);
            if (existing == null) {
                AssessmentAnswer answer = new AssessmentAnswer();
                answer.setSession(session);
                answer.setQuestion(questions.getReferenceById(step.question(code).orElseThrow().question().id()));
                answer.setAnswerValue(json);
                answer.setCreatedAt(now);
                answer.setUpdatedAt(now);
                stored.put(code, answers.save(answer));
            } else if (!value.equals(SurveyJson.parse(existing.getAnswerValue()))) {
                existing.setAnswerValue(json);
                existing.setUpdatedAt(now);
            }
        });
        session.setUpdatedAt(now);
        return view(session, definition, values(stored));
    }

    /**
     * Hoàn thành: mọi câu bắt buộc đang áp dụng phải có câu trả lời hợp lệ (kiểm tra lại theo cấu hình),
     * và không còn câu trả lời cho câu hỏi đã hết áp dụng (frontend phải gửi null để xóa).
     * Hoàn thành xong thì chấm level theo bộ luật (LevelAssessmentService) trong cùng transaction.
     */
    @Transactional
    public SessionResponse complete(String email, Long sessionId) {
        SurveySession session = owned(sessions.findByIdForUpdate(sessionId), currentUser(email));
        requireEditable(session);
        SurveyDefinition definition = loader.load(session.getSurvey());
        Map<String, JsonNode> values = values(storedAnswers(session));

        List<ErrorItem> errors = new ArrayList<>();
        for (StepDefinition step : definition.activeSteps()) {
            for (StepQuestion stepQuestion : step.questions()) {
                if (!stepQuestion.active()) {
                    continue;
                }
                QuestionDefinition question = stepQuestion.question();
                JsonNode value = values.get(question.code());
                boolean applicable = isApplicable(stepQuestion, values);
                if (!applicable) {
                    if (value != null) {
                        errors.add(error(step.code(), question.code(), "ANSWER_NOT_APPLICABLE",
                                "This answer no longer applies; send null for this question to clear it"));
                    }
                } else if (value == null) {
                    if (question.required()) {
                        errors.add(error(step.code(), question.code(), "MISSING_REQUIRED_ANSWER", "This question is required"));
                    }
                } else {
                    AnswerCheck check = handler(question).check(question, value);
                    if (!check.valid()) {
                        errors.add(error(step.code(), question.code(), check.errorCode(), check.message()));
                    }
                }
            }
        }
        if (!errors.isEmpty()) {
            throw new SurveyException(HttpStatus.BAD_REQUEST, "SURVEY_INCOMPLETE",
                    "The survey cannot be completed yet.", errors);
        }

        assignBenchmarkLevelIfPresent(session, values);
        LocalDateTime now = LocalDateTime.now();
        session.setStatus(SurveySession.Status.COMPLETED);
        session.setCompletedAt(now);
        session.setUpdatedAt(now);
        levels.assess(session, definition, values);
        return view(session, definition, values);
    }

    /** Bỏ qua: giữ nguyên câu trả lời đã lưu. */
    @Transactional
    public SessionResponse skip(String email, Long sessionId) {
        SurveySession session = owned(sessions.findByIdForUpdate(sessionId), currentUser(email));
        requireEditable(session);
        LocalDateTime now = LocalDateTime.now();
        session.setStatus(SurveySession.Status.SKIPPED);
        session.setSkippedAt(now);
        session.setUpdatedAt(now);
        return view(session);
    }

    /** SKIPPED -> IN_PROGRESS, giữ version và câu trả lời cũ. */
    @Transactional
    public SessionResponse resume(String email, Long sessionId) {
        User user = currentUser(email);
        SurveySession session = owned(sessions.findByIdForUpdate(sessionId), user);
        if (session.getStatus() != SurveySession.Status.SKIPPED) {
            throw SurveyException.conflict("INVALID_SESSION_STATE",
                    "Only a skipped session can be resumed (current status: " + session.getStatus() + ")");
        }
        if (findInProgress(user, session.getSurvey().getSurveyCode()).isPresent()) {
            throw SurveyException.conflict("ACTIVE_SESSION_EXISTS",
                    "Another in-progress session exists for this survey; continue that one instead");
        }
        session.setStatus(SurveySession.Status.IN_PROGRESS);
        session.setSkippedAt(null);
        session.setUpdatedAt(LocalDateTime.now());
        try {
            sessions.saveAndFlush(session);
        } catch (DataIntegrityViolationException exception) {
            throw SurveyException.conflict("ACTIVE_SESSION_EXISTS",
                    "Another in-progress session exists for this survey; continue that one instead");
        }
        return view(session);
    }

    // ------------------------------------------------------------------ helpers

    private User currentUser(String email) {
        return users.findByEmail(email).orElseThrow(() -> new SurveyException(HttpStatus.UNAUTHORIZED,
                "UNAUTHORIZED", "The signed-in user no longer exists"));
    }

    /** Phiên của người khác trả về y như không tồn tại để không lộ id phiên hợp lệ. */
    private static SurveySession owned(Optional<SurveySession> session, User user) {
        return session.filter(s -> s.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> SurveyException.notFound("SESSION_NOT_FOUND", "Survey session not found"));
    }

    private static void requireEditable(SurveySession session) {
        switch (session.getStatus()) {
            case COMPLETED -> throw SurveyException.conflict("SESSION_COMPLETED",
                    "This survey session is completed and can no longer be changed");
            case SKIPPED -> throw SurveyException.conflict("SESSION_SKIPPED",
                    "This survey session was skipped; resume it before changing it");
            case IN_PROGRESS -> { }
        }
    }

    private Optional<SurveySession> findInProgress(User user, String surveyCode) {
        return sessions.findByUserAndSurveyCode(user.getId(), surveyCode).stream()
                .filter(s -> s.getStatus() == SurveySession.Status.IN_PROGRESS)
                .findFirst();
    }

    private QuestionTypeHandler handler(QuestionDefinition question) {
        // SurveyConfigValidator đã chặn loại không hỗ trợ; đây là chốt chặn cuối, không bao giờ bỏ qua âm thầm.
        return registry.find(question.type()).orElseThrow(() -> new SurveyException(HttpStatus.INTERNAL_SERVER_ERROR,
                "UNSUPPORTED_QUESTION_TYPE", "Question type '" + question.type() + "' is not supported"));
    }

    private ErrorItem unknownQuestion(SurveyDefinition definition, String stepCode, String code) {
        Optional<StepDefinition> owner = definition.stepOf(code);
        if (owner.isPresent()) {
            return error(stepCode, code, "QUESTION_NOT_IN_STEP",
                    "Question belongs to step '" + owner.get().code() + "', not '" + stepCode + "'");
        }
        if (questions.existsByQuestionCode(code)) {
            return error(stepCode, code, "QUESTION_NOT_IN_SURVEY", "Question is not part of this survey version");
        }
        return error(stepCode, code, "QUESTION_NOT_FOUND", "Question does not exist");
    }

    private static ErrorItem error(String stepCode, String questionCode, String code, String message) {
        return new ErrorItem(stepCode, questionCode, code, message);
    }

    private static boolean isApplicable(StepQuestion stepQuestion, Map<String, JsonNode> values) {
        return stepQuestion.condition() == null || stepQuestion.condition().test(values);
    }

    private Map<String, AssessmentAnswer> storedAnswers(SurveySession session) {
        Map<String, AssessmentAnswer> byCode = new HashMap<>();
        for (AssessmentAnswer answer : answers.findBySessionId(session.getId())) {
            byCode.put(answer.getQuestion().getQuestionCode(), answer);
        }
        return byCode;
    }

    private static Map<String, JsonNode> values(Map<String, AssessmentAnswer> stored) {
        Map<String, JsonNode> values = new HashMap<>();
        stored.forEach((code, answer) -> values.put(code, SurveyJson.parse(answer.getAnswerValue())));
        return values;
    }

    private SessionResponse view(SurveySession session) {
        return view(session, loader.load(session.getSurvey()), values(storedAnswers(session)));
    }

    private static SessionResponse view(SurveySession session, SurveyDefinition definition, Map<String, JsonNode> values) {
        List<SessionStepResponse> steps = new ArrayList<>();
        String currentStepCode = null;
        for (StepDefinition step : definition.activeSteps()) {
            List<SessionQuestionResponse> items = new ArrayList<>();
            boolean complete = true;
            for (StepQuestion stepQuestion : step.questions()) {
                if (!stepQuestion.active()) {
                    continue;
                }
                QuestionDefinition question = stepQuestion.question();
                JsonNode value = values.get(question.code());
                boolean applicable = isApplicable(stepQuestion, values);
                if ((applicable && question.required() && value == null) || (!applicable && value != null)) {
                    complete = false;
                }
                items.add(new SessionQuestionResponse(question.code(), applicable, question.required(),
                        value != null, value));
            }
            if (!complete && currentStepCode == null) {
                currentStepCode = step.code();
            }
            steps.add(new SessionStepResponse(step.code(), step.sortOrder(), complete, items));
        }
        return new SessionResponse(session.getId(), definition.code(), session.getSurveyVersion(),
                session.getStatus().name(), session.getStartedAt(), session.getCompletedAt(), session.getSkippedAt(),
                session.getUpdatedAt(), currentStepCode, steps);
    }
}
