package com.calishealth.service;

import com.calishealth.dtos.ContentTextCheckRequestDTO;
import com.calishealth.dtos.CreatePersonalExerciseRequestDTO;
import com.calishealth.dtos.PageResponseDTO;
import com.calishealth.dtos.PersonalExerciseResponseDTO;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.models.Exercise;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.User;
import com.calishealth.repository.ExerciseModerationHistoryRepository;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test cho {@link PersonalExerciseService}: vong doi doi bai tap ca nhan,
 * duyet moderation, dem submission va bao ve IDOR.
 */
class PersonalExerciseServiceTest {

    private ExerciseRepository exercises;
    private ExerciseModerationHistoryRepository moderationHistory;
    private UserRepository users;
    private FitnessLevelRepository fitnessLevels;
    private ContentModerationService moderation;
    private ExerciseVideoStorageService videoStorage;
    private MediaRegistryService mediaRegistry;
    private ExerciseMuscleGroupCatalog muscleGroupCatalog;
    private SystemNotificationService systemNotifications;
    private ContentNameGuardService contentNameGuard;
    private PersonalExerciseService service;

    private static final String EMAIL = "member@calishealth.vn";

    @BeforeEach
    void setUp() {
        exercises = mock(ExerciseRepository.class);
        moderationHistory = mock(ExerciseModerationHistoryRepository.class);
        users = mock(UserRepository.class);
        fitnessLevels = mock(FitnessLevelRepository.class);
        moderation = mock(ContentModerationService.class);
        videoStorage = mock(ExerciseVideoStorageService.class);
        mediaRegistry = mock(MediaRegistryService.class);
        muscleGroupCatalog = mock(ExerciseMuscleGroupCatalog.class);
        systemNotifications = mock(SystemNotificationService.class);
        contentNameGuard = mock(ContentNameGuardService.class);
        service = new PersonalExerciseService(
                exercises, moderationHistory, users, fitnessLevels, moderation, videoStorage,
                mediaRegistry, muscleGroupCatalog, systemNotifications, contentNameGuard,
                mock(FormRuleAdminService.class));

        User member = new User();
        member.setId(7L);
        member.setEmail(EMAIL);
        member.setFullName("Member One");
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));

        FitnessLevel level = new FitnessLevel();
        level.setId(1L);
        level.setName("Beginner");
        level.setStatus("ACTIVE");
        lenient().when(fitnessLevels.findByNameIgnoreCase(anyString())).thenReturn(Optional.of(level));

        lenient().when(moderation.checkText(anyString(), any(), any(), any())).thenReturn(null);
        lenient().when(moderation.checkVideo(any())).thenReturn(null);
        lenient().when(moderation.combine(any(), any()))
                .thenReturn(new ContentModerationService.ModerationResult(true, null));
    }

    private CreatePersonalExerciseRequestDTO request(String level) {
        return new CreatePersonalExerciseRequestDTO(
                "  Push Up  ", "desc", level, List.of("step one", "step two"), "Chest",
                3, 10, null, true, false, "reps_sets", null, null, null);
    }

    private Exercise exercise(Long id, String status) {
        Exercise exercise = new Exercise();
        exercise.setId(id);
        exercise.setCode("CU_" + id);
        exercise.setName("Push Up");
        exercise.setDescription("desc");
        exercise.setLevel("Beginner");
        exercise.setGuideSteps("step one\nstep two");
        exercise.setStatus(status);
        exercise.setType(Exercise.EntryType.HEALTH);
        exercise.setMuscleGroup("Chest");
        exercise.setDefaultSets(3);
        exercise.setDefaultReps(10);
        exercise.setVideoUrl("https://video/a.mp4");
        exercise.setAnatomyImageUrl("https://img/a.png");
        return exercise;
    }

    @Test
    @DisplayName("checkText: tra ve danh sach tu cam")
    void checkTextReturnsFlaggedWords() {
        when(moderation.findFlaggedWords("t", "d", List.of("s"), "m")).thenReturn(List.of("bad"));

        var response = service.checkText(new ContentTextCheckRequestDTO("t", "d", List.of("s"), "m"));

        assertThat(response.flaggedWords()).containsExactly("bad");
    }

    @Test
    @DisplayName("create: level rong -> truong bat buoc")
    void createRejectsBlankLevel() {
        assertThatThrownBy(() -> service.createPersonalExercise(EMAIL, request("  "), null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("create: khong tim thay member -> 401")
    void createRejectsUnknownMember() {
        when(users.findByEmail("ghost@x.vn")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createPersonalExercise("ghost@x.vn", request("Beginner"), null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    @DisplayName("create: text bi chan -> nem 400")
    void createRejectsFlaggedText() {
        when(moderation.checkText(anyString(), any(), any(), any())).thenReturn("bad words");

        assertThatThrownBy(() -> service.createPersonalExercise(EMAIL, request("Beginner"), null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("create: video bi chan -> luu o trang thai REJECTED")
    void createStoresRejectedExercise() {
        MultipartFile video = new MockMultipartFile("video", "a.mp4", "video/mp4", new byte[]{1});
        when(videoStorage.store(any(), anyString())).thenReturn("https://video/a.mp4");
        when(moderation.combine(any(), any()))
                .thenReturn(new ContentModerationService.ModerationResult(false, "video bad"));
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> {
            Exercise e = inv.getArgument(0);
            e.setId(11L);
            return e;
        });

        PersonalExerciseResponseDTO response = service.createPersonalExercise(EMAIL, request("Beginner"), video);

        assertThat(response.status()).isEqualTo(Exercise.EntryStatus.REJECTED.name());
        assertThat(response.rejectionReason()).isEqualTo("video bad");        verify(moderationHistory).insert(anyString(), anyString(), any(), any(), any(), any(),
                any(), any(), any(), any(), anyString(), eq("REJECTED"), eq("video bad"));
    }

    @Test
    @DisplayName("create: thanh cong -> PENDING va thong bao content manager")
    void createStoresPendingExercise() {
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> {
            Exercise e = inv.getArgument(0);
            e.setId(12L);
            return e;
        });

        PersonalExerciseResponseDTO response = service.createPersonalExercise(EMAIL, request("Beginner"), null);

        assertThat(response.status()).isEqualTo(Exercise.EntryStatus.PENDING.name());
        assertThat(response.title()).isEqualTo("Push Up");
        assertThat(response.level()).isEqualTo("Beginner");
        assertThat(response.guideSteps()).containsExactly("step one", "step two");
        verify(systemNotifications).notifyContentManagersPendingApproval("Push Up");
        verify(moderationHistory, never()).insert(anyString(), anyString(), any(), any(), any(), any(),
                any(), any(), any(), any(), any(), anyString(), anyString());
    }

    @Test
    @DisplayName("create: sets/reps khong hop le -> nem 400")
    void createRejectsInvalidSetsAndReps() {
        CreatePersonalExerciseRequestDTO bad = new CreatePersonalExerciseRequestDTO(
                "Push Up", "desc", "Beginner", List.of("s"), "Chest",
                null, null, null, true, false, "reps_sets", null, 0, null);

        assertThatThrownBy(() -> service.createPersonalExercise(EMAIL, bad, null))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Sets and reps");
    }

    @Test
    @DisplayName("create: duration khong hop le -> nem 400")
    void createRejectsInvalidDuration() {
        CreatePersonalExerciseRequestDTO bad = new CreatePersonalExerciseRequestDTO(
                "Push Up", "desc", "Beginner", List.of("s"), "Chest",
                null, null, null, true, false, "duration", null, null, 5000);

        assertThatThrownBy(() -> service.createPersonalExercise(EMAIL, bad, null))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Duration must be");
    }

    @Test
    @DisplayName("create: countType null -> suy ra tu defaultDuration/defaultReps")
    void createInfersCountType() {
        CreatePersonalExerciseRequestDTO inferred = new CreatePersonalExerciseRequestDTO(
                "Push Up", null, "Beginner", List.of("s"), "Chest",
                null, null, 45, true, false, null, null, null, null);
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> {
            Exercise e = inv.getArgument(0);
            e.setId(13L);
            return e;
        });

        PersonalExerciseResponseDTO response = service.createPersonalExercise(EMAIL, inferred, null);

        assertThat(response.defaultDuration()).isEqualTo(45);
        assertThat(response.defaultSets()).isEqualTo(1);
    }

    @Test
    @DisplayName("create: level dang INACTIVE -> nem 400")
    void createRejectsInactiveLevel() {
        FitnessLevel inactive = new FitnessLevel();
        inactive.setName("Beginner");
        inactive.setStatus("INACTIVE");
        when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(inactive));

        assertThatThrownBy(() -> service.createPersonalExercise(EMAIL, request("Beginner"), null))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("is inactive");
    }

    @Test
    @DisplayName("create: video da upload nhung save that bai -> release media")
    void createReleasesMediaOnFailure() {
        when(videoStorage.store(any(), anyString())).thenReturn("https://video/a.mp4");
        when(exercises.save(any(Exercise.class))).thenThrow(new RuntimeException("db down"));

        assertThatThrownBy(() -> service.createPersonalExercise(EMAIL, request("Beginner"),
                new MockMultipartFile("v", "a.mp4", "video/mp4", new byte[]{1})))
                .isInstanceOf(RuntimeException.class);
        verify(mediaRegistry).release("https://video/a.mp4", "Upload not saved");
    }

    @Test
    @DisplayName("getMemberSubmissions: status null -> nem 400")
    void submissionsRequireStatus() {
        assertThatThrownBy(() -> service.getMemberSubmissions(EMAIL, null, null, null, 0, 10))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Submission status is required");
    }

    @Test
    @DisplayName("getMemberSubmissions: page/size sai -> nem 400")
    void submissionsValidatePaging() {
        assertThatThrownBy(() -> service.getMemberSubmissions(
                EMAIL, Exercise.EntryStatus.PENDING, null, null, -1, 10))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.getMemberSubmissions(
                EMAIL, Exercise.EntryStatus.PENDING, null, null, 0, 0))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("getMemberSubmissions: ban bi tu choi kem ly do")
    void submissionsIncludeRejectionReason() {
        Exercise rejected = exercise(21L, Exercise.EntryStatus.REJECTED.name());
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(rejected)));
        when(moderationHistory.findLatestRejectionReasons(anyCollection()))
                .thenReturn(Map.of("CU_21", "khong ro"));

        PageResponseDTO<PersonalExerciseResponseDTO> page =
                service.getMemberSubmissions(EMAIL, Exercise.EntryStatus.REJECTED, "push", "Beginner", 0, 10);

        assertThat(page.content()).hasSize(1);
        assertThat(page.content().get(0).rejectionReason()).isEqualTo("khong ro");
    }

    @Test
    @DisplayName("getSubmissionCounts: dem theo trang thai")
    void submissionCountsAreGrouped() {
        when(exercises.countByAuthorAndSourceAndModerationStatuses(anyLong(), eq("CUSTOM"), any()))
                .thenReturn(1L);

        var counts = service.getSubmissionCounts(EMAIL);

        assertThat(counts.pendingCount()).isEqualTo(1L);
        assertThat(counts.rejectedCount()).isEqualTo(1L);
        assertThat(counts.acceptedCount()).isEqualTo(1L);
    }

    @Test
    @DisplayName("getPersonalExercise: bai khong thuoc ve member -> 404")
    void personalExerciseEnforcesOwnership() {
        when(exercises.findByIdAndCreatedBy_IdAndSource(99L, 7L, "CUSTOM")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getPersonalExercise(EMAIL, 99L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getPersonalExercise: bai bi tu choi -> kem ly do")
    void personalExerciseReturnsRejectionReason() {
        Exercise rejected = exercise(22L, Exercise.EntryStatus.REJECTED.name());
        when(exercises.findByIdAndCreatedBy_IdAndSource(22L, 7L, "CUSTOM")).thenReturn(Optional.of(rejected));
        when(moderationHistory.findLatestRejectionReasons(anyCollection()))
                .thenReturn(Map.of("CU_22", "ly do"));

        assertThat(service.getPersonalExercise(EMAIL, 22L).rejectionReason()).isEqualTo("ly do");
    }

    @Test
    @DisplayName("resubmit: bai chua bi tu choi -> nem 409")
    void resubmitRejectsNonRejected() {
        when(exercises.findByIdAndCreatedBy_IdAndSource(23L, 7L, "CUSTOM"))
                .thenReturn(Optional.of(exercise(23L, Exercise.EntryStatus.ACCEPTED.name())));

        assertThatThrownBy(() -> service.resubmitPersonalExercise(EMAIL, 23L, request("Beginner"), null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("resubmit: giu video cu -> PENDING")
    void resubmitKeepsCurrentVideo() {
        Exercise rejected = exercise(24L, Exercise.EntryStatus.REJECTED.name());
        when(exercises.findByIdAndCreatedBy_IdAndSource(24L, 7L, "CUSTOM")).thenReturn(Optional.of(rejected));
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> inv.getArgument(0));

        CreatePersonalExerciseRequestDTO keep = new CreatePersonalExerciseRequestDTO(
                "Push Up", "desc", "Beginner", List.of("s"), "Chest",
                3, 10, null, true, true, "reps_sets", null, null, null);

        PersonalExerciseResponseDTO response = service.resubmitPersonalExercise(EMAIL, 24L, keep, null);

        assertThat(response.status()).isEqualTo(Exercise.EntryStatus.PENDING.name());
        verify(videoStorage, never()).store(any(), anyString());
    }

    @Test
    @DisplayName("resubmit: khong co video va khong giu -> bi tu choi")
    void resubmitWithoutVideoIsRejected() {
        Exercise rejected = exercise(25L, Exercise.EntryStatus.REJECTED.name());
        when(exercises.findByIdAndCreatedBy_IdAndSource(25L, 7L, "CUSTOM")).thenReturn(Optional.of(rejected));
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> inv.getArgument(0));

        PersonalExerciseResponseDTO response = service.resubmitPersonalExercise(EMAIL, 25L, request("Beginner"), null);

        assertThat(response.status()).isEqualTo(Exercise.EntryStatus.REJECTED.name());
        assertThat(response.rejectionReason()).contains("Video check");
    }

    @Test
    @DisplayName("resubmit: video moi -> release video cu")
    void resubmitReplacesVideo() {
        Exercise rejected = exercise(26L, Exercise.EntryStatus.REJECTED.name());
        when(exercises.findByIdAndCreatedBy_IdAndSource(26L, 7L, "CUSTOM")).thenReturn(Optional.of(rejected));
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> inv.getArgument(0));
        when(videoStorage.store(any(), anyString())).thenReturn("https://video/new.mp4");

        service.resubmitPersonalExercise(EMAIL, 26L, request("Beginner"),
                new MockMultipartFile("v", "a.mp4", "video/mp4", new byte[]{1}));

        verify(mediaRegistry).release("https://video/a.mp4", "Replaced by a newer video");
    }

    @Test
    @DisplayName("resubmit: save that bai -> release media moi")
    void resubmitReleasesMediaOnFailure() {
        Exercise rejected = exercise(27L, Exercise.EntryStatus.REJECTED.name());
        when(exercises.findByIdAndCreatedBy_IdAndSource(27L, 7L, "CUSTOM")).thenReturn(Optional.of(rejected));
        when(exercises.save(any(Exercise.class))).thenThrow(new RuntimeException("db down"));
        when(videoStorage.store(any(), anyString())).thenReturn("https://video/new.mp4");

        assertThatThrownBy(() -> service.resubmitPersonalExercise(EMAIL, 27L, request("Beginner"),
                new MockMultipartFile("v", "a.mp4", "video/mp4", new byte[]{1})))
                .isInstanceOf(RuntimeException.class);
        verify(mediaRegistry).release("https://video/new.mp4", "Upload not saved");
    }

    @Test
    @DisplayName("updateAccepted: bai chua duyet -> nem 409")
    void updateAcceptedRejectsNonAccepted() {
        when(exercises.findByIdAndCreatedBy_IdAndSource(28L, 7L, "CUSTOM"))
                .thenReturn(Optional.of(exercise(28L, Exercise.EntryStatus.PENDING.name())));

        assertThatThrownBy(() -> service.updateAcceptedPersonalExercise(EMAIL, 28L, request("Beginner"), null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("updateAccepted: thanh cong -> giu trang thai ACCEPTED")
    void updateAcceptedKeepsAcceptedStatus() {
        Exercise accepted = exercise(29L, Exercise.EntryStatus.ACCEPTED.name());
        when(exercises.findByIdAndCreatedBy_IdAndSource(29L, 7L, "CUSTOM")).thenReturn(Optional.of(accepted));
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> inv.getArgument(0));

        PersonalExerciseResponseDTO response =
                service.updateAcceptedPersonalExercise(EMAIL, 29L, request("Beginner"), null);

        assertThat(response.status()).isEqualTo(Exercise.EntryStatus.ACCEPTED.name());
        verify(systemNotifications, never()).notifyContentManagersPendingApproval(anyString());
    }

    @Test
    @DisplayName("updateAccepted: video moi -> release video cu")
    void updateAcceptedReplacesVideo() {
        Exercise accepted = exercise(30L, Exercise.EntryStatus.ACCEPTED.name());
        when(exercises.findByIdAndCreatedBy_IdAndSource(30L, 7L, "CUSTOM")).thenReturn(Optional.of(accepted));
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> inv.getArgument(0));
        when(videoStorage.store(any(), anyString())).thenReturn("https://video/new.mp4");

        service.updateAcceptedPersonalExercise(EMAIL, 30L, request("Beginner"),
                new MockMultipartFile("v", "a.mp4", "video/mp4", new byte[]{1}));

        verify(mediaRegistry).release("https://video/a.mp4", "Replaced by a newer video");
    }

    @Test
    @DisplayName("updateAccepted: save that bai -> release media moi")
    void updateAcceptedReleasesMediaOnFailure() {
        Exercise accepted = exercise(31L, Exercise.EntryStatus.ACCEPTED.name());
        when(exercises.findByIdAndCreatedBy_IdAndSource(31L, 7L, "CUSTOM")).thenReturn(Optional.of(accepted));
        when(exercises.save(any(Exercise.class))).thenThrow(new RuntimeException("db down"));
        when(videoStorage.store(any(), anyString())).thenReturn("https://video/new.mp4");

        assertThatThrownBy(() -> service.updateAcceptedPersonalExercise(EMAIL, 31L, request("Beginner"),
                new MockMultipartFile("v", "a.mp4", "video/mp4", new byte[]{1})))
                .isInstanceOf(RuntimeException.class);
        verify(mediaRegistry).release("https://video/new.mp4", "Upload not saved");
    }

    @Test
    @DisplayName("delete: xoa bai va release media")
    void deleteReleasesMedia() {
        Exercise exercise = exercise(32L, Exercise.EntryStatus.ACCEPTED.name());
        when(exercises.findByIdAndCreatedBy_IdAndSource(32L, 7L, "CUSTOM")).thenReturn(Optional.of(exercise));

        service.deletePersonalExercise(EMAIL, 32L);

        verify(exercises).delete(exercise);
        verify(mediaRegistry).release("https://video/a.mp4", "Exercise was deleted");
        verify(mediaRegistry).release("https://img/a.png", "Exercise was deleted");
    }

    @Test
    @DisplayName("delete: bai khong ton tai -> 404")
    void deleteThrowsWhenMissing() {
        when(exercises.findByIdAndCreatedBy_IdAndSource(33L, 7L, "CUSTOM")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deletePersonalExercise(EMAIL, 33L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("create: anatomy image duoc luu va gan vao bai")
    void createStoresAnatomyImage() {
        when(videoStorage.storeAnatomyImage(any(), anyString())).thenReturn("https://img/new.png");
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> {
            Exercise e = inv.getArgument(0);
            e.setId(34L);
            return e;
        });

        PersonalExerciseResponseDTO response = service.createPersonalExercise(
                EMAIL, request("Beginner"), null,
                new MockMultipartFile("img", "a.png", "image/png", new byte[]{1}));

        assertThat(response.anatomyImageUrl()).isEqualTo("https://img/new.png");
    }

    @Test
    @DisplayName("create: gan nhom co co the bi gan")
    void createAssignsMuscleGroup() {
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> {
            Exercise e = inv.getArgument(0);
            e.setId(35L);
            return e;
        });

        service.createPersonalExercise(EMAIL, request("Beginner"), null);

        ArgumentCaptor<Exercise> captor = ArgumentCaptor.forClass(Exercise.class);
        verify(muscleGroupCatalog).assign(captor.capture(), eq("Chest"));
        assertThat(captor.getValue().getCategory()).isEqualTo("REPS");
    }
}
