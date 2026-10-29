package com.calishealth.service.survey;

import com.calishealth.dtos.SurveyDtos.OptionResponse;
import com.calishealth.dtos.SurveyStepManagementDtos.OptionInput;
import com.calishealth.dtos.SurveyStepManagementDtos.QuestionContentInput;
import com.calishealth.exception.SurveyException.ErrorItem;
import com.calishealth.models.AssessmentOption;
import com.calishealth.models.AssessmentQuestion;
import com.calishealth.models.ConfigStatus;
import com.calishealth.repository.AssessmentAnswerRepository;
import com.calishealth.repository.AssessmentOptionRepository;
import com.calishealth.repository.AssessmentQuestionRepository;
import com.calishealth.repository.LevelRuleCriterionRepository;
import com.calishealth.service.survey.definition.OptionDefinition;
import com.calishealth.service.survey.definition.QuestionDefinition;
import com.calishealth.service.survey.questiontype.QuestionTypeHandler;
import com.calishealth.service.survey.questiontype.QuestionTypeRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Editor câu hỏi kiểu Google Form trong pop-up Create / Update step: tạo câu hỏi mới hoặc sửa nội dung câu hỏi
 * trong ngân hàng (nội dung, mô tả, loại, khoảng giá trị, đơn vị, lựa chọn).
 *
 * <ul>
 *   <li>Cấu hình được kiểm tra bằng đúng handler của loại câu hỏi (cùng luật với lúc member trả lời).</li>
 *   <li>Câu đã có member trả lời (ở bất kỳ survey nào) hoặc rule chấm level đang dùng: không đổi được loại.</li>
 *   <li>Lựa chọn bị gỡ: câu đã có câu trả lời -> chỉ ẩn (INACTIVE) để câu trả lời cũ vẫn đọc được;
 *       chưa có -> xóa.</li>
 *   <li>Màn member hiển thị display_config.label (nếu có) thay cho question_text, nên đổi nội dung câu hỏi
 *       thì cập nhật luôn label để member thấy đúng chữ content manager vừa nhập.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
public class StepQuestionWriter {
    private static final Set<String> CHOICE_TYPES = Set.of("SINGLE_SELECT", "MULTIPLE_SELECT");
    private static final String NUMBER = "NUMBER";

    private final AssessmentQuestionRepository questions;
    private final AssessmentOptionRepository options;
    private final AssessmentAnswerRepository answers;
    private final LevelRuleCriterionRepository levelCriteria;
    private final QuestionTypeRegistry registry;

    /** Câu nào đã có câu trả lời / đang được rule chấm level dùng. */
    public record Locks(Set<Long> answeredIds, Set<String> levelRuleCodes) {
        public boolean answered(AssessmentQuestion question) {
            return question.getId() != null && answeredIds.contains(question.getId());
        }

        public boolean typeLocked(AssessmentQuestion question) {
            return answered(question) || levelRuleCodes.contains(question.getQuestionCode());
        }
    }

    public Locks locks(Collection<AssessmentQuestion> existing) {
        List<Long> ids = existing.stream().map(AssessmentQuestion::getId).distinct().toList();
        Set<Long> answered = ids.isEmpty() ? Set.of() : new HashSet<>(answers.findQuestionIdsWithAnswers(ids));
        return new Locks(answered, new HashSet<>(levelCriteria.findAllQuestionCodes()));
    }

    /** Lựa chọn ACTIVE của các câu hỏi, theo thứ tự hiển thị. */
    public Map<Long, List<OptionResponse>> activeOptions(Collection<AssessmentQuestion> existing) {
        List<Long> ids = existing.stream().map(AssessmentQuestion::getId).distinct().toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return options.findByQuestionIdInOrderBySortOrderAsc(ids).stream()
                .filter(o -> o.getStatus() == ConfigStatus.ACTIVE)
                .collect(Collectors.groupingBy(o -> o.getQuestion().getId(), Collectors.mapping(
                        o -> new OptionResponse(o.getOptionCode(), o.getOptionLabel(), o.getOptionValue(),
                                o.getSortOrder()),
                        Collectors.toList())));
    }

