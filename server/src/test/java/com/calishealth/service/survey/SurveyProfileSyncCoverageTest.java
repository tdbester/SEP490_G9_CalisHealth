package com.calishealth.service.survey;

import com.calishealth.models.AssessmentOption;
import com.calishealth.models.AssessmentQuestion;
import com.calishealth.models.ConfigStatus;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.MemberProfile;
import com.calishealth.models.User;
import com.calishealth.repository.AssessmentOptionRepository;
import com.calishealth.repository.AssessmentQuestionRepository;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.MemberTrackingRepository;
import com.calishealth.service.MemberFitnessLevelService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bá»™ test cho {@link SurveyProfileSync}: Ä‘á»“ng bá»™ cÃ¢u tráº£ lá»i kháº£o sÃ¡t vÃ o há»“ sÆ¡ member.
 */
class SurveyProfileSyncCoverageTest {

    private MemberProfileRepository profiles;
    private MemberTrackingRepository tracking;
    private AssessmentOptionRepository options;
    private AssessmentQuestionRepository questions;
    private MemberFitnessLevelService fitnessLevelsService;
    private SurveyProfileSync sync;

    @BeforeEach
    void setUp() {
        profiles = mock(MemberProfileRepository.class);
        tracking = mock(MemberTrackingRepository.class);
        options = mock(AssessmentOptionRepository.class);
        questions = mock(AssessmentQuestionRepository.class);
        fitnessLevelsService = mock(MemberFitnessLevelService.class);
        sync = new SurveyProfileSync(profiles, tracking, options, questions, fitnessLevelsService);
        lenient().when(profiles.save(any(MemberProfile.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(questions.findByQuestionCodeIn(any())).thenReturn(List.of());
        lenient().when(options.findByQuestionIdInOrderBySortOrderAsc(any())).thenReturn(List.of());
    }

    private static User user() {
        User user = new User();
        user.setId(3L);
        user.setEmail("member@example.test");
        return user;
    }

    private static JsonNode textNode(String value) {
        return JsonNodeFactory.instance.textNode(value);
    }

    private static JsonNode numberNode(int value) {
        return JsonNodeFactory.instance.numberNode(value);
    }

    private static JsonNode decimalNode(String value) {
        return JsonNodeFactory.instance.numberNode(Double.parseDouble(value));
    }

    private static MemberProfile profile() {
        MemberProfile profile = new MemberProfile();
        profile.setId(9L);
        profile.setUser(user());
        return profile;
    }

    @Test
    @DisplayName("provenance: bang mapping cau hoi -> cot ho so")
    void provenanceListsSources() {
        assertThat(sync.provenance()).containsKeys("GENDER", "AGE", "HEIGHT", "WEIGHT", "GOAL_TYPE");
    }

    @Test
    @DisplayName("apply: user null -> rong")
    void applyWithoutUserReturnsEmpty() {
        assertThat(sync.apply(null, Map.of(), null)).isEmpty();
    }

    @Test
    @DisplayName("apply: ghi gioi tinh, tuoi, chieu cao, can nang")
    void applyWritesCoreFields() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));

        Map<String, JsonNode> answers = Map.of(
                "GENDER", textNode("MALE"),
                "AGE", numberNode(30),
                "HEIGHT", decimalNode("175"),
                "WEIGHT", decimalNode("70"));

        var result = sync.apply(user(), answers, null);

        assertThat(result).isPresent();
        assertThat(profile.getGender()).isEqualTo("Male");
        assertThat(profile.getHeight()).isEqualByComparingTo("175");
        assertThat(profile.getWeight()).isEqualByComparingTo("70");
        assertThat(profile.getDateOfBirth()).isNotNull();
        assertThat(profile.getDateOfBirth().getYear()).isEqualTo(LocalDate.now().getYear() - 30);
    }

