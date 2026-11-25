package com.calishealth.service;

import com.calishealth.events.MemberFitnessLevelChangedEvent;
import com.calishealth.events.WorkoutCompletedEvent;
import com.calishealth.models.MediaFile;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test cho các service phụ trợ nhỏ: email, listener leaderboard, job dọn dẹp storage
 * và cấu hình folder Cloudinary.
 */
class SupportServicesCoverageTest {

    // ------------------------------------------------------------- EmailService

    @Test
    @DisplayName("Email: gui thanh cong -> khong nem loi")
    void emailServiceSendsMessage() {
        org.springframework.mail.javamail.JavaMailSender sender =
                mock(org.springframework.mail.javamail.JavaMailSender.class);
        EmailService service = new EmailService(sender);

        assertThatCode(() -> service.send("a@b.c", "Subject", "Body")).doesNotThrowAnyException();

        org.mockito.ArgumentCaptor<org.springframework.mail.SimpleMailMessage> captor =
                org.mockito.ArgumentCaptor.forClass(org.springframework.mail.SimpleMailMessage.class);
        verify(sender).send(captor.capture());
        assertThat(captor.getValue().getTo()).containsExactly("a@b.c");
        assertThat(captor.getValue().getSubject()).isEqualTo("Subject");
    }

    @Test
    @DisplayName("Email: SMTP loi -> khong nem loi ra ngoai")
    void emailServiceSwallowsFailures() {
        org.springframework.mail.javamail.JavaMailSender sender =
                mock(org.springframework.mail.javamail.JavaMailSender.class);
        doThrow(new RuntimeException("smtp down")).when(sender)
                .send(any(org.springframework.mail.SimpleMailMessage.class));
        EmailService service = new EmailService(sender);

        assertThatCode(() -> service.send("a@b.c", "Subject", "Body")).doesNotThrowAnyException();
    }

    // ------------------------------------------------- LeaderboardEventListener

    @Test
    @DisplayName("Listener: buoi tap hoan thanh -> refresh diem")
    void listenerRefreshesScoreAfterWorkout() {
        WeeklyLeaderboardService leaderboard = mock(WeeklyLeaderboardService.class);
        LeaderboardEventListener listener = new LeaderboardEventListener(leaderboard);

        listener.onWorkoutCompleted(new WorkoutCompletedEvent(5L));

        verify(leaderboard).refreshMemberScore(5L);
    }

