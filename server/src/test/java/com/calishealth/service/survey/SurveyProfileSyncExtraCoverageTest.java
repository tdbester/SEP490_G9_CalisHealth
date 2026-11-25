package com.calishealth.service.survey;

import com.calishealth.models.AssessmentOption;
import com.calishealth.models.AssessmentQuestion;
import com.calishealth.models.ConfigStatus;
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

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bo sung coverage cho {@link SurveyProfileSync}: cac nhanh rong, gia tri khong phai so va
 * option khong ton tai trong ngan hang cau hoi.
 */
class SurveyProfileSyncExtraCoverageTest {

    private MemberProfileRepository profiles;
    private MemberTrackingRepository tracking;
    private AssessmentOptionRepository options;
    private AssessmentQuestionRepository questions;
    private SurveyProfileSync sync;

    @BeforeEach
    void setUp() {
        profiles = mock(MemberProfileRepository.class);
        tracking = mock(MemberTrackingRepository.class);
        options = mock(AssessmentOptionRepository.class);
        questions = mock(AssessmentQuestionRepository.class);
        sync = new SurveyProfileSync(profiles, tracking, options, questions, mock(MemberFitnessLevelService.class));
        lenient().when(profiles.save(any(MemberProfile.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(options.findByQuestionIdInOrderBySortOrderAsc(any())).thenReturn(List.of());
    }

    private static User user() {
        User user = new User();
        user.setId(3L);
        user.setEmail("member@example.test");
        return user;
    }

    private static MemberProfile profile() {
        MemberProfile profile = new MemberProfile();
        profile.setId(9L);
        profile.setUser(user());
        return profile;
    }

    @Test
    @DisplayName("apply: cau hoi co option nhung ngan hang rong -> dung chinh ma cau hoi")
    void missingOptionFallsBackToRawCode() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));
        when(questions.findByQuestionCodeIn(any())).thenReturn(List.of());

        sync.apply(user(), Map.of("GENDER", JsonNodeFactory.instance.textNode("MALE")), null);

        assertThat(profile.getGender()).isEqualTo("Male");
    }

    @Test
    @DisplayName("apply: option khong active -> bo qua nhan, dung ma cau hoi")
    void inactiveOptionIsIgnored() {
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
        option.setOptionLabel("Nam");
        option.setStatus(ConfigStatus.INACTIVE);
        when(options.findByQuestionIdInOrderBySortOrderAsc(any())).thenReturn(List.of(option));

        sync.apply(user(), Map.of("GENDER", JsonNodeFactory.instance.textNode("MALE")), null);

        // nhan tieng Viet "Nam" khong duoc dung -> van chuan hoa tu ma option "MALE".
        assertThat(profile.getGender()).isEqualTo("Male");
    }

    @Test
    @DisplayName("apply: gioi tinh khong phai chuoi -> bo qua")
    void nonTextualGenderIsIgnored() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));

        sync.apply(user(), Map.of("GENDER", JsonNodeFactory.instance.numberNode(1)), null);

        assertThat(profile.getGender()).isNull();
    }

    @Test
    @DisplayName("apply: chieu cao/can nang la boolean -> bo qua")
    void booleanMeasurementIsIgnored() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));

        sync.apply(user(), Map.of(
                "HEIGHT", JsonNodeFactory.instance.booleanNode(true),
                "WEIGHT", JsonNodeFactory.instance.booleanNode(false)), null);

        assertThat(profile.getHeight()).isNull();
        assertThat(profile.getWeight()).isNull();
    }

    @Test
    @DisplayName("apply: chieu cao la mang rong -> khong ghi")
    void arrayMeasurementIsIgnored() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));

        JsonNode array = JsonNodeFactory.instance.arrayNode().add(1).add(2);
        sync.apply(user(), Map.of("HEIGHT", array), null);

        assertThat(profile.getHeight()).isNull();
    }

    @Test
    @DisplayName("apply: muc tieu la so -> luu dang chuoi")
    void numericGoalIsStoredAsText() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));

        sync.apply(user(), Map.of("GOAL_TYPE", JsonNodeFactory.instance.numberNode(7)), null);

        assertThat(profile.getGoals()).isNotBlank();
    }

    @Test
    @DisplayName("apply: so buoi/tuan khong phai so -> bo qua")
    void nonNumericDaysPerWeekIsIgnored() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));

        sync.apply(user(), Map.of(
                "HOW_MANY_DAYS_PER_WEEK_DO_YOU_WANT_TO_TRAIN_WITH_CALISHE",
                JsonNodeFactory.instance.textNode("five")), null);

        assertThat(profile.getDaysPerWeek()).isEqualTo(3);
    }

    @Test
    @DisplayName("apply: tuoi khong phai so -> bo qua")
    void nonNumericAgeIsIgnored() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));

        sync.apply(user(), Map.of("AGE", JsonNodeFactory.instance.textNode("30")), null);

        assertThat(profile.getDateOfBirth()).isNull();
    }

    @Test
    @DisplayName("apply: khong co cau hoi nao khop -> khong goi repo options")
    void noMatchingQuestionsSkipsOptionLookup() {
        MemberProfile profile = profile();
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));
        when(questions.findByQuestionCodeIn(any())).thenReturn(List.of());

        sync.apply(user(), Map.of("GENDER", JsonNodeFactory.instance.textNode("MALE")), null);

        verify(options, org.mockito.Mockito.never()).findByQuestionIdInOrderBySortOrderAsc(any());
    }
}