    @Test
    @DisplayName("apply: ngay sinh da co -> khong ghi de")
    void applyKeepsExistingDateOfBirth() {
        MemberProfile profile = profile();
        LocalDate existing = LocalDate.of(1990, 5, 5);
        profile.setDateOfBirth(existing);
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));

        sync.apply(user(), Map.of("AGE", numberNode(30)), null);

        assertThat(profile.getDateOfBirth()).isEqualTo(existing);
    }

    @Test
    @DisplayName("apply: tuoi ngoai 1..120 -> bo qua")
    void applyIgnoresInvalidAge() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));

        sync.apply(user(), Map.of("AGE", numberNode(500)), null);

        assertThat(profile.getDateOfBirth()).isNull();
    }

    @Test
    @DisplayName("apply: chieu cao/can nang khong phai so -> bo qua")
    void applyIgnoresNonNumericMeasurements() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));

        sync.apply(user(), Map.of("HEIGHT", textNode("abc"), "WEIGHT", textNode("xyz")), null);

        assertThat(profile.getHeight()).isNull();
        assertThat(profile.getWeight()).isNull();
    }

    @Test
    @DisplayName("apply: chieu cao/can nang la chuoi so -> dung")
    void applyParsesNumericText() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));

        sync.apply(user(), Map.of("HEIGHT", textNode("180"), "WEIGHT", textNode("75.5")), null);

        assertThat(profile.getHeight()).isEqualByComparingTo("180");
        assertThat(profile.getWeight()).isEqualByComparingTo("75.5");
    }

    @Test
    @DisplayName("apply: chieu cao/can nbang <= 0 -> bo qua")
    void applyIgnoresNonPositiveMeasurements() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));

        sync.apply(user(), Map.of("HEIGHT", decimalNode("0"), "WEIGHT", decimalNode("-5")), null);

        assertThat(profile.getHeight()).isNull();
        assertThat(profile.getWeight()).isNull();
    }

    @Test
    @DisplayName("apply: muc tieu -> luu ma")
    void applyWritesGoal() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));

        sync.apply(user(), Map.of("GOAL_TYPE", textNode("HEALTH")), null);

        assertThat(profile.getGoals()).isEqualTo("HEALTH");
    }

    @Test
    @DisplayName("apply: muc tieu rong -> khong doi")
    void applyIgnoresBlankGoal() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));

        sync.apply(user(), Map.of("GOAL_TYPE", textNode("   ")), null);

        assertThat(profile.getGoals()).isNull();
    }

    @Test
    @DisplayName("apply: so buoi/tuan hop le -> luu")
    void applyWritesDaysPerWeek() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));

        sync.apply(user(), Map.of(
                "HOW_MANY_DAYS_PER_WEEK_DO_YOU_WANT_TO_TRAIN_WITH_CALISHE", numberNode(5)), null);

        assertThat(profile.getDaysPerWeek()).isEqualTo(5);
    }

    @Test
    @DisplayName("apply: so buoi/tuan ngoai 1..7 -> bo qua")
    void applyIgnoresInvalidDaysPerWeek() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));

        sync.apply(user(), Map.of(
                "HOW_MANY_DAYS_PER_WEEK_DO_YOU_WANT_TO_TRAIN_WITH_CALISHE", numberNode(9)), null);

        assertThat(profile.getDaysPerWeek()).isEqualTo(3);
    }

    @Test
    @DisplayName("apply: co level -> gan level vao ho so")
    void applyAssignsLevel() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));
        FitnessLevel level = new FitnessLevel();
        level.setId(4L);
        level.setName("Beginner");

        sync.apply(user(), Map.of(), level);

        verify(fitnessLevelsService).changeLevel(profile, level);
    }

    @Test
    @DisplayName("apply: co du lieu do -> ghi them vao lich su")
    void applyRecordsMeasurement() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));
        when(tracking.hasMetric(9L, null, null)).thenReturn(false);

        sync.apply(user(), Map.of("HEIGHT", decimalNode("175"), "WEIGHT", decimalNode("70")), null);

        verify(tracking).saveBodyMetric(org.mockito.ArgumentMatchers.eq(9L), any(), any(), any(), anyString());
    }

    @Test
    @DisplayName("apply: do da co san -> khong ghi lai")
    void applySkipsDuplicateMeasurement() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));
        when(tracking.hasMetric(any(), any(), any())).thenReturn(true);

        sync.apply(user(), Map.of("HEIGHT", decimalNode("175"), "WEIGHT", decimalNode("70")), null);

        verify(tracking, never()).saveBodyMetric(any(), any(), any(), any(), anyString());
    }

    @Test
    @DisplayName("apply: khong co do -> khong ghi lich su")
    void applySkipsMeasurementWhenMissing() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));

        sync.apply(user(), Map.of(), null);

        verify(tracking, never()).saveBodyMetric(any(), any(), any(), any(), anyString());
    }

    @Test
    @DisplayName("apply: gioi tinh tra qua nhan -> luu nhan")
    void applyUsesChoiceLabelForGender() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));

        AssessmentQuestion question = new AssessmentQuestion();
        question.setId(1L);
        question.setQuestionCode("GENDER");
        question.setQuestionType("SINGLE_SELECT");
        question.setStatus(ConfigStatus.ACTIVE);
        when(questions.findByQuestionCodeIn(any())).thenReturn(List.of(question));

        AssessmentOption option = new AssessmentOption();
        option.setId(1L);
        option.setQuestion(question);
        option.setOptionCode("MALE");
        option.setOptionLabel("Male");
        option.setStatus(ConfigStatus.ACTIVE);
        when(options.findByQuestionIdInOrderBySortOrderAsc(any())).thenReturn(List.of(option));

        sync.apply(user(), Map.of("GENDER", textNode("MALE")), null);

        assertThat(profile.getGender()).isEqualTo("Male");
    }

    @Test
    @DisplayName("apply: ho so chua ton tai -> tao moi")
    void applyCreatesProfileWhenMissing() {
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.empty());

        var result = sync.apply(user(), Map.of(), null);

        assertThat(result).isPresent();
        verify(profiles).save(any(MemberProfile.class));
    }

    @Test
    @DisplayName("apply: cau tra loi null -> khong loi")
    void applyHandlesNullAnswers() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));

        sync.apply(user(), null, null);

        verify(profiles).save(profile);
    }
}