    @Test
    @DisplayName("Listener: loi tinh diem -> khong nem loi")
    void listenerSwallowsScoreFailure() {
        WeeklyLeaderboardService leaderboard = mock(WeeklyLeaderboardService.class);
        doThrow(new RuntimeException("db down")).when(leaderboard).refreshMemberScore(anyLong());
        LeaderboardEventListener listener = new LeaderboardEventListener(leaderboard);

        assertThatCode(() -> listener.onWorkoutCompleted(new WorkoutCompletedEvent(5L)))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Listener: doi level -> tinh lai diem")
    void listenerRecomputesScoreAfterLevelChange() {
        WeeklyLeaderboardService leaderboard = mock(WeeklyLeaderboardService.class);
        LeaderboardEventListener listener = new LeaderboardEventListener(leaderboard);

        listener.onFitnessLevelChanged(new MemberFitnessLevelChangedEvent(7L));

        verify(leaderboard).resetAndRecomputeMemberScore(7L);
    }

    @Test
    @DisplayName("Listener: loi khi doi level -> khong nem loi")
    void listenerSwallowsLevelChangeFailure() {
        WeeklyLeaderboardService leaderboard = mock(WeeklyLeaderboardService.class);
        doThrow(new RuntimeException("db down")).when(leaderboard).resetAndRecomputeMemberScore(anyLong());
        LeaderboardEventListener listener = new LeaderboardEventListener(leaderboard);

        assertThatCode(() -> listener.onFitnessLevelChanged(new MemberFitnessLevelChangedEvent(7L)))
                .doesNotThrowAnyException();
    }

    // -------------------------------------------------------- StorageCleanupJob

    @Test
    @DisplayName("Job don dep: chay hang ngay -> ghi nhan ket qua")
    void cleanupJobRunsDaily() {
        MediaCleanupService cleanup = mock(MediaCleanupService.class);
        when(cleanup.runDaily()).thenReturn(new MediaCleanupService.CleanupRun(2, 1, 1024L));
        StorageCleanupJob job = new StorageCleanupJob(cleanup);

        job.runDaily();

        verify(cleanup).runDaily();
    }

    @Test
    @DisplayName("Job don dep: loi -> khong nem loi")
    void cleanupJobSurvivesFailure() {
        MediaCleanupService cleanup = mock(MediaCleanupService.class);
        when(cleanup.runDaily()).thenThrow(new RuntimeException("cloudinary down"));
        StorageCleanupJob job = new StorageCleanupJob(cleanup);

        assertThatCode(job::runDaily).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Job don dep: khoi dong app -> dong bo media")
    void cleanupJobReconcilesOnStartup() {
        MediaCleanupService cleanup = mock(MediaCleanupService.class);
        StorageCleanupJob job = new StorageCleanupJob(cleanup);

        job.reconcileOnStartup();

        verify(cleanup).reconcile();
    }

    @Test
    @DisplayName("Job don dep: loi khi dong bo -> khong nem loi")
    void cleanupJobSurvivesReconcileFailure() {
        MediaCleanupService cleanup = mock(MediaCleanupService.class);
        doThrow(new RuntimeException("db down")).when(cleanup).reconcile();
        StorageCleanupJob job = new StorageCleanupJob(cleanup);

        assertThatCode(job::reconcileOnStartup).doesNotThrowAnyException();
    }

    // --------------------------------------------------- CloudinaryFolderService

    @Test
    @DisplayName("Folder: root rong -> dung ten mac dinh")
    void folderServiceFallsBackToDefaultRoot() {
        assertThat(new CloudinaryFolderService(null).root()).isEqualTo("calishealth");
        assertThat(new CloudinaryFolderService("   ").root()).isEqualTo("calishealth");
        assertThat(new CloudinaryFolderService("calishealth///").root()).isEqualTo("calishealth");
    }

    @Test
    @DisplayName("Folder: sub folder rong -> tra ve root")
    void folderServiceReturnsRootForBlankSubFolder() {
        CloudinaryFolderService service = new CloudinaryFolderService("calishealth");

        assertThat(service.of(null)).isEqualTo("calishealth");
        assertThat(service.of("  ")).isEqualTo("calishealth");
        assertThat(service.of("/")).isEqualTo("calishealth");
    }

    @Test
    @DisplayName("Folder: cac folder theo loai media")
    void folderServiceExposesMediaFolders() {
        CloudinaryFolderService service = new CloudinaryFolderService("calishealth");

        assertThat(service.exerciseDemos()).isEqualTo("calishealth/exercise-demos");
        assertThat(service.exerciseAnatomy()).isEqualTo("calishealth/exercise-anatomy");
        assertThat(service.profileAvatars()).isEqualTo("calishealth/profile-avatars");
        assertThat(service.memberExercises()).isEqualTo("calishealth/member-exercises");
        assertThat(service.trash()).isEqualTo("calishealth/trash");
    }

    @Test
    @DisplayName("Folder: chon folder theo category")
    void folderServiceResolvesCategoryFolders() {
        CloudinaryFolderService service = new CloudinaryFolderService("calishealth");

        assertThat(service.forCategory(MediaFile.ANATOMY_IMAGE)).isEqualTo("calishealth/exercise-anatomy");
        assertThat(service.forCategory(MediaFile.PROFILE_AVATAR)).isEqualTo("calishealth/profile-avatars");
        assertThat(service.forCategory(MediaFile.DEMO_VIDEO)).isEqualTo("calishealth/exercise-demos");
    }

    @Test
    @DisplayName("Folder: media cua member -> vao folder member")
    void folderServiceRoutesMemberMedia() {
        CloudinaryFolderService service = new CloudinaryFolderService("calishealth");

        assertThat(service.forCategory(MediaFile.DEMO_VIDEO, MediaFile.SOURCE_MEMBER))
                .isEqualTo("calishealth/member-exercises/exercise-demos");
        assertThat(service.forCategory(MediaFile.ANATOMY_IMAGE, MediaFile.SOURCE_MEMBER))
                .isEqualTo("calishealth/member-exercises/exercise-anatomy");
        assertThat(service.forCategory(MediaFile.PROFILE_AVATAR, MediaFile.SOURCE_MEMBER))
                .isEqualTo("calishealth/profile-avatars");
    }

    @Test
    @DisplayName("Folder: danh sach folder theo category va folder media")
    void folderServiceListsFolders() {
        CloudinaryFolderService service = new CloudinaryFolderService("calishealth");

        Map<String, String> all = service.foldersByCategory();
        assertThat(all).containsKeys(MediaFile.DEMO_VIDEO, MediaFile.ANATOMY_IMAGE,
                MediaFile.PROFILE_AVATAR, MediaFile.SOURCE_MEMBER);

        Map<String, String> media = service.mediaFolders();
        assertThat(media).containsOnlyKeys(MediaFile.DEMO_VIDEO, MediaFile.ANATOMY_IMAGE, MediaFile.PROFILE_AVATAR);
    }
}
