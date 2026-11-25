package com.calishealth.service.survey;

import com.calishealth.dtos.SurveyStepManagementDtos.OptionInput;
import com.calishealth.dtos.SurveyStepManagementDtos.QuestionContentInput;
import com.calishealth.exception.SurveyException.ErrorItem;
import com.calishealth.models.AssessmentOption;
import com.calishealth.models.AssessmentQuestion;
import com.calishealth.models.ConfigStatus;
import com.calishealth.repository.AssessmentAnswerRepository;
import com.calishealth.repository.AssessmentOptionRepository;
import com.calishealth.repository.AssessmentQuestionRepository;
import com.calishealth.service.survey.questiontype.QuestionTypeRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Set;

import static com.calishealth.service.survey.SurveyFixtures.json;
import static com.calishealth.service.survey.SurveyFixtures.registry;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Bo sung coverage cho {@link StepQuestionWriter}. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StepQuestionWriterExtraCoverageTest {

    @Mock private AssessmentQuestionRepository questions;
    @Mock private AssessmentOptionRepository options;
    @Mock private AssessmentAnswerRepository answers;

    private StepQuestionWriter writer;

    @BeforeEach
    void setUp() {
        writer = new StepQuestionWriter(questions, options, answers, registry());
    }

    private static AssessmentQuestion existingQuestion() {
        AssessmentQuestion question = new AssessmentQuestion();
        question.setId(11L);
        question.setQuestionCode("AGE");
        question.setQuestionText("How old are you?");
        question.setQuestionType("NUMBER");
        question.setStatus(ConfigStatus.ACTIVE);
        return question;
    }

    private static AssessmentOption option(String code, String label, int order) {
        AssessmentOption option = new AssessmentOption();
        option.setId((long) order);
        option.setOptionCode(code);
        option.setOptionLabel(label);
        option.setSortOrder(order);
        option.setStatus(ConfigStatus.ACTIVE);
        return option;
    }

    @Test
    @DisplayName("check: hai lua chon trung nhan -> DUPLICATE_OPTION")
    void duplicateOptionLabelsAreRejected() {
        AssessmentQuestion question = existingQuestion();
        question.setQuestionType("SINGLE_SELECT");
        when(options.findByQuestionIdInOrderBySortOrderAsc(anyCollection())).thenReturn(List.of());

        QuestionContentInput content = new QuestionContentInput("Pick one", null, "SINGLE_SELECT", null,
                null, List.of(new OptionInput(null, "Yes"), new OptionInput(null, "Yes")));

        List<ErrorItem> errors = writer.check("STEP1", 1, question, content, writer.locks(List.of(question)));

        assertThat(errors).anyMatch(e -> e.code().equals("DUPLICATE_OPTION"));
    }

    @Test
    @DisplayName("check: optionCode khong thuoc cau hoi -> OPTION_NOT_FOUND")
    void unknownOptionCodeIsRejected() {
        AssessmentQuestion question = existingQuestion();
        question.setQuestionType("SINGLE_SELECT");
        when(options.findByQuestionIdInOrderBySortOrderAsc(anyCollection())).thenReturn(List.of());

        QuestionContentInput content = new QuestionContentInput("Pick one", null, "SINGLE_SELECT", null,
                null, List.of(new OptionInput("GHOST", "Yes")));

        List<ErrorItem> errors = writer.check("STEP1", 1, question, content, writer.locks(List.of(question)));

        assertThat(errors).anyMatch(e -> e.code().equals("OPTION_NOT_FOUND"));
    }

    @Test
    @DisplayName("write: cau moi co lua chon -> sinh ma lua chon tu label")
    void writeCreatesOptionsForNewQuestion() {
        when(questions.existsByQuestionCode(any())).thenReturn(false);
        when(questions.save(any(AssessmentQuestion.class))).thenAnswer(inv -> inv.getArgument(0));

        QuestionContentInput content = new QuestionContentInput("Pick one", null, "SINGLE_SELECT", null,
                null, List.of(new OptionInput(null, "Yes"), new OptionInput(null, "No")));

        AssessmentQuestion written = writer.write(null, content, true, writer.locks(List.of()),
                new java.util.HashSet<>());

        assertThat(written.getQuestionCode()).isNotBlank();
        assertThat(written.isRequired()).isTrue();
        verify(options, org.mockito.Mockito.times(2)).save(any(AssessmentOption.class));
    }

    @Test
    @DisplayName("write: lua chon bi gia remove -> xoa han")
    void removedOptionIsDeletedWhenNotAnswered() {
        AssessmentQuestion question = existingQuestion();
        question.setQuestionType("SINGLE_SELECT");
        when(questions.save(any(AssessmentQuestion.class))).thenAnswer(inv -> inv.getArgument(0));
        when(options.findByQuestionIdInOrderBySortOrderAsc(anyCollection()))
                .thenReturn(List.of(option("OPT_A", "Yes", 1), option("OPT_B", "No", 2)));

        QuestionContentInput content = new QuestionContentInput("Pick one", null, "SINGLE_SELECT", null,
                null, List.of(new OptionInput("OPT_A", "Yes")));

        writer.write(question, content, true, writer.locks(List.of(question)), new java.util.HashSet<>());

        ArgumentCaptor<AssessmentOption> captor = ArgumentCaptor.forClass(AssessmentOption.class);
        verify(options).delete(captor.capture());
        assertThat(captor.getValue().getOptionCode()).isEqualTo("OPT_B");
    }

    @Test
    @DisplayName("write: cau da co cau tra loi -> lua chon bi gia remove chi an di")
    void removedOptionIsHiddenWhenAnswered() {
        AssessmentQuestion question = existingQuestion();
        question.setQuestionType("SINGLE_SELECT");
        when(questions.save(any(AssessmentQuestion.class))).thenAnswer(inv -> inv.getArgument(0));
        when(options.findByQuestionIdInOrderBySortOrderAsc(anyCollection()))
                .thenReturn(List.of(option("OPT_A", "Yes", 1), option("OPT_B", "No", 2)));
        when(answers.findQuestionIdsWithAnswers(anyCollection())).thenReturn(List.of(11L));

        QuestionContentInput content = new QuestionContentInput("Pick one", null, "SINGLE_SELECT", null,
                null, List.of(new OptionInput("OPT_A", "Yes")));

        writer.write(question, content, true, writer.locks(List.of(question)), new java.util.HashSet<>());

        ArgumentCaptor<AssessmentOption> captor = ArgumentCaptor.forClass(AssessmentOption.class);
        verify(options, org.mockito.Mockito.never()).delete(any());
        verify(options).save(org.mockito.Mockito.argThat(saved ->
                "OPT_B".equals(saved.getOptionCode()) && saved.getStatus() == ConfigStatus.INACTIVE));
    }

    @Test
    @DisplayName("write: display_config khong phai JSON -> giu nguyen")
    void brokenDisplayConfigIsKeptAsIs() {
        AssessmentQuestion question = existingQuestion();
        question.setDisplayConfig("not-json");
        when(questions.save(any(AssessmentQuestion.class))).thenAnswer(inv -> inv.getArgument(0));

        QuestionContentInput content = new QuestionContentInput("New text", null, "NUMBER", null, null, null);

        writer.write(question, content, true, writer.locks(List.of(question)), new java.util.HashSet<>());

        assertThat(question.getDisplayConfig()).isEqualTo("not-json");
    }

    @Test
    @DisplayName("write: display_config co label -> cap nhat label theo noi dung moi")
    void displayConfigLabelIsUpdated() {
        AssessmentQuestion question = existingQuestion();
        question.setDisplayConfig("{\"label\":\"How old are you?\"}");
        when(questions.save(any(AssessmentQuestion.class))).thenAnswer(inv -> inv.getArgument(0));

        QuestionContentInput content = new QuestionContentInput("New text", null, "NUMBER", null, null, null);

        writer.write(question, content, true, writer.locks(List.of(question)), new java.util.HashSet<>());

        assertThat(question.getDisplayConfig()).contains("New text");
    }

    @Test
    @DisplayName("activeOptions: khong co cau hoi -> map rong")
    void activeOptionsWithNoQuestionsIsEmpty() {
        assertThat(writer.activeOptions(List.of())).isEmpty();
    }

    @Test
    @DisplayName("locks: khong co cau hoi -> khong co id bi khoa")
    void locksWithNoQuestionsHasNoIds() {
        assertThat(writer.locks(List.of()).answeredIds()).isEmpty();
    }
}
