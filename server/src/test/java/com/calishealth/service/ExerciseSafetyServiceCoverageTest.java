package com.calishealth.service;

import com.calishealth.dtos.ExercisePhysiologyDTO;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bộ test cho {@link ExerciseSafetyService}: nhận diện chống chỉ định và dịch tên hiển thị.
 */
class ExerciseSafetyServiceCoverageTest {

    private final ExerciseSafetyService service = new ExerciseSafetyService();

    private static ExercisePhysiologyDTO profile(List<String> contraindications) {
        return new ExercisePhysiologyDTO(
                "CONCENTRIC", 3, 2, 90, 130, "none", "LOW", "LOW", 5, "KNEE", "Exhale",
                contraindications, "note");
    }

    @Test
    @DisplayName("Chong chi dinh: hoi ve cao huyet ap -> khop")
    void matchesHypertensionKeyword() {
        List<String> matched = service.matchedContraindications(
                profile(List.of("hypertension")), "I have high blood pressure, is this safe?");

        assertThat(matched).containsExactly("cao huyết áp");
    }

    @Test
    @DisplayName("Chong chi dinh: hoi ve co that -> khop")
    void matchesPregnancyKeyword() {
        List<String> matched = service.matchedContraindications(
                profile(List.of("pregnancy")), "Tôi đang mang thai, có tập được không?");

        assertThat(matched).containsExactly("có thai");
    }

    @Test
    @DisplayName("Chong chi dinh: ma la khong -> dung ten goc")
    void keepsCustomConditionName() {
        List<String> matched = service.matchedContraindications(
                profile(List.of("recent_surgery")), "I had a recent surgery last week");

        assertThat(matched).containsExactly("recent_surgery");
    }

    @Test
    @DisplayName("Chong chi dinh: khong co ho so -> danh sach rong")
    void returnsEmptyWithoutProfile() {
        assertThat(service.matchedContraindications(null, "anything")).isEmpty();
    }

    @Test
    @DisplayName("Chong chi dinh: cau hoi rong -> danh sach rong")
    void returnsEmptyForBlankQuestion() {
        assertThat(service.matchedContraindications(profile(List.of("hypertension")), "  ")).isEmpty();
        assertThat(service.matchedContraindications(profile(List.of("hypertension")), null)).isEmpty();
    }

    @Test
    @DisplayName("Chong chi dinh: khong co danh sach -> danh sach rong")
    void returnsEmptyWithoutContraindications() {
        assertThat(service.matchedContraindications(profile(null), "high blood pressure")).isEmpty();
        assertThat(service.matchedContraindications(profile(List.of()), "high blood pressure")).isEmpty();
    }

    @Test
    @DisplayName("Chong chi dinh: bo qua muc rong trong danh sach")
    void skipsBlankContraindicationEntries() {
        List<String> matched = service.matchedContraindications(
                profile(java.util.Arrays.asList("  ", null, "asthma")), "I have asthma");

        assertThat(matched).containsExactly("hen suyễn");
    }

    @Test
    @DisplayName("Chong chi dinh: nhieu dieu kien khop -> tra ve tat ca")
    void matchesMultipleConditions() {
        List<String> matched = service.matchedContraindications(
                profile(List.of("knee_pain", "lower_back_pain")),
                "My knee pain and lower back pain both act up");

        assertThat(matched).hasSize(2);
    }

    @Test
    @DisplayName("Chong chi dinh: khong khop dieu kien nao -> danh sach rong")
    void returnsEmptyWhenNothingMatches() {
        List<String> matched = service.matchedContraindications(
                profile(List.of("hypertension", "asthma")), "How do I warm up?");

        assertThat(matched).isEmpty();
    }

    @Test
    @DisplayName("Ten hien thi: dich cac ma benh sang tieng Viet")
    void translatesConditionCodes() {
        assertThat(service.matchedContraindications(profile(List.of("glaucoma")), "I have glaucoma"))
                .containsExactly("bệnh glaucom");
        assertThat(service.matchedContraindications(profile(List.of("osteoporosis")), "osteoporosis issue"))
                .containsExactly("loãng xương");
        assertThat(service.matchedContraindications(profile(List.of("cardiac_condition")), "heart condition"))
                .containsExactly("bệnh tim mạch");
        assertThat(service.matchedContraindications(profile(List.of("wrist_pain")), "wrist pain"))
                .containsExactly("đau cổ tay");
        assertThat(service.matchedContraindications(profile(List.of("elbow_pain")), "elbow pain"))
                .containsExactly("đau khuỷu tay");
        assertThat(service.matchedContraindications(profile(List.of("shoulder_pain")), "shoulder pain"))
                .containsExactly("đau vai");
        assertThat(service.matchedContraindications(profile(List.of("shoulder_impingement")), "impingement"))
                .containsExactly("chèn vai");
        assertThat(service.matchedContraindications(profile(List.of("knee_pain")), "knee pain"))
                .containsExactly("đau gối");
        assertThat(service.matchedContraindications(profile(List.of("lower_back_pain")), "back pain"))
                .containsExactly("đau lưng");
    }

    @Test
    @DisplayName("Red flag: cau hoi ve dau chan -> canh bao")
    void detectsMedicalRedFlags() {
        assertThat(service.redFlagMessage("I have sharp chest pain right now")).isNotNull();
    }

    @Test
    @DisplayName("Red flag: cau hoi binh thuong -> khong canh bao")
    void ignoresNormalQuestions() {
        assertThat(service.redFlagMessage("How do I warm up before a workout?")).isNull();
    }
}
