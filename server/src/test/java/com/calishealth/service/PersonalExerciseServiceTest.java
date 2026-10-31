package com.calishealth.service;

import com.calishealth.dtos.CreatePersonalExerciseRequestDTO;
import com.calishealth.models.Exercise;
import com.calishealth.models.User;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PersonalExerciseServiceTest {
    @TempDir
    Path temporaryDirectory;

    private ExerciseRepository exercises;
    private UserRepository users;
    private PersonalExerciseService service;

    @BeforeEach
    void setUp() {
        exercises = mock(ExerciseRepository.class);
        users = mock(UserRepository.class);
        ExerciseVideoStorageService videoStorage = new ExerciseVideoStorageService(
                temporaryDirectory.resolve("videos").toString(),
                temporaryDirectory.resolve("anatomy").toString());
        service = new PersonalExerciseService(exercises, users, new ContentModerationService(), videoStorage);
        User member = new User();
        member.setId(7L);
        member.setEmail("member@example.com");
        when(users.findByEmail("member@example.com")).thenReturn(Optional.of(member));
        when(exercises.save(any(Exercise.class))).thenAnswer(invocation -> {
            Exercise saved = invocation.getArgument(0);
            saved.setId(31L);
            saved.setCreatedAt(LocalDateTime.now());
            saved.setUpdatedAt(LocalDateTime.now());
            return saved;
        });
    }

    @Test
    void createsValidSubmissionAsPendingAndStoresVideo() {
        var response = service.createPersonalExercise(
                "member@example.com", request("Tempo push-up"), validMp4(), validPng());

        assertThat(response.id()).isEqualTo(31L);
        assertThat(response.status()).isEqualTo("PENDING");
        assertThat(response.rejectionReason()).isNull();
        assertThat(response.guideSteps()).containsExactly("Brace your core", "Lower with control");
        assertThat(response.videoUrl()).startsWith("/media/exercise-demos/");
        assertThat(response.anatomyImageUrl()).startsWith("/media/exercise-anatomy/");

        var captor = org.mockito.ArgumentCaptor.forClass(Exercise.class);
        verify(exercises).save(captor.capture());
        Exercise saved = captor.getValue();
        assertThat(saved.isSystem()).isFalse();
        assertThat(saved.getAuthor().getId()).isEqualTo(7L);
        assertThat(saved.getAnatomyImageUrl()).isEqualTo(response.anatomyImageUrl());
        assertThat(saved.isShareWithCommunity()).isFalse();
    }

    @Test
    void blocksProfanityBeforeCreatingOrStoringExercise() {
        assertThatThrownBy(() -> service.createPersonalExercise(
                "member@example.com", request("Stupid push-up"), validMp4()))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
                .hasMessageContaining("Exercise content contains inappropriate language");
        verify(exercises, never()).save(any(Exercise.class));
    }

    @Test
    void screensGuideInstructionsAndTargetMuscleText() {
        ContentModerationService moderation = new ContentModerationService();

        assertThat(moderation.checkText("Squat", "Controlled movement", List.of("Move slowly"), "Legs"))
                .isNull();
        assertThat(moderation.checkText("Classic squat", "Build muscle", List.of("Use proper form"), "Legs"))
                .isNull();
        assertThat(moderation.checkText("Squat", "Pass through the assigned class", List.of(), "Legs"))
                .isNull();
        assertThat(moderation.checkText("Assisted squat", "Controlled movement", List.of(), "Legs"))
                .isNull();
        assertThat(moderation.checkText("Squat", "This is an ass.", List.of(), "Legs"))
                .contains("Exercise content contains inappropriate language");
        assertThat(moderation.checkText("Squat", "Controlled movement", List.of("ASS"), "Legs"))
                .contains("Exercise content contains inappropriate language");
        assertThat(moderation.checkText("Squat", "Controlled movement", List.of("Đồ khốn"), "Legs"))
                .contains("Exercise content contains inappropriate language");
        assertThat(moderation.checkText("Squat", "Controlled movement", List.of("Move slowly"), "fuck"))
                .contains("Exercise content contains inappropriate language");
    }

    @Test
    void resubmitsWithCurrentVideoAndSendsExerciseToPendingReview() {
        User member = new User();
        member.setId(7L);
        Exercise rejected = new Exercise();
        rejected.setId(31L);
        rejected.setAuthor(member);
        rejected.setSystem(false);
        rejected.setName("Wall sit challenge");
        rejected.setDescription("A wall sit exercise.");
        rejected.setType(Exercise.EntryType.HEALTH);
        rejected.setLevel(Exercise.EntryLevel.BEGINNER);
        rejected.setMuscleGroup("Legs");
        rejected.setStatus(Exercise.EntryStatus.REJECTED);
        rejected.setRejectionReason("Previous reason");
        rejected.setVideoUrl("/media/exercise-demos/current.mp4");
        when(exercises.findByIdAndAuthor_IdAndSystemFalse(31L, 7L)).thenReturn(Optional.of(rejected));

        var response = service.resubmitPersonalExercise(
                "member@example.com",
                31L,
                new CreatePersonalExerciseRequestDTO(
                        "Wall sit challenge",
                        "A wall sit exercise.",
                        Exercise.EntryLevel.BEGINNER,
                        List.of("Brace your core", "Hold the squat"),
                        "Legs",
                        3,
                        null,
                        60,
                        true,
                        true,
                        null,
                        null,
                        null,
                        null),
                null);

        assertThat(response.status()).isEqualTo("PENDING");
        assertThat(response.rejectionReason()).isNull();
        assertThat(response.videoUrl()).isEqualTo("/media/exercise-demos/current.mp4");
        verify(exercises).save(rejected);
    }

    @Test
    void editsAcceptedExerciseAndKeepsItApprovedWhenContentPasses() {
        User member = new User();
        member.setId(7L);
        Exercise accepted = new Exercise();
        accepted.setId(31L);
        accepted.setAuthor(member);
        accepted.setSystem(false);
        accepted.setName("Wall sit challenge");
        accepted.setDescription("A wall sit exercise.");
        accepted.setType(Exercise.EntryType.HEALTH);
        accepted.setLevel(Exercise.EntryLevel.BEGINNER);
        accepted.setMuscleGroup("Legs");
        accepted.setStatus(Exercise.EntryStatus.ACCEPTED);
        accepted.setVideoUrl("/media/exercise-demos/current.mp4");
        when(exercises.findByIdAndAuthor_IdAndSystemFalse(31L, 7L)).thenReturn(Optional.of(accepted));

        var response = service.updateAcceptedPersonalExercise(
                "member@example.com",
                31L,
                new CreatePersonalExerciseRequestDTO(
                        "Wall sit challenge",
                        "A wall sit exercise.",
                        Exercise.EntryLevel.BEGINNER,
                        List.of("Brace your core", "Hold the squat"),
                        "Legs",
                        1,
                        null,
                        60,
                        true,
                        true,
                        null,
                        null,
                        null,
                        null),
                null);

        assertThat(response.status()).isEqualTo("ACCEPTED");
        assertThat(accepted.isActive()).isTrue();
        assertThat(response.rejectionReason()).isNull();
        assertThat(response.videoUrl()).isEqualTo("/media/exercise-demos/current.mp4");
        verify(exercises).save(accepted);
    }

    @Test
    void rejectsResubmissionWithoutCurrentOrNewVideo() {
        User member = new User();
        member.setId(7L);
        Exercise rejected = new Exercise();
        rejected.setId(31L);
        rejected.setAuthor(member);
        rejected.setSystem(false);
        rejected.setType(Exercise.EntryType.HEALTH);
        rejected.setStatus(Exercise.EntryStatus.REJECTED);
        when(exercises.findByIdAndAuthor_IdAndSystemFalse(31L, 7L)).thenReturn(Optional.of(rejected));

        var response = service.resubmitPersonalExercise(
                "member@example.com",
                31L,
                new CreatePersonalExerciseRequestDTO(
                        "Wall sit",
                        "A wall sit exercise.",
                        Exercise.EntryLevel.BEGINNER,
                        List.of("Brace your core"),
                        "Legs",
                        3,
                        null,
                        60,
                        false,
                        false,
                        null,
                        null,
                        null,
                        null),
                null);

        assertThat(response.status()).isEqualTo("REJECTED");
        assertThat(response.rejectionReason()).contains("Video check");
    }

    private CreatePersonalExerciseRequestDTO request(String title) {
        return new CreatePersonalExerciseRequestDTO(
                title,
                "A controlled bodyweight movement.",
                Exercise.EntryLevel.BEGINNER,
                List.of("Brace your core", "Lower with control"),
                "Chest",
                3,
                10,
                null,
                false,
                null,
                null,
                null,
                null,
                null);
    }

    private MockMultipartFile validMp4() {
        byte[] bytes = new byte[] {
                0, 0, 0, 24, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm', 0, 0, 0, 0
        };
        return new MockMultipartFile("videoFile", "exercise.mp4", "video/mp4", bytes);
    }

    private MockMultipartFile validPng() {
        return new MockMultipartFile(
                "anatomyImageFile",
                "anatomy.png",
                "image/png",
                new byte[]{1, 2, 3});
    }
}