    /**
     * Kiểm tra nội dung 1 câu hỏi (existing = null với câu mới). position: số thứ tự trong bước, để thông báo
     * "Question 3: ..." cho câu chưa có mã. Không ghi gì.
     */
    public List<ErrorItem> check(String stepCode, int position, AssessmentQuestion existing,
            QuestionContentInput content, Locks locks) {
        String code = existing == null ? null : existing.getQuestionCode();
        String where = "Question " + position + ": ";
        List<ErrorItem> errors = new ArrayList<>();
        String type = content.questionType().strip();
        Optional<QuestionTypeHandler> handler = registry.find(type);
        if (handler.isEmpty()) {
            errors.add(new ErrorItem(stepCode, code, "UNSUPPORTED_QUESTION_TYPE",
                    where + "question type '" + type + "' is not supported"));
            return errors;
        }
        if (existing != null && !existing.getQuestionType().equals(type) && locks.typeLocked(existing)) {
            errors.add(new ErrorItem(stepCode, code, "QUESTION_TYPE_LOCKED", where + (locks.answered(existing)
                    ? "members have already answered this question, so its type cannot change"
                    : "the level rules use this question, so its type cannot change")));
        }

        List<OptionDefinition> definitions = new ArrayList<>();
        if (CHOICE_TYPES.contains(type)) {
            Set<String> ownCodes = existing == null ? Set.of()
                    : options.findByQuestionIdInOrderBySortOrderAsc(List.of(existing.getId())).stream()
                    .map(AssessmentOption::getOptionCode)
                    .collect(Collectors.toSet());
            Set<String> labels = new HashSet<>();
            List<OptionInput> inputs = content.options() == null ? List.of() : content.options();
            for (int i = 0; i < inputs.size(); i++) {
                OptionInput option = inputs.get(i);
                String label = option.label().strip();
                if (!labels.add(label.toLowerCase(Locale.ROOT))) {
                    errors.add(new ErrorItem(stepCode, code, "DUPLICATE_OPTION",
                            where + "option '" + label + "' appears more than once"));
                }
                if (option.optionCode() != null && !ownCodes.contains(option.optionCode())) {
                    errors.add(new ErrorItem(stepCode, code, "OPTION_NOT_FOUND",
                            where + "option '" + option.optionCode() + "' does not belong to this question"));
                }
                definitions.add(new OptionDefinition(option.optionCode() == null ? "NEW_" + i : option.optionCode(),
                        label, null, i + 1, true));
            }
        }

        JsonNode rules = SurveyJson.isNull(content.validationRules())
                ? SurveyJson.nodes().objectNode() : content.validationRules();
        QuestionDefinition definition = new QuestionDefinition(null, code, content.questionText(),
                content.description(), type, false, rules, null, content.unit(), null, true, definitions);
        handler.get().validateConfig(definition)
                .forEach(problem -> errors.add(new ErrorItem(stepCode, code, "INVALID_QUESTION_CONFIG", where + problem)));
        return errors;
    }

    /**
     * Ghi câu hỏi đã qua check(): existing = null -> tạo câu mới (mã sinh từ nội dung, required mặc định = required).
     * reservedCodes: mã câu hỏi đã sinh trong cùng request, tránh trùng trước khi flush.
     */
    public AssessmentQuestion write(AssessmentQuestion existing, QuestionContentInput content, boolean required,
            Locks locks, Set<String> reservedCodes) {
        AssessmentQuestion question = existing != null ? existing : new AssessmentQuestion();
        String text = content.questionText().strip();
        if (existing == null) {
            String code = SurveyCodes.generate(text, "QUESTION",
                    c -> reservedCodes.contains(c) || questions.existsByQuestionCode(c));
            reservedCodes.add(code);
            question.setQuestionCode(code);
            question.setRequired(required);
            question.setStatus(ConfigStatus.ACTIVE);
        } else if (!text.equals(existing.getQuestionText())) {
            question.setDisplayConfig(withLabel(existing.getDisplayConfig(), text));
        }
        String type = content.questionType().strip();
        question.setQuestionText(text);
        question.setDescription(blankToNull(content.description()));
        question.setQuestionType(type);
        question.setUnit(NUMBER.equals(type) ? blankToNull(content.unit()) : null);
        JsonNode rules = content.validationRules();
        question.setValidationRules(SurveyJson.isNull(rules) || rules.isEmpty() ? null : SurveyJson.write(rules));
        questions.save(question);

        boolean keepRemoved = existing != null && locks.answered(existing);
        syncOptions(question, CHOICE_TYPES.contains(type) && content.options() != null ? content.options() : List.of(),
                existing == null, keepRemoved);
        return question;
    }

    /** Lựa chọn theo đúng danh sách gửi lên; lựa chọn không còn trong danh sách bị ẩn (keepRemoved) hoặc xóa. */
    private void syncOptions(AssessmentQuestion question, List<OptionInput> inputs, boolean isNew, boolean keepRemoved) {
        List<AssessmentOption> current = isNew ? List.of()
                : options.findByQuestionIdInOrderBySortOrderAsc(List.of(question.getId()));
        Map<String, AssessmentOption> byCode = new HashMap<>();
        current.forEach(o -> byCode.put(o.getOptionCode(), o));
        Set<String> takenCodes = new HashSet<>(byCode.keySet());
        Set<String> kept = new HashSet<>();

        for (int i = 0; i < inputs.size(); i++) {
            OptionInput input = inputs.get(i);
            AssessmentOption option = input.optionCode() == null ? null : byCode.get(input.optionCode());
            if (option == null) {
                option = new AssessmentOption();
                option.setQuestion(question);
                option.setOptionCode(SurveyCodes.generate(input.label().strip(), "OPTION", takenCodes::contains));
                takenCodes.add(option.getOptionCode());
            }
            option.setOptionLabel(input.label().strip());
            option.setSortOrder(i + 1);
            option.setStatus(ConfigStatus.ACTIVE);
            options.save(option);
            kept.add(option.getOptionCode());
        }

        int order = inputs.size();
        for (AssessmentOption option : current) {
            if (kept.contains(option.getOptionCode())) {
                continue;
            }
            if (keepRemoved) {
                option.setStatus(ConfigStatus.INACTIVE);
                option.setSortOrder(++order);
                options.save(option);
            } else {
                options.delete(option);
            }
        }
    }

    /** display_config có "label" (nhãn member thấy) -> đổi theo nội dung mới; không có thì giữ nguyên. */
    private static String withLabel(String displayConfig, String text) {
        JsonNode config;
        try {
            config = SurveyJson.parse(displayConfig);
        } catch (IllegalArgumentException exception) {
            return displayConfig;
        }
        if (config instanceof ObjectNode object && object.has("label")) {
            object.put("label", text);
            return SurveyJson.write(object);
        }
        return displayConfig;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
