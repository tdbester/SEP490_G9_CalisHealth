package com.calishealth.service;

import com.calishealth.dtos.CreatePersonalExerciseRequestDTO;
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
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho {@link PersonalExerciseService}: nhánh video, ảnh giải phẫu và level.
 */
class PersonalExerciseServiceCoverageTest {

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
        lenient().when(videoStorage.store(any(), anyString())).thenAnswer(inv -> {
            MultipartFile file = inv.getArgument(0);
            return file == null || file.isEmpty() ? null : "https://video/new.mp4";
        });
        lenient().when(videoStorage.storeAnatomyImage(any(), anyString())).thenAnswer(inv -> {
            MultipartFile file = inv.getArgument(0);
            return file == null || file.isEmpty() ? null : "https://img/new.png";
        });
        lenient().when(exercises.save(any(Exercise.class))).thenAnswer(inv -> {
            Exercise saved = inv.getArgument(0);
            if (saved.getId() == null) {
                saved.setId(55L);
            }
            return saved;
        });
    }

    private CreatePersonalExerciseRequestDTO request(String countType) {
        return new CreatePersonalExerciseRequestDTO(
                "Push Up", "desc", "Beginner", List.of("step one"), "Chest",
                3, 10, null, true, false, countType, null, null, null);
    }

    private Exercise exercise(Long id, Exercise.EntryStatus status) {
        Exercise exercise = new Exercise();
        exercise.setId(id);
        exercise.setCode("CU_" + id);
        exercise.setName("Push Up");
        exercise.setDescription("desc");
        exercise.setLevel("Beginner");
        exercise.setGuideSteps("step one");
        exercise.setStatus(status);
        exercise.setType(Exercise.EntryType.HEALTH);
        exercise.setMuscleGroup("Chest");
        exercise.setDefaultSets(3);
        exercise.setDefaultReps(10);
        return exercise;
    }

    // -------------------------------------------------------------- create

    @Test
    @DisplayName("create: video hop le -> luu va luu video")
    void createStoresVideo() {
        MultipartFile video = new MockMultipartFile("v", "a.mp4", "video/mp4", new byte[]{1, 2, 3});
        when(videoStorage.store(any(MultipartFile.class), anyString())).thenReturn("https://video/new.mp4");

        var response = service.createPersonalExercise(EMAIL, request("reps_sets"), video);

        assertThat(response.videoUrl()).isEqualTo("https://video/new.mp4");
        verify(videoStorage).store(any(MultipartFile.class), eq(EMAIL));
    }

    @Test
    @DisplayName("create: video bi tu choi -> khong luu video")
    void createSkipsVideoWhenRejected() {
        MultipartFile video = new MockMultipartFile("v", "a.mp4", "video/mp4", new byte[]{1});
        when(moderation.checkVideo(any())).thenReturn("Video check failed");
        when(moderation.combine(any(), any()))
                .thenReturn(new ContentModerationService.ModerationResult(false, "Video check failed"));

        var response = service.createPersonalExercise(EMAIL, request("reps_sets"), video);

        assertThat(response.videoUrl()).isNull();
        assertThat(response.status()).isEqualTo("REJECTED");
        verify(videoStorage, never()).store(any(MultipartFile.class), anyString());
    }

    @Test
    @DisplayName("create: co anh giai phau -> luu vao media registry")
    void createStoresAnatomyImage() {
        MultipartFile image = new MockMultipartFile("i", "a.png", "image/png", new byte[]{1});
        when(videoStorage.storeAnatomyImage(any(MultipartFile.class), anyString()))
                .thenReturn("https://img/new.png");

        var response = service.createPersonalExercise(EMAIL, request("reps_sets"), null, image);

        assertThat(response.anatomyImageUrl()).isEqualTo("https://img/new.png");
    }

    @Test
    @DisplayName("create: countType null -> suy ra tu gia tri mac dinh")
    void createInfersCountType() {
        CreatePersonalExerciseRequestDTO request = new CreatePersonalExerciseRequestDTO(
                "Push Up", null, "Beginner", List.of("step one"), "Chest",
                null, null, 45, null, null, null, null, null, null);

        var response = service.createPersonalExercise(EMAIL, request, null);

        assertThat(response.defaultDuration()).isEqualTo(45);
    }

    @Test
    @DisplayName("create: countType reps_sets va co sets/reps rieng -> dung gia tri rieng")
    void createUsesProvidedSetsAndReps() {
        CreatePersonalExerciseRequestDTO request = new CreatePersonalExerciseRequestDTO(
                "Push Up", null, "Beginner", List.of("step one"), "Chest",
                3, 10, null, null, null, "reps_sets", 5, 20, null);

        var response = service.createPersonalExercise(EMAIL, request, null);

        assertThat(response.defaultSets()).isEqualTo(5);
        assertThat(response.defaultReps()).isEqualTo(20);
    }

    @Test
    @DisplayName("create: countType duration -> luu thoi luong")
    void createStoresDuration() {
        CreatePersonalExerciseRequestDTO request = new CreatePersonalExerciseRequestDTO(
                "Push Up", null, "Beginner", List.of("step one"), "Chest",
                null, null, null, null, null, "duration", null, null, 60);

        var response = service.createPersonalExercise(EMAIL, request, null);

        assertThat(response.defaultDuration()).isEqualTo(60);
    }

    @Test
    @DisplayName("create: sets/reps khong hop le -> 400")
    void createRejectsInvalidSetsAndReps() {
        CreatePersonalExerciseRequestDTO request = new CreatePersonalExerciseRequestDTO(
                "Push Up", null, "Beginner", List.of("step one"), "Chest",
                null, null, null, null, null, "reps_sets", 99, 10, null);

        assertThatThrownBy(() -> service.createPersonalExercise(EMAIL, request, null))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("create: duration khong hop le -> 400")
    void createRejectsInvalidDuration() {
        CreatePersonalExerciseRequestDTO request = new CreatePersonalExerciseRequestDTO(
                "Push Up", null, "Beginner", List.of("step one"), "Chest",
                null, null, null, null, null, "duration", null, null, 9999);

        assertThatThrownBy(() -> service.createPersonalExercise(EMAIL, request, null))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("create: level rong -> 400")
    void createRejectsBlankLevel() {
        CreatePersonalExerciseRequestDTO request = new CreatePersonalExerciseRequestDTO(
                "Push Up", null, "  ", List.of("step one"), "Chest",
                3, 10, null, null, null, "reps_sets", null, null, null);

        assertThatThrownBy(() -> service.createPersonalExercise(EMAIL, request, null))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("create: level khong ton tai -> 400")
    void createRejectsUnknownLevel() {
        when(fitnessLevels.findByNameIgnoreCase("Ghost")).thenReturn(Optional.empty());
        CreatePersonalExerciseRequestDTO request = new CreatePersonalExerciseRequestDTO(
                "Push Up", null, "Ghost", List.of("step one"), "Chest",
                3, 10, null, null, null, "reps_sets", null, null, null);

        assertThatThrownBy(() -> service.createPersonalExercise(EMAIL, request, null))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("create: level INACTIVE -> 400")
    void createRejectsInactiveLevel() {
        FitnessLevel inactive = new FitnessLevel();
        inactive.setName("Advanced");
        inactive.setStatus("INACTIVE");
        when(fitnessLevels.findByNameIgnoreCase("Advanced")).thenReturn(Optional.of(inactive));
        CreatePersonalExerciseRequestDTO request = new CreatePersonalExerciseRequestDTO(
                "Push Up", null, "Advanced", List.of("step one"), "Chest",
                3, 10, null, null, null, "reps_sets", null, null, null);

        assertThatThrownBy(() -> service.createPersonalExercise(EMAIL, request, null))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("create: text bi chan -> 400")
    void createRejectsFlaggedText() {
        when(moderation.checkText(anyString(), any(), any(), any())).thenReturn("Flagged words: bad");
        CreatePersonalExerciseRequestDTO request = new CreatePersonalExerciseRequestDTO(
                "Push Up", null, "Beginner", List.of("step one"), "Chest",
                3, 10, null, null, null, "reps_sets", null, null, null);

        assertThatThrownBy(() -> service.createPersonalExercise(EMAIL, request, null))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Flagged words");
    }

    @Test
    @DisplayName("create: member khong ton tai -> 401")
    void createRejectsUnknownMember() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createPersonalExercise(EMAIL, request("reps_sets"), null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    @DisplayName("create: luu that bai -> giai phong media")
    void createReleasesMediaOnFailure() {
        MultipartFile video = new MockMultipartFile("v", "a.mp4", "video/mp4", new byte[]{1});
        when(videoStorage.store(any(MultipartFile.class), anyString())).thenReturn("https://video/new.mp4");
        when(exercises.save(any(Exercise.class))).thenThrow(new RuntimeException("db down"));

        assertThatThrownBy(() -> service.createPersonalExercise(EMAIL, request("reps_sets"), video))
                .isInstanceOf(RuntimeException.class);
        verify(mediaRegistry).release(eq("https://video/new.mp4"), anyString());
    }

    // ------------------------------------------------------------ resubmit

    @Test
    @DisplayName("resubmit: bai khong ton tai -> 404")
    void resubmitRejectsMissingExercise() {
        when(exercises.findByIdAndCreatedBy_IdAndSource(anyLong(), anyLong(), anyString()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resubmitPersonalExercise(EMAIL, 1L, request("reps_sets"), null))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("resubmit: bai chua bi tu choi -> 409")
    void resubmitRejectsNonRejectedExercise() {
        when(exercises.findByIdAndCreatedBy_IdAndSource(anyLong(), anyLong(), anyString()))
                .thenReturn(Optional.of(exercise(1L, Exercise.EntryStatus.PENDING)));

        assertThatThrownBy(() -> service.resubmitPersonalExercise(EMAIL, 1L, request("reps_sets"), null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("resubmit: giu video cu va khong upload moi -> chap nhan")
    void resubmitKeepsCurrentVideo() {
        Exercise exercise = exercise(1L, Exercise.EntryStatus.REJECTED);
        exercise.setVideoUrl("https://video/old.mp4");
        when(exercises.findByIdAndCreatedBy_IdAndSource(anyLong(), anyLong(), anyString()))
                .thenReturn(Optional.of(exercise));

        CreatePersonalExerciseRequestDTO request = new CreatePersonalExerciseRequestDTO(
                "Push Up", null, "Beginner", List.of("step one"), "Chest",
                3, 10, null, null, true, "reps_sets", null, null, null);

        var response = service.resubmitPersonalExercise(EMAIL, 1L, request, null);

        assertThat(response.status()).isEqualTo("PENDING");
        verify(videoStorage, never()).store(any(MultipartFile.class), anyString());
    }

    @Test
    @DisplayName("resubmit: khong giu video cu -> bi tu choi")
    void resubmitRejectsWhenVideoDropped() {
        Exercise exercise = exercise(1L, Exercise.EntryStatus.REJECTED);
        exercise.setVideoUrl("https://video/old.mp4");
        when(exercises.findByIdAndCreatedBy_IdAndSource(anyLong(), anyLong(), anyString()))
                .thenReturn(Optional.of(exercise));

        var response = service.resubmitPersonalExercise(EMAIL, 1L, request("reps_sets"), null);

        assertThat(response.status()).isEqualTo("REJECTED");
        assertThat(response.rejectionReason()).contains("Video check");
    }

    @Test
    @DisplayName("resubmit: upload video moi -> giai phong video cu")
    void resubmitReplacesVideo() {
        Exercise exercise = exercise(1L, Exercise.EntryStatus.REJECTED);
        exercise.setVideoUrl("https://video/old.mp4");
        when(exercises.findByIdAndCreatedBy_IdAndSource(anyLong(), anyLong(), anyString()))
                .thenReturn(Optional.of(exercise));
        MultipartFile video = new MockMultipartFile("v", "a.mp4", "video/mp4", new byte[]{1});
        when(videoStorage.store(any(MultipartFile.class), anyString())).thenReturn("https://video/new.mp4");

        service.resubmitPersonalExercise(EMAIL, 1L, request("reps_sets"), video);

        verify(mediaRegistry).release(eq("https://video/old.mp4"), anyString());
    }

    @Test
    @DisplayName("resubmit: upload anh moi -> giai phong anh cu")
    void resubmitReplacesAnatomyImage() {
        Exercise exercise = exercise(1L, Exercise.EntryStatus.REJECTED);
        exercise.setAnatomyImageUrl("https://img/old.png");
        when(exercises.findByIdAndCreatedBy_IdAndSource(anyLong(), anyLong(), anyString()))
                .thenReturn(Optional.of(exercise));
        MultipartFile image = new MockMultipartFile("i", "a.png", "image/png", new byte[]{1});
        when(videoStorage.storeAnatomyImage(any(MultipartFile.class), anyString()))
                .thenReturn("https://img/new.png");

        service.resubmitPersonalExercise(EMAIL, 1L, request("reps_sets"), null, image);

        verify(mediaRegistry).release(eq("https://img/old.png"), anyString());
    }

    @Test
    @DisplayName("resubmit: doi muc do chia se -> luu")
    void resubmitUpdatesSharedFlag() {
        Exercise exercise = exercise(1L, Exercise.EntryStatus.REJECTED);
        when(exercises.findByIdAndCreatedBy_IdAndSource(anyLong(), anyLong(), anyString()))
                .thenReturn(Optional.of(exercise));

        CreatePersonalExerciseRequestDTO request = new CreatePersonalExerciseRequestDTO(
                "Push Up", null, "Beginner", List.of("step one"), "Chest",
                3, 10, null, false, null, "reps_sets", null, null, null);

        service.resubmitPersonalExercise(EMAIL, 1L, request, null);

        assertThat(exercise.isShareWithCommunity()).isFalse();
    }

    @Test
    @DisplayName("resubmit: text bi chan -> 400")
    void resubmitRejectsFlaggedText() {
        Exercise exercise = exercise(1L, Exercise.EntryStatus.REJECTED);
        when(exercises.findByIdAndCreatedBy_IdAndSource(anyLong(), anyLong(), anyString()))
                .thenReturn(Optional.of(exercise));
        when(moderation.checkText(anyString(), any(), any(), any())).thenReturn("Flagged words: bad");

        assertThatThrownBy(() -> service.resubmitPersonalExercise(EMAIL, 1L, request("reps_sets"), null))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("resubmit: luu that bai -> giai phong media moi")
    void resubmitReleasesMediaOnFailure() {
        Exercise exercise = exercise(1L, Exercise.EntryStatus.REJECTED);
        when(exercises.findByIdAndCreatedBy_IdAndSource(anyLong(), anyLong(), anyString()))
                .thenReturn(Optional.of(exercise));
        MultipartFile video = new MockMultipartFile("v", "a.mp4", "video/mp4", new byte[]{1});
        when(videoStorage.store(any(MultipartFile.class), anyString())).thenReturn("https://video/new.mp4");
        when(exercises.save(any(Exercise.class))).thenThrow(new RuntimeException("db down"));

        assertThatThrownBy(() -> service.resubmitPersonalExercise(EMAIL, 1L, request("reps_sets"), video))
                .isInstanceOf(RuntimeException.class);
        verify(mediaRegistry).release(eq("https://video/new.mp4"), anyString());
    }

    // -------------------------------------------------------------- update

    @Test
    @DisplayName("update: bai chua duyet -> 409")
    void updateRejectsNonAcceptedExercise() {
        when(exercises.findByIdAndCreatedBy_IdAndSource(anyLong(), anyLong(), anyString()))
                .thenReturn(Optional.of(exercise(1L, Exercise.EntryStatus.PENDING)));

        assertThatThrownBy(() -> service.updateAcceptedPersonalExercise(EMAIL, 1L, request("reps_sets"), null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("update: video moi bi tu choi -> bai bi tu choi")
    void updateRejectsWhenVideoRejected() {
        when(exercises.findByIdAndCreatedBy_IdAndSource(anyLong(), anyLong(), anyString()))
                .thenReturn(Optional.of(exercise(1L, Exercise.EntryStatus.ACCEPTED)));
        MultipartFile video = new MockMultipartFile("v", "a.mp4", "video/mp4", new byte[]{1});
        when(moderation.checkVideo(any())).thenReturn("Video check failed");

        var response = service.updateAcceptedPersonalExercise(EMAIL, 1L, request("reps_sets"), video);

        assertThat(response.status()).isEqualTo("REJECTED");
    }

    @Test
    @DisplayName("update: upload video moi -> giai phong video cu")
    void updateReplacesVideo() {
        Exercise exercise = exercise(1L, Exercise.EntryStatus.ACCEPTED);
        exercise.setVideoUrl("https://video/old.mp4");
        when(exercises.findByIdAndCreatedBy_IdAndSource(anyLong(), anyLong(), anyString()))
                .thenReturn(Optional.of(exercise));
        MultipartFile video = new MockMultipartFile("v", "a.mp4", "video/mp4", new byte[]{1});
        when(videoStorage.store(any(MultipartFile.class), anyString())).thenReturn("https://video/new.mp4");

        service.updateAcceptedPersonalExercise(EMAIL, 1L, request("reps_sets"), video);

        verify(mediaRegistry).release(eq("https://video/old.mp4"), anyString());
    }

    @Test
    @DisplayName("update: upload anh moi -> giai phong anh cu")
    void updateReplacesAnatomyImage() {
        Exercise exercise = exercise(1L, Exercise.EntryStatus.ACCEPTED);
        exercise.setAnatomyImageUrl("https://img/old.png");
        when(exercises.findByIdAndCreatedBy_IdAndSource(anyLong(), anyLong(), anyString()))
                .thenReturn(Optional.of(exercise));
        MultipartFile image = new MockMultipartFile("i", "a.png", "image/png", new byte[]{1});
        when(videoStorage.storeAnatomyImage(any(MultipartFile.class), anyString()))
                .thenReturn("https://img/new.png");

        service.updateAcceptedPersonalExercise(EMAIL, 1L, request("reps_sets"), null, image);

        verify(mediaRegistry).release(eq("https://img/old.png"), anyString());
    }

    @Test
    @DisplayName("update: doi muc do chia se -> luu")
    void updateUpdatesSharedFlag() {
        Exercise exercise = exercise(1L, Exercise.EntryStatus.ACCEPTED);
        when(exercises.findByIdAndCreatedBy_IdAndSource(anyLong(), anyLong(), anyString()))
                .thenReturn(Optional.of(exercise));

        CreatePersonalExerciseRequestDTO request = new CreatePersonalExerciseRequestDTO(
                "Push Up", null, "Beginner", List.of("step one"), "Chest",
                3, 10, null, true, null, "reps_sets", null, null, null);

        service.updateAcceptedPersonalExercise(EMAIL, 1L, request, null);

        assertThat(exercise.isShareWithCommunity()).isTrue();
    }

    @Test
    @DisplayName("update: text bi chan -> 400")
    void updateRejectsFlaggedText() {
        when(exercises.findByIdAndCreatedBy_IdAndSource(anyLong(), anyLong(), anyString()))
                .thenReturn(Optional.of(exercise(1L, Exercise.EntryStatus.ACCEPTED)));
        when(moderation.checkText(anyString(), any(), any(), any())).thenReturn("Flagged words: bad");

        assertThatThrownBy(() -> service.updateAcceptedPersonalExercise(EMAIL, 1L, request("reps_sets"), null))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("update: luu that bai -> giai phong media moi")
    void updateReleasesMediaOnFailure() {
        when(exercises.findByIdAndCreatedBy_IdAndSource(anyLong(), anyLong(), anyString()))
                .thenReturn(Optional.of(exercise(1L, Exercise.EntryStatus.ACCEPTED)));
        MultipartFile video = new MockMultipartFile("v", "a.mp4", "video/mp4", new byte[]{1});
        when(videoStorage.store(any(MultipartFile.class), anyString())).thenReturn("https://video/new.mp4");
        when(exercises.save(any(Exercise.class))).thenThrow(new RuntimeException("db down"));

        assertThatThrownBy(() -> service.updateAcceptedPersonalExercise(EMAIL, 1L, request("reps_sets"), video))
                .isInstanceOf(RuntimeException.class);
        verify(mediaRegistry).release(eq("https://video/new.mp4"), anyString());
    }

    // -------------------------------------------------------------- others

    @Test
    @DisplayName("getPersonalExercise: bai khong ton tai -> 404")
    void getPersonalExerciseNotFound() {
        when(exercises.findByIdAndCreatedBy_IdAndSource(anyLong(), anyLong(), anyString()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getPersonalExercise(EMAIL, 1L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getPersonalExercise: bai bi tu choi -> tra ly do tu choi")
    void getPersonalExerciseReturnsRejectionReason() {
        Exercise exercise = exercise(1L, Exercise.EntryStatus.REJECTED);
        when(exercises.findByIdAndCreatedBy_IdAndSource(anyLong(), anyLong(), anyString()))
                .thenReturn(Optional.of(exercise));
        when(moderationHistory.findLatestRejectionReasons(anyCollection()))
                .thenReturn(Map.of("CU_1", "Form is wrong"));

        var response = service.getPersonalExercise(EMAIL, 1L);

        assertThat(response.rejectionReason()).isEqualTo("Form is wrong");
    }

    @Test
    @DisplayName("delete: khong ton tai -> 404")
    void deleteNotFound() {
        when(exercises.findByIdAndCreatedBy_IdAndSource(anyLong(), anyLong(), anyString()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deletePersonalExercise(EMAIL, 1L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("delete: co media -> giai phong ca hai")
    void deleteReleasesMedia() {
        Exercise exercise = exercise(1L, Exercise.EntryStatus.ACCEPTED);
        exercise.setVideoUrl("https://video/a.mp4");
        exercise.setAnatomyImageUrl("https://img/a.png");
        when(exercises.findByIdAndCreatedBy_IdAndSource(anyLong(), anyLong(), anyString()))
                .thenReturn(Optional.of(exercise));

        service.deletePersonalExercise(EMAIL, 1L);

        verify(mediaRegistry).release(eq("https://video/a.mp4"), anyString());
        verify(mediaRegistry).release(eq("https://img/a.png"), anyString());
    }

    @Test
    @DisplayName("getSubmissionCounts: dem theo trang thai")
    void submissionCountsAreReturned() {
        when(exercises.countByAuthorAndSourceAndModerationStatuses(anyLong(), anyString(), anyList()))
                .thenReturn(2L);

        var counts = service.getSubmissionCounts(EMAIL);

        assertThat(counts.pendingCount()).isEqualTo(2L);
        assertThat(counts.rejectedCount()).isEqualTo(2L);
        assertThat(counts.acceptedCount()).isEqualTo(2L);
    }

    @Test
    @DisplayName("getMemberSubmissions: page/size khong hop le -> 400")
    void submissionsRejectInvalidPage() {
        assertThatThrownBy(() -> service.getMemberSubmissions(
                EMAIL, Exercise.EntryStatus.PENDING, null, null, -1, 10))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("getMemberSubmissions: thieu trang thai -> 400")
    void submissionsRequireStatus() {
        assertThatThrownBy(() -> service.getMemberSubmissions(EMAIL, null, null, null, 0, 10))
                .isInstanceOf(ResponseStatusException.class);
    }
}
