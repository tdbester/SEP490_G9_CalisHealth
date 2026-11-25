package com.calishealth.service;

import com.calishealth.models.Exercise;
import com.calishealth.models.MemberProfile;
import com.calishealth.repository.MemberProfileRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bo sung coverage cho cac nhanh phong bien chua chay:
 * {@link ProfileService#normaliseGender}, {@link ExerciseMuscleGroupCatalog},
 * {@link ExerciseTreeService}, {@link MemberFitnessLevelService} va
 * {@link ContentModerationService}.
 */
class ServiceValidationBranchGapTest {

    // ------------------------------------------------------------- ProfileService

    @Test
    @DisplayName("normaliseGender: ma MALE -> Male")
    void normaliseGenderMapsMaleCode() {
        assertThat(ProfileService.normaliseGender("MALE")).isEqualTo("Male");
    }

    @Test
    @DisplayName("normaliseGender: ma FEMALE -> Female")
    void normaliseGenderMapsFemaleCode() {
        assertThat(ProfileService.normaliseGender("FEMALE")).isEqualTo("Female");
    }

    @Test
    @DisplayName("normaliseGender: ma OTHER -> Other")
    void normaliseGenderMapsOtherCode() {
        assertThat(ProfileService.normaliseGender("OTHER")).isEqualTo("Other");
    }

    @Test
    @DisplayName("normaliseGender: chuoi rong -> null")
    void normaliseGenderReturnsNullForBlank() {
        assertThat(ProfileService.normaliseGender("   ")).isNull();
        assertThat(ProfileService.normaliseGender(null)).isNull();
    }

    @Test
    @DisplayName("normaliseGender: nhan hien thi -> giu nguyen")
    void normaliseGenderKeepsDisplayLabel() {
        assertThat(ProfileService.normaliseGender("Prefer not to say")).isEqualTo("Prefer not to say");
        assertThat(ProfileService.normaliseGender("Other / prefer not to say")).isEqualTo("Other");
    }

    // --------------------------------------------------- ExerciseMuscleGroupCatalog

    @Test
    @DisplayName("assign: danh sach rong -> 400")
    void muscleGroupCatalogRejectsEmptyList() {
        ExerciseMuscleGroupCatalog catalog = new ExerciseMuscleGroupCatalog(
                mock(com.calishealth.repository.MuscleGroupRepository.class));

        assertThatThrownBy(() -> catalog.assign(new Exercise(), "  "))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    // ------------------------------------------------------- MemberFitnessLevelService

    @Test
    @DisplayName("changeLevel: profile null -> bo qua")
    void changeLevelIgnoresNullProfile() {
        MemberFitnessLevelService service = new MemberFitnessLevelService(
                mock(MemberProfileRepository.class), mock(ApplicationEventPublisher.class));

        assertThatCode(() -> service.changeLevel(null, null)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("changeLevel: level null -> bo qua")
    void changeLevelIgnoresNullLevel() {
        MemberFitnessLevelService service = new MemberFitnessLevelService(
                mock(MemberProfileRepository.class), mock(ApplicationEventPublisher.class));

        assertThatCode(() -> service.changeLevel(new MemberProfile(), null)).doesNotThrowAnyException();
    }

    // ------------------------------------------------------- ContentModerationService

    @Test
    @DisplayName("checkVideo: video khong doc duoc -> tu choi")
    void checkVideoRejectsUnreadableFile() throws Exception {
        ContentModerationService service = new ContentModerationService(
                mock(com.calishealth.repository.ProfanityWordRepository.class));

        MultipartFile broken = mock(MultipartFile.class);
        when(broken.getSize()).thenReturn(10L);
        when(broken.getInputStream()).thenThrow(new IOException("boom"));

        assertThat(service.checkVideo(broken)).isNotNull();
    }

    @Test
    @DisplayName("checkVideo: video rong -> tu choi")
    void checkVideoRejectsEmptyFile() throws Exception {
        ContentModerationService service = new ContentModerationService(
                mock(com.calishealth.repository.ProfanityWordRepository.class));

        MultipartFile empty = new MockMultipartFile("file", "a.mp4", "video/mp4", new byte[0]);

        assertThat(service.checkVideo(empty)).isNotNull();
    }

    @Test
    @DisplayName("checkVideo: video hop le (ftyp) -> duyet")
    void checkVideoAcceptsValidMp4() throws Exception {
        ContentModerationService service = new ContentModerationService(
                mock(com.calishealth.repository.ProfanityWordRepository.class));

        byte[] header = new byte[]{0, 0, 0, 24, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm'};
        MultipartFile valid = new MockMultipartFile("file", "a.mp4", "video/mp4", header);

        assertThat(service.checkVideo(valid)).isNull();
    }
}
