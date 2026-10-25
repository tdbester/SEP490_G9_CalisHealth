package com.calishealth.service;

import com.calishealth.dtos.SurveyDtos.AnswerItem;
import com.calishealth.dtos.SurveyDtos.OptionResponse;
import com.calishealth.dtos.SurveyDtos.QuestionResponse;
import com.calishealth.dtos.SurveyDtos.ResultConfig;
import com.calishealth.dtos.SurveyStepManagementDtos.AvailableQuestionResponse;
import com.calishealth.dtos.SurveyStepManagementDtos.ChangeStepStatusRequest;
import com.calishealth.dtos.SurveyStepManagementDtos.CreateStepRequest;
import com.calishealth.dtos.SurveyStepManagementDtos.FitnessLevelOption;
import com.calishealth.dtos.SurveyStepManagementDtos.PreviewCheckRequest;
import com.calishealth.dtos.SurveyStepManagementDtos.PreviewCheckResponse;
import com.calishealth.dtos.SurveyStepManagementDtos.ReorderStepsRequest;
import com.calishealth.dtos.SurveyStepManagementDtos.ResultConfigResponse;
import com.calishealth.dtos.SurveyStepManagementDtos.StatusCounts;
import com.calishealth.dtos.SurveyStepManagementDtos.StepDetailResponse;
import com.calishealth.dtos.SurveyStepManagementDtos.StepListResponse;
import com.calishealth.dtos.SurveyStepManagementDtos.StepPreviewResponse;
import com.calishealth.dtos.SurveyStepManagementDtos.StepQuestionInput;
import com.calishealth.dtos.SurveyStepManagementDtos.StepQuestionItem;
import com.calishealth.dtos.SurveyStepManagementDtos.StepSummaryResponse;
import com.calishealth.dtos.SurveyStepManagementDtos.SurveyInfo;
import com.calishealth.dtos.SurveyStepManagementDtos.UpdateResultConfigRequest;
import com.calishealth.dtos.SurveyStepManagementDtos.UpdateStepRequest;
import com.calishealth.exception.SurveyException;
import com.calishealth.exception.SurveyException.ErrorItem;
import com.calishealth.models.AssessmentOption;
import com.calishealth.models.AssessmentQuestion;
import com.calishealth.models.ConfigStatus;
import com.calishealth.models.Survey;
import com.calishealth.models.SurveyStep;
import com.calishealth.models.SurveyStepQuestion;
import com.calishealth.models.User;
import com.calishealth.repository.AssessmentAnswerRepository;
import com.calishealth.repository.AssessmentOptionRepository;
import com.calishealth.repository.AssessmentQuestionRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.SurveyRepository;
import com.calishealth.repository.SurveyStepQuestionRepository;
import com.calishealth.repository.SurveyStepRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.service.survey.SurveyDefinitionLoader;
import com.calishealth.service.survey.SurveyJson;
import com.calishealth.service.survey.definition.QuestionDefinition;
import com.calishealth.service.survey.definition.StepDefinition;
import com.calishealth.service.survey.definition.StepQuestion;
import com.calishealth.service.survey.questiontype.AnswerCheck;
import com.calishealth.service.survey.questiontype.QuestionTypeHandler;
import com.calishealth.service.survey.questiontype.QuestionTypeRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Màn "Survey management" của Content Manager: quản lý các bước của 1 survey version.
 *
 * <ul>
 *   <li>Mặc định làm việc trên version ACTIVE (version member đang dùng); không có thì version DRAFT mới nhất.
 *       Version ARCHIVED chỉ đọc.</li>
 *   <li>Mọi thao tác ghi khóa dòng survey (SELECT ... FOR UPDATE) nên chạy tuần tự trên cùng 1 survey.</li>
 *   <li>Thay đổi có thể ảnh hưởng tới member (đổi trạng thái, đổi thứ tự) được kiểm tra lại bằng
 *       SurveyConfigValidator: không được tạo thêm lỗi cấu hình mới (vd điều kiện hiển thị trỏ tới câu hỏi
 *       nằm ở bước phía sau) -> 409 SURVEY_CONFIG_CONFLICT, không lưu gì.</li>
 *   <li>Bước RESULT không có câu hỏi, luôn đứng cuối, không xóa được, chỉ cấu hình qua result-config.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SurveyStepManagementService {
    /** Chừa chỗ cho hậu tố "_NN" khi stepCode sinh ra bị trùng. */
    private static final int GENERATED_CODE_BASE_LENGTH = 56;
    private static final int MAX_SEARCH_LENGTH = 100;

    private final SurveyRepository surveys;
    private final SurveyStepRepository steps;
    private final SurveyStepQuestionRepository stepQuestions;
    private final AssessmentQuestionRepository questions;
    private final AssessmentOptionRepository options;
    private final AssessmentAnswerRepository answers;
    private final FitnessLevelRepository fitnessLevels;
    private final UserRepository users;
    private final SurveyDefinitionLoader loader;
    private final QuestionTypeRegistry registry;

    // ---------- Đọc ----------

    /** search: lọc theo tên (không phân biệt hoa thường); status: tab đang chọn, null = All. */
    @Transactional(readOnly = true)
    public StepListResponse list(String surveyCode, Integer version, String search, SurveyStep.Status status) {
        if (search != null && search.length() > MAX_SEARCH_LENGTH) {
            throw SurveyException.badRequest("INVALID_REQUEST",
                    "search must be at most " + MAX_SEARCH_LENGTH + " characters");
        }
        return list(resolve(surveyCode, version), search, status);
    }

    @Transactional(readOnly = true)
    public StepDetailResponse get(String surveyCode, Integer version, Long stepId) {
        Survey survey = resolve(surveyCode, version);
        return detail(survey, stepOf(survey, stepId));
    }

    /** Đúng những gì member sẽ thấy ở bước này: chỉ câu hỏi và lựa chọn ACTIVE. Không lưu gì. */
    @Transactional(readOnly = true)
    public StepPreviewResponse preview(String surveyCode, Integer version, Long stepId) {
        Survey survey = resolve(surveyCode, version);
        SurveyStep step = stepOf(survey, stepId);
        boolean visibleToMembers = step.getStatus() == SurveyStep.Status.ACTIVE;
        if (step.isResult()) {
            return new StepPreviewResponse(summaryOf(survey, step), null, null, visibleToMembers, List.of(),
                    resultConfig(step));
        }

        // "Step n of m": các bước câu hỏi member thấy + chính bước đang xem (tại đúng vị trí của nó)
        List<Long> memberSteps = steps.findBySurveyIdOrderBySortOrderAsc(survey.getId()).stream()
                .filter(s -> !s.isResult()
                        && (s.getStatus() == SurveyStep.Status.ACTIVE || s.getId().equals(step.getId())))
                .map(SurveyStep::getId)
                .toList();

        List<SurveyStepQuestion> links = stepQuestions.findAllByStepId(step.getId()).stream()
                .filter(SurveyStepManagementService::visible)
                .toList();
        Map<Long, List<OptionResponse>> optionsByQuestion = links.isEmpty() ? Map.of()
                : options.findByQuestionIdInOrderBySortOrderAsc(
                        links.stream().map(l -> l.getQuestion().getId()).toList())
                .stream()
                .filter(o -> o.getStatus() == ConfigStatus.ACTIVE)
                .collect(Collectors.groupingBy(o -> o.getQuestion().getId(), LinkedHashMap::new,
                        Collectors.mapping(SurveyStepManagementService::toOption, Collectors.toList())));

        List<QuestionResponse> questions = links.stream().map(link -> {
            AssessmentQuestion q = link.getQuestion();
            JsonNode rules = json(q.getValidationRules());
            return new QuestionResponse(q.getQuestionCode(), q.getQuestionText(), q.getDescription(),
                    q.getQuestionType(), link.isEffectivelyRequired(),
                    SurveyJson.isNull(rules) ? SurveyJson.nodes().objectNode() : rules,
                    json(q.getDisplayConfig()), q.getUnit(), json(q.getDefaultValue()), link.getSortOrder(),
                    json(link.getConditionalRules()),
                    optionsByQuestion.getOrDefault(q.getId(), List.of()));
        }).toList();
        return new StepPreviewResponse(summaryOf(survey, step), memberSteps.indexOf(step.getId()) + 1,
                memberSteps.size(), visibleToMembers, questions, null);
    }

    /**
     * Nút "Continue" trong Preview: chạy đúng luật kiểm tra câu trả lời của member (loại câu hỏi, rules,
     * bắt buộc, điều kiện hiển thị) trên câu trả lời thử. Không tạo phiên, không lưu gì.
     */
    @Transactional(readOnly = true)
    public PreviewCheckResponse previewCheck(String surveyCode, Integer version, Long stepId,
            PreviewCheckRequest request) {
        Survey survey = resolve(surveyCode, version);
        SurveyStep step = stepOf(survey, stepId);
        if (step.isResult()) {
            throw SurveyException.badRequest("NOT_A_QUESTION_STEP", "The result step has no questions to check");
        }
        String stepCode = step.getStepCode();
        StepDefinition definition = loader.loadUnvalidated(survey).step(stepCode).orElseThrow();
        Map<String, StepQuestion> questionsByCode = definition.questions().stream()
                .filter(StepQuestion::active)
                .collect(Collectors.toMap(q -> q.question().code(), Function.identity(), (a, b) -> a, LinkedHashMap::new));

        List<ErrorItem> errors = new ArrayList<>();
        Map<String, JsonNode> values = new HashMap<>();
        Set<String> seen = new HashSet<>();
        for (AnswerItem item : request.answers()) {
            String code = item.getQuestionCode();
            if (!item.getUnknownFields().isEmpty()) {
                errors.add(new ErrorItem(stepCode, code, "UNKNOWN_FIELD", "Unsupported field(s) "
                        + item.getUnknownFields().keySet() + "; only questionCode and value are accepted"));
            } else if (!seen.add(code)) {
                errors.add(new ErrorItem(stepCode, code, "DUPLICATE_QUESTION",
                        "Question is answered more than once in this request"));
            } else if (!item.isValuePresent()) {
                errors.add(new ErrorItem(stepCode, code, "VALUE_MISSING", "Field 'value' is required"));
            } else if (!questionsByCode.containsKey(code)) {
                errors.add(new ErrorItem(stepCode, code, "QUESTION_NOT_IN_STEP",
                        "Question is not shown to members in this step"));
            } else if (!SurveyJson.isNull(item.getValue())) {
                QuestionDefinition question = questionsByCode.get(code).question();
                Optional<QuestionTypeHandler> handler = registry.find(question.type());
                if (handler.isEmpty()) {
                    errors.add(new ErrorItem(stepCode, code, "UNSUPPORTED_QUESTION_TYPE",
                            "Question type '" + question.type() + "' is not supported"));
                    continue;
                }
                AnswerCheck check = handler.get().check(question, item.getValue());
                if (check.valid()) {
                    values.put(code, check.normalized());
                } else {
                    errors.add(new ErrorItem(stepCode, code, check.errorCode(), check.message()));
                }
            }
        }

        // Bắt buộc + điều kiện hiển thị: chỉ đánh giá điều kiện khi mọi câu nguồn nằm trong chính bước này
        for (StepQuestion stepQuestion : questionsByCode.values()) {
            String code = stepQuestion.question().code();
            boolean applicable = stepQuestion.condition() == null
                    || !questionsByCode.keySet().containsAll(stepQuestion.condition().referencedQuestions())
                    || stepQuestion.condition().test(values);
            if (!applicable && values.containsKey(code)) {
                errors.add(new ErrorItem(stepCode, code, "QUESTION_NOT_APPLICABLE",
                        "Question is hidden with the current answers to " + stepQuestion.condition().referencedQuestions()));
            } else if (applicable && stepQuestion.question().required() && !values.containsKey(code)
                    && errors.stream().noneMatch(e -> code.equals(e.questionCode()))) {
                errors.add(new ErrorItem(stepCode, code, "MISSING_REQUIRED_ANSWER", "This question is required"));
            }
        }
        return new PreviewCheckResponse(errors.isEmpty(), errors);
    }

    /**
     * Nút "Add question": câu hỏi ACTIVE trong ngân hàng mà chưa được dùng ở bước KHÁC của survey này
     * (mỗi câu hỏi chỉ xuất hiện 1 lần / survey). search: lọc theo mã hoặc nội dung câu hỏi.
     */
    @Transactional(readOnly = true)
    public List<AvailableQuestionResponse> availableQuestions(String surveyCode, Integer version, Long stepId,
            String search) {
        if (search != null && search.length() > MAX_SEARCH_LENGTH) {
            throw SurveyException.badRequest("INVALID_REQUEST",
                    "search must be at most " + MAX_SEARCH_LENGTH + " characters");
        }
        Survey survey = resolve(surveyCode, version);
        SurveyStep step = stepOf(survey, stepId);
        if (step.isResult()) {
            throw SurveyException.badRequest("RESULT_STEP_NOT_EDITABLE", "The result step cannot contain questions");
        }
        Set<Long> usedElsewhere = new HashSet<>();
        Set<Long> inThisStep = new HashSet<>();
        for (SurveyStepQuestion link : stepQuestions.findAllBySurveyId(survey.getId())) {
            if (!link.isActive()) {
                continue;
            }
            (link.getStep().getId().equals(step.getId()) ? inThisStep : usedElsewhere).add(link.getQuestion().getId());
        }

        List<AssessmentQuestion> candidates = questions.findByStatusOrderByQuestionCodeAsc(ConfigStatus.ACTIVE).stream()
                .filter(q -> !usedElsewhere.contains(q.getId()))
                .filter(q -> matches(q, search))
                .toList();
        Map<Long, Long> optionCounts = candidates.isEmpty() ? Map.of()
                : options.findByQuestionIdInOrderBySortOrderAsc(candidates.stream().map(AssessmentQuestion::getId).toList())
                .stream()
                .filter(o -> o.getStatus() == ConfigStatus.ACTIVE)
                .collect(Collectors.groupingBy(o -> o.getQuestion().getId(), Collectors.counting()));
        return candidates.stream()
                .map(q -> new AvailableQuestionResponse(q.getQuestionCode(), q.getQuestionText(), q.getQuestionType(),
                        q.isRequired(), q.getUnit(), json(q.getValidationRules()),
                        optionCounts.getOrDefault(q.getId(), 0L).intValue(), inThisStep.contains(q.getId())))
                .toList();
    }

    private static boolean matches(AssessmentQuestion question, String search) {
        if (search == null || search.isBlank()) {
            return true;
        }
        String keyword = search.strip().toLowerCase(Locale.ROOT);
        return question.getQuestionCode().toLowerCase(Locale.ROOT).contains(keyword)
                || question.getQuestionText().toLowerCase(Locale.ROOT).contains(keyword);
    }

    @Transactional(readOnly = true)
    public ResultConfigResponse getResultConfig(String surveyCode, Integer version, Long stepId) {
        Survey survey = resolve(surveyCode, version);
        SurveyStep step = resultStepOf(survey, stepId);
        return new ResultConfigResponse(summaryOf(survey, step), resultConfig(step), levels());
    }

    // ---------- Ghi ----------

    /** Bước mới luôn ở DRAFT; bước QUESTIONS được chèn ngay trước bước RESULT, bước RESULT được đặt cuối. */
    @Transactional
    public StepDetailResponse create(String email, String surveyCode, Integer version, CreateStepRequest request) {
        Survey survey = lockEditable(surveyCode, version);
        User actor = actor(email);
        List<SurveyStep> ordered = steps.findBySurveyIdOrderBySortOrderAsc(survey.getId());
        SurveyStep.Type type = request.stepType() == null ? SurveyStep.Type.QUESTIONS : request.stepType();
        Optional<SurveyStep> resultStep = ordered.stream().filter(SurveyStep::isResult).findFirst();
        if (type == SurveyStep.Type.RESULT && resultStep.isPresent()) {
            throw SurveyException.conflict("RESULT_STEP_EXISTS", "This survey already has a result step");
        }

        String name = request.stepName().strip();
        requireUniqueName(ordered, name, null);
        Set<String> takenCodes = ordered.stream().map(SurveyStep::getStepCode).collect(Collectors.toSet());
        String code;
        if (request.stepCode() != null) {
            code = request.stepCode();
            if (takenCodes.contains(code)) {
                throw SurveyException.conflict("STEP_CODE_EXISTS", "Step code '" + code + "' is already used in this survey");
            }
        } else {
            code = generateStepCode(name, takenCodes);
        }

        SurveyStep step = new SurveyStep();
        step.setSurvey(survey);
        step.setStepCode(code);
        step.setStepName(name);
        step.setDescription(blankToNull(request.description()));
        step.setStepType(type);
        step.setStatus(SurveyStep.Status.DRAFT);
        if (type == SurveyStep.Type.RESULT) {
            step.setResultConfig(SurveyJson.writeValue(ResultConfig.defaults()));
        }
        touch(step, actor);

        List<SurveyStep> newOrder = new ArrayList<>(ordered);
        int index = type == SurveyStep.Type.QUESTIONS && resultStep.isPresent()
                ? newOrder.indexOf(resultStep.get())
                : newOrder.size();
        newOrder.add(index, step);
        applyOrder(newOrder);
        steps.save(step);
        steps.flush();
        return detail(survey, step);
    }

    /**
     * Pop-up "Update step" - "Save changes": tên, mô tả, trạng thái và danh sách câu hỏi (thứ tự, Required,
     * thêm, gỡ) được lưu trong 1 transaction; lỗi bất kỳ -> không lưu gì.
     * <ul>
     *   <li>revision lệch -> 409 STEP_MODIFIED (có người khác đã lưu bước này).</li>
     *   <li>Câu hỏi phải tồn tại, ACTIVE (trừ câu đã có sẵn trong bước) và chưa dùng ở bước khác của survey.</li>
     *   <li>Câu bị gỡ đã có member trả lời -> chỉ tắt liên kết (giữ câu trả lời cũ); chưa ai trả lời -> xóa liên kết.</li>
     *   <li>Required chỉ ghi đè trong bước này; trùng giá trị của ngân hàng câu hỏi thì lưu null.</li>
     *   <li>Không được làm hỏng cấu hình survey (vd gỡ câu mà điều kiện của câu khác đang tham chiếu).</li>
     * </ul>
     */
    @Transactional
    public StepDetailResponse update(String email, String surveyCode, Integer version, Long stepId,
            UpdateStepRequest request) {
        Survey survey = lockEditable(surveyCode, version);
        SurveyStep step = stepOf(survey, stepId);
        if (step.isResult()) {
            throw SurveyException.badRequest("RESULT_STEP_NOT_EDITABLE",
                    "The result step is configured, not edited; use the result-config endpoint");
        }
        if (step.getRevision() != request.revision()) {
            throw SurveyException.conflict("STEP_MODIFIED",
                    "This step was changed by someone else after you opened it; reload it and apply your changes again");
        }
        String name = request.stepName().strip();
        requireUniqueName(steps.findBySurveyIdOrderBySortOrderAsc(survey.getId()), name, step.getId());

        List<SurveyStepQuestion> surveyLinks = stepQuestions.findAllBySurveyId(survey.getId());
        Map<Long, SurveyStepQuestion> currentByQuestion = surveyLinks.stream()
                .filter(l -> l.getStep().getId().equals(step.getId()))
                .collect(Collectors.toMap(l -> l.getQuestion().getId(), Function.identity()));
        List<AssessmentQuestion> chosen = resolveQuestions(step, request.questions(), surveyLinks, currentByQuestion);

        long visibleAfter = chosen.stream().filter(q -> q.getStatus() == ConfigStatus.ACTIVE).count();
        requireAllowedStatus(step, request.status(), visibleAfter > 0);

        List<String> before = loader.findProblems(survey);

        // Câu được giữ/thêm theo đúng thứ tự gửi lên
        int order = 1;
        Set<Long> keptIds = new HashSet<>();
        for (int i = 0; i < chosen.size(); i++) {
            AssessmentQuestion question = chosen.get(i);
            boolean required = request.questions().get(i).required();
            SurveyStepQuestion link = currentByQuestion.get(question.getId());
            if (link == null) {
                link = new SurveyStepQuestion();
                link.setStep(step);
                link.setQuestion(question);
            }
            link.setActive(true);
            link.setSortOrder(order++);
            link.setRequired(required == question.isRequired() ? null : required);
            stepQuestions.save(link);
            keptIds.add(question.getId());
        }

        // Câu bị gỡ: đã có câu trả lời -> tắt (giữ dữ liệu), chưa có -> xóa liên kết
        List<SurveyStepQuestion> removed = currentByQuestion.values().stream()
                .filter(l -> !keptIds.contains(l.getQuestion().getId()))
                .sorted(Comparator.comparingInt(SurveyStepQuestion::getSortOrder))
                .toList();
        Set<Long> answered = removed.isEmpty() ? Set.of()
                : new HashSet<>(answers.findAnsweredQuestionIds(survey.getId(),
                        removed.stream().map(l -> l.getQuestion().getId()).toList()));
        for (SurveyStepQuestion link : removed) {
            if (answered.contains(link.getQuestion().getId())) {
                link.setActive(false);
                link.setSortOrder(order++);
            } else {
                stepQuestions.delete(link);
            }
        }

        step.setStepName(name);
        step.setDescription(blankToNull(request.description()));
        step.setStatus(request.status());
        touch(step, actor(email));
        requireNoNewProblems(survey, before);
        return detail(survey, step);
    }

    /** Kiểm tra danh sách câu hỏi gửi lên; gom mọi lỗi để pop-up hiện 1 lần. Trả về câu hỏi theo đúng thứ tự. */
    private List<AssessmentQuestion> resolveQuestions(SurveyStep step, List<StepQuestionInput> inputs,
            List<SurveyStepQuestion> surveyLinks, Map<Long, SurveyStepQuestion> currentByQuestion) {
        Map<String, AssessmentQuestion> bank = questions.findByQuestionCodeIn(
                        inputs.stream().map(StepQuestionInput::questionCode).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(AssessmentQuestion::getQuestionCode, Function.identity()));
        Map<Long, String> otherStepOf = new HashMap<>();
        for (SurveyStepQuestion link : surveyLinks) {
            if (link.isActive() && !link.getStep().getId().equals(step.getId())) {
                otherStepOf.put(link.getQuestion().getId(), link.getStep().getStepCode());
            }
        }

        List<ErrorItem> errors = new ArrayList<>();
        List<AssessmentQuestion> chosen = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (StepQuestionInput input : inputs) {
            String code = input.questionCode();
            AssessmentQuestion question = bank.get(code);
            if (!seen.add(code)) {
                errors.add(new ErrorItem(step.getStepCode(), code, "DUPLICATE_QUESTION",
                        "Question appears more than once in this step"));
            } else if (question == null) {
                errors.add(new ErrorItem(step.getStepCode(), code, "QUESTION_NOT_FOUND", "Question does not exist"));
            } else if (otherStepOf.containsKey(question.getId())) {
                errors.add(new ErrorItem(step.getStepCode(), code, "QUESTION_IN_OTHER_STEP",
                        "Question is already used in step " + otherStepOf.get(question.getId())));
            } else if (question.getStatus() != ConfigStatus.ACTIVE && !currentByQuestion.containsKey(question.getId())) {
                errors.add(new ErrorItem(step.getStepCode(), code, "QUESTION_INACTIVE",
                        "Inactive questions cannot be added"));
            } else {
                chosen.add(question);
            }
        }
        if (!errors.isEmpty()) {
            throw new SurveyException(HttpStatus.BAD_REQUEST, "INVALID_STEP_QUESTIONS",
                    "Some questions cannot be used in this step; nothing was saved", errors);
        }
        return chosen;
    }

    /** Luật chuyển trạng thái dùng chung cho "Update step" và menu "⋮". */
    private static void requireAllowedStatus(SurveyStep step, SurveyStep.Status target, boolean hasVisibleQuestions) {
        if (target == SurveyStep.Status.DRAFT && step.getStatus() != SurveyStep.Status.DRAFT) {
            throw SurveyException.conflict("INVALID_STATUS_TRANSITION",
                    "A published step cannot go back to DRAFT; set it INACTIVE instead");
        }
        if (target == SurveyStep.Status.ACTIVE && !step.isResult() && !hasVisibleQuestions) {
            throw SurveyException.conflict("STEP_HAS_NO_QUESTIONS",
                    "An active step needs at least one active question");
        }
    }

    /**
     * Chuyển trạng thái (menu "⋮"): DRAFT -> ACTIVE | INACTIVE, ACTIVE <-> INACTIVE.
     * Đã publish thì không quay lại DRAFT. Bước QUESTIONS cần ít nhất 1 câu hỏi ACTIVE mới được ACTIVE.
     */
    @Transactional
    public StepDetailResponse changeStatus(String email, String surveyCode, Integer version, Long stepId,
            ChangeStepStatusRequest request) {
        Survey survey = lockEditable(surveyCode, version);
        SurveyStep step = stepOf(survey, stepId);
        SurveyStep.Status target = request.status();
        if (step.getStatus() == target) {
            return detail(survey, step);
        }
        requireAllowedStatus(step, target,
                stepQuestions.findAllByStepId(step.getId()).stream().anyMatch(SurveyStepManagementService::visible));

        List<String> before = loader.findProblems(survey);
        step.setStatus(target);
        touch(step, actor(email));
        requireNoNewProblems(survey, before);
        return detail(survey, step);
    }

    /**
     * "Save order": stepIds phải là đúng toàn bộ bước hiện có (mỗi bước 1 lần). Danh sách lệch với DB
     * (có người vừa thêm/xóa bước) -> 409 STEP_ORDER_STALE để frontend tải lại thay vì ghi đè.
     */
    @Transactional
    public StepListResponse reorder(String surveyCode, Integer version, ReorderStepsRequest request) {
        Survey survey = lockEditable(surveyCode, version);
        List<SurveyStep> current = steps.findBySurveyIdOrderBySortOrderAsc(survey.getId());
        List<Long> ids = request.stepIds();
        if (new HashSet<>(ids).size() != ids.size()) {
            throw SurveyException.badRequest("DUPLICATE_STEP", "Each step must appear exactly once in stepIds");
        }
        Map<Long, SurveyStep> byId = current.stream().collect(Collectors.toMap(SurveyStep::getId, Function.identity()));
        if (ids.size() != current.size() || !byId.keySet().containsAll(ids)) {
            throw SurveyException.conflict("STEP_ORDER_STALE",
                    "The list of steps has changed since it was loaded; reload the steps and try again");
        }
        List<SurveyStep> newOrder = ids.stream().map(byId::get).toList();
        for (int i = 0; i < newOrder.size() - 1; i++) {
            if (newOrder.get(i).isResult()) {
                throw SurveyException.badRequest("RESULT_STEP_MUST_BE_LAST", "The result step must stay the last step");
            }
        }

        List<String> before = loader.findProblems(survey);
        applyOrder(newOrder);
        requireNoNewProblems(survey, before);
        return list(survey, null, null);
    }

    /**
     * Chỉ xóa được bước không ACTIVE, không phải RESULT và chưa có câu trả lời nào của member;
     * còn lại phải chuyển INACTIVE (giữ dữ liệu). Câu hỏi vẫn nằm trong ngân hàng câu hỏi, chỉ gỡ liên kết.
     */
    @Transactional
    public void delete(String surveyCode, Integer version, Long stepId) {
        Survey survey = lockEditable(surveyCode, version);
        SurveyStep step = stepOf(survey, stepId);
        if (step.isResult()) {
            throw SurveyException.conflict("RESULT_STEP_NOT_DELETABLE",
                    "The result step cannot be deleted; set it INACTIVE to hide it");
        }
        if (step.getStatus() == SurveyStep.Status.ACTIVE) {
            throw SurveyException.conflict("STEP_ACTIVE", "Deactivate the step before deleting it");
        }
        List<SurveyStepQuestion> links = stepQuestions.findAllByStepId(step.getId());
        List<Long> questionIds = links.stream().map(l -> l.getQuestion().getId()).toList();
        if (!questionIds.isEmpty() && answers.countBySurveyAndQuestions(survey.getId(), questionIds) > 0) {
            throw SurveyException.conflict("STEP_IN_USE",
                    "Members have already answered questions in this step; set it INACTIVE instead of deleting it");
        }

        List<SurveyStep> remaining = new ArrayList<>(steps.findBySurveyIdOrderBySortOrderAsc(survey.getId()));
        remaining.remove(step);
        stepQuestions.deleteAll(links);
        steps.delete(step);
        applyOrder(remaining);
        steps.flush();
    }

    @Transactional
    public ResultConfigResponse updateResultConfig(String email, String surveyCode, Integer version, Long stepId,
            UpdateResultConfigRequest request) {
        Survey survey = lockEditable(surveyCode, version);
        SurveyStep step = resultStepOf(survey, stepId);
        ResultConfig config = request.config();
        if (config.fallbackFitnessLevelId() != null && !fitnessLevels.existsById(config.fallbackFitnessLevelId())) {
            throw SurveyException.badRequest("FITNESS_LEVEL_NOT_FOUND",
                    "Fitness level " + config.fallbackFitnessLevelId() + " does not exist");
        }
        String name = request.stepName().strip();
        requireUniqueName(steps.findBySurveyIdOrderBySortOrderAsc(survey.getId()), name, step.getId());

        step.setStepName(name);
        step.setDescription(blankToNull(request.description()));
        step.setResultConfig(SurveyJson.writeValue(config));
        touch(step, actor(email));
        steps.flush();
        return new ResultConfigResponse(summaryOf(survey, step), config, levels());
    }

    // ---------- Sinh stepCode ----------

    /** "Body information" -> BODY_INFORMATION; bỏ dấu tiếng Việt; trùng thì thêm _2, _3... */
    static String generateStepCode(String stepName, Set<String> takenCodes) {
        String base = Normalizer.normalize(stepName, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('đ', 'd')
                .replace('Đ', 'D')
                .toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
        if (base.length() < 2 || !Character.isLetter(base.charAt(0))) {
            base = base.isEmpty() ? "STEP" : "STEP_" + base;
        }
        if (base.length() > GENERATED_CODE_BASE_LENGTH) {
            base = base.substring(0, GENERATED_CODE_BASE_LENGTH).replaceAll("_+$", "");
        }
        String code = base;
        for (int suffix = 2; takenCodes.contains(code); suffix++) {
            code = base + "_" + suffix;
        }
        return code;
    }

    // ---------- Helpers ----------

    /** Không có version -> ACTIVE, nếu không có thì DRAFT mới nhất. */
    private Survey resolve(String surveyCode, Integer version) {
        if (version != null) {
            return surveys.findBySurveyCodeAndVersion(surveyCode, version)
                    .orElseThrow(() -> SurveyException.notFound("SURVEY_NOT_FOUND",
                            "Survey '" + surveyCode + "' version " + version + " does not exist"));
        }
        return surveys.findBySurveyCodeAndStatus(surveyCode, Survey.Status.ACTIVE)
                .or(() -> surveys.findFirstBySurveyCodeAndStatusOrderByVersionDesc(surveyCode, Survey.Status.DRAFT))
                .orElseThrow(() -> SurveyException.notFound("SURVEY_NOT_FOUND",
                        "Survey '" + surveyCode + "' has no active or draft version"));
    }

    private Survey lockEditable(String surveyCode, Integer version) {
        Survey survey = surveys.findByIdForUpdate(resolve(surveyCode, version).getId())
                .orElseThrow(() -> SurveyException.notFound("SURVEY_NOT_FOUND",
                        "Survey '" + surveyCode + "' does not exist"));
        if (survey.getStatus() == Survey.Status.ARCHIVED) {
            throw SurveyException.conflict("SURVEY_ARCHIVED", "Survey '" + surveyCode + "' version "
                    + survey.getVersion() + " is archived and can no longer be changed");
        }
        return survey;
    }

    /** Bước của survey khác trả về như không tồn tại. */
    private SurveyStep stepOf(Survey survey, Long stepId) {
        return steps.findById(stepId)
                .filter(s -> s.getSurvey().getId().equals(survey.getId()))
                .orElseThrow(() -> SurveyException.notFound("STEP_NOT_FOUND",
                        "Step " + stepId + " does not exist in this survey"));
    }

    private SurveyStep resultStepOf(Survey survey, Long stepId) {
        SurveyStep step = stepOf(survey, stepId);
        if (!step.isResult()) {
            throw SurveyException.badRequest("NOT_A_RESULT_STEP",
                    "Only the result step can be configured; use the step update endpoint instead");
        }
        return step;
    }

    private User actor(String email) {
        return users.findByEmail(email).orElseThrow(() -> new SurveyException(HttpStatus.UNAUTHORIZED,
                "UNAUTHORIZED", "The signed-in user no longer exists"));
    }

    private static void requireUniqueName(List<SurveyStep> existing, String name, Long exceptStepId) {
        boolean taken = existing.stream()
                .anyMatch(s -> !s.getId().equals(exceptStepId) && s.getStepName().strip().equalsIgnoreCase(name));
        if (taken) {
            throw SurveyException.conflict("STEP_NAME_EXISTS", "A step named '" + name + "' already exists in this survey");
        }
    }

    /**
     * So cấu hình trước/sau thay đổi: chỉ chặn lỗi MỚI do thay đổi này gây ra. Lỗi có sẵn từ trước
     * không chặn, để content manager vẫn sửa được survey đang lỗi.
     */
    private void requireNoNewProblems(Survey survey, List<String> before) {
        steps.flush();
        List<ErrorItem> introduced = loader.findProblems(survey).stream()
                .filter(problem -> !before.contains(problem))
                .map(problem -> new ErrorItem(null, null, "CONFIG_PROBLEM", problem))
                .toList();
        if (!introduced.isEmpty()) {
            throw new SurveyException(HttpStatus.CONFLICT, "SURVEY_CONFIG_CONFLICT",
                    "This change would break the survey configuration; nothing was saved", introduced);
        }
    }

    private static void applyOrder(List<SurveyStep> ordered) {
        for (int i = 0; i < ordered.size(); i++) {
            ordered.get(i).setSortOrder(i + 1);
        }
    }

    /** Nội dung bước vừa đổi: cập nhật audit và tăng revision (đổi thứ tự không gọi hàm này). */
    private static void touch(SurveyStep step, User actor) {
        step.setUpdatedAt(LocalDateTime.now());
        step.setUpdatedBy(actor);
        step.setRevision(step.getRevision() + 1);
    }

    private StepListResponse list(Survey survey, String search, SurveyStep.Status status) {
        String keyword = search == null ? "" : search.strip().toLowerCase(Locale.ROOT);
        List<StepSummaryResponse> matching = summaries(survey).stream()
                .filter(s -> keyword.isEmpty() || s.stepName().toLowerCase(Locale.ROOT).contains(keyword))
                .toList();
        StatusCounts counts = new StatusCounts(matching.size(),
                count(matching, SurveyStep.Status.ACTIVE),
                count(matching, SurveyStep.Status.DRAFT),
                count(matching, SurveyStep.Status.INACTIVE));
        List<StepSummaryResponse> visibleSteps = status == null ? matching
                : matching.stream().filter(s -> s.status().equals(status.name())).toList();
        return new StepListResponse(
                new SurveyInfo(survey.getSurveyCode(), survey.getSurveyName(), survey.getVersion(),
                        survey.getStatus().name()),
                counts, visibleSteps);
    }

    private static long count(List<StepSummaryResponse> steps, SurveyStep.Status status) {
        return steps.stream().filter(s -> s.status().equals(status.name())).count();
    }

    /** Toàn bộ bước theo thứ tự, 2 query (bước + liên kết câu hỏi), position = số thứ tự trên survey. */
    private List<StepSummaryResponse> summaries(Survey survey) {
        Map<Long, List<SurveyStepQuestion>> linksByStep = stepQuestions.findAllBySurveyId(survey.getId()).stream()
                .collect(Collectors.groupingBy(l -> l.getStep().getId()));
        List<SurveyStep> ordered = steps.findBySurveyIdOrderBySortOrderAsc(survey.getId());
        List<StepSummaryResponse> result = new ArrayList<>(ordered.size());
        for (int i = 0; i < ordered.size(); i++) {
            SurveyStep step = ordered.get(i);
            result.add(summary(step, i + 1, linksByStep.getOrDefault(step.getId(), List.of())));
        }
        return result;
    }

    private StepSummaryResponse summaryOf(Survey survey, SurveyStep step) {
        return summaries(survey).stream()
                .filter(s -> s.id().equals(step.getId()))
                .findFirst()
                .orElseThrow();
    }

    private static StepSummaryResponse summary(SurveyStep step, int position, List<SurveyStepQuestion> links) {
        List<AssessmentQuestion> visibleQuestions = links.stream()
                .filter(SurveyStepManagementService::visible)
                .map(SurveyStepQuestion::getQuestion)
                .toList();
        LocalDateTime updatedAt = links.stream()
                .map(l -> l.getQuestion().getUpdatedAt())
                .filter(Objects::nonNull)
                .reduce(step.getUpdatedAt(), (latest, candidate) ->
                        latest == null || candidate.isAfter(latest) ? candidate : latest);
        return new StepSummaryResponse(step.getId(), step.getStepCode(), step.getStepName(), step.getDescription(),
                step.getStepType().name(), step.getStatus().name(), position, visibleQuestions.size(),
                visibleQuestions.stream().map(AssessmentQuestion::getQuestionType).distinct().toList(),
                updatedAt, step.getRevision());
    }

    private StepDetailResponse detail(Survey survey, SurveyStep step) {
        List<StepQuestionItem> questions = stepQuestions.findAllByStepId(step.getId()).stream()
                .sorted(Comparator.comparing((SurveyStepQuestion l) -> !visible(l))
                        .thenComparingInt(SurveyStepQuestion::getSortOrder))
                .map(link -> {
                    AssessmentQuestion q = link.getQuestion();
                    return new StepQuestionItem(q.getQuestionCode(), q.getQuestionText(), q.getQuestionType(),
                            link.isEffectivelyRequired(), q.isRequired(), q.getUnit(), json(q.getValidationRules()),
                            link.getSortOrder(), visible(link), json(link.getConditionalRules()));
                })
                .toList();
        return new StepDetailResponse(summaryOf(survey, step), questions, step.isResult() ? resultConfig(step) : null);
    }

    /** Câu hỏi member thấy được: liên kết và câu hỏi đều ACTIVE. */
    private static boolean visible(SurveyStepQuestion link) {
        return link.isActive() && link.getQuestion().getStatus() == ConfigStatus.ACTIVE;
    }

    /** result_config hỏng/thiếu -> trả mặc định để content manager lưu lại cấu hình đúng. */
    private static ResultConfig resultConfig(SurveyStep step) {
        try {
            ResultConfig config = SurveyJson.read(step.getResultConfig(), ResultConfig.class);
            return config == null ? ResultConfig.defaults() : config;
        } catch (IllegalArgumentException exception) {
            log.warn("Step {} has an invalid result_config, showing defaults: {}", step.getStepCode(),
                    exception.getMessage());
            return ResultConfig.defaults();
        }
    }

    private List<FitnessLevelOption> levels() {
        return fitnessLevels.findAll(Sort.by("id")).stream()
                .map(level -> new FitnessLevelOption(level.getId(), level.getName()))
                .toList();
    }

    private static OptionResponse toOption(AssessmentOption o) {
        return new OptionResponse(o.getOptionCode(), o.getOptionLabel(), o.getOptionValue(), o.getSortOrder());
    }

    /** JSON cấu hình hỏng không làm sập màn quản lý: trả về chuỗi gốc để content manager thấy và sửa. */
    private static JsonNode json(String raw) {
        try {
            return SurveyJson.parse(raw);
        } catch (IllegalArgumentException exception) {
            return SurveyJson.nodes().stringNode(raw);
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
