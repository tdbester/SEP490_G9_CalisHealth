package com.calishealth.service;

import com.calishealth.models.MediaFile;
import com.calishealth.models.StorageSettings;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.MediaFileRepository;
import com.calishealth.repository.StorageSettingsRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho {@link MediaRegistryService}: đăng ký media, quota theo member,
 * và các chuyển trạng thái ACTIVE / ORPHANED / REJECTED.
 */
class MediaRegistryServiceCoverageTest {

    private MediaFileRepository media;
    private StorageSettingsRepository settingsRepository;
    private ExerciseRepository exercises;
    private UserRepository users;
    private CloudinaryUsageService cloudinary;
    private MediaRegistryService registry;

    @BeforeEach
    void setUp() {
        media = mock(MediaFileRepository.class);
        settingsRepository = mock(StorageSettingsRepository.class);
        exercises = mock(ExerciseRepository.class);
        users = mock(UserRepository.class);
        cloudinary = mock(CloudinaryUsageService.class);
        registry = new MediaRegistryService(media, settingsRepository, exercises, users, cloudinary);

        StorageSettings settings = new StorageSettings();
        settings.setQuotaGb(5);
        settings.setMaxVideoMb(100);
        settings.setMaxImageMb(10);
        settings.setVideoFormats("MP4,MOV,WEBM");
        settings.setImageFormats("JPG,PNG,WEBP");
        settings.setMemberQuotaMb(300);
        settings.setUploadsPerDay(10);
        settings.setRejectedRetentionDays(7);
        settings.setOrphanGraceHours(24);
        lenient().when(settingsRepository.findById(StorageSettings.ID)).thenReturn(Optional.of(settings));
        lenient().when(cloudinary.usage()).thenReturn(Optional.empty());
    }

    private static MediaFile file(String url, String status) {
        MediaFile f = new MediaFile();
        f.setId(1L);
        f.setFileUrl(url);
        f.setStatus(status);
        f.setCategory(MediaFile.DEMO_VIDEO);
        return f;
    }

    // ------------------------------------------------------------------ helpers

    @Test
    @DisplayName("normalizeFormat: JPEG -> JPG")
    void normalizeFormatMapsJpegToJpg() {
        assertThat(MediaRegistryService.normalizeFormat("jpeg")).isEqualTo("JPG");
        assertThat(MediaRegistryService.normalizeFormat("mp4")).isEqualTo("MP4");
        assertThat(MediaRegistryService.normalizeFormat(null)).isEmpty();
    }

    @Test
    @DisplayName("extensionOf: lay phu mo tep cua URL")
    void extensionOfReadsUrlExtension() {
        assertThat(MediaRegistryService.extensionOf("/media/exercise-demos/a.mp4")).isEqualTo("mp4");
        assertThat(MediaRegistryService.extensionOf("/media/exercise-demos/a")).isEmpty();
        assertThat(MediaRegistryService.extensionOf(null)).isEmpty();
    }

    @Test
    @DisplayName("truncate: cat chuoi dai hon gioi han")
    void truncateCutsLongText() {
        assertThat(MediaRegistryService.truncate("abcdef", 3)).isEqualTo("abc");
        assertThat(MediaRegistryService.truncate("ab", 5)).isEqualTo("ab");
        assertThat(MediaRegistryService.truncate(null, 5)).isNull();
    }

    // ------------------------------------------------------------------- checkUpload

    @Test
    @DisplayName("checkUpload: dinh dang video khong hop le -> 400")
    void checkUploadRejectsWrongVideoFormat() {
        assertThatThrownBy(() -> registry.checkUpload(MediaFile.DEMO_VIDEO, "avi", 1000, null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("checkUpload: dinh dang anh khong hop le -> 400")
    void checkUploadRejectsWrongImageFormat() {
        assertThatThrownBy(() -> registry.checkUpload(MediaFile.ANATOMY_IMAGE, "gif", 1000, null))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("checkUpload: video qua dung luong -> 400")
    void checkUploadRejectsTooLargeVideo() {
        assertThatThrownBy(() -> registry.checkUpload(MediaFile.DEMO_VIDEO, "mp4", 200L * 1024 * 1024, null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("checkUpload: member vuot quota ca nhan -> 507")
    void checkUploadRejectsMemberQuotaOverflow() {
        User member = new User();
        member.setId(3L);
        member.setRole(UserRole.MEMBER);
        when(users.findByEmail("member@calishealth.vn")).thenReturn(Optional.of(member));
        when(media.sumMemberBytes(3L)).thenReturn(299L * 1024 * 1024);
        when(media.sumBytesOnDisk()).thenReturn(0L);

        assertThatThrownBy(() -> registry.checkUpload(MediaFile.DEMO_VIDEO, "mp4", 5L * 1024 * 1024,
                "member@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.INSUFFICIENT_STORAGE));
    }

    @Test
    @DisplayName("checkUpload: member upload qua so lan trong ngay -> 429")
    void checkUploadRejectsTooManyUploadsPerDay() {
        User member = new User();
        member.setId(3L);
        member.setRole(UserRole.MEMBER);
        when(users.findByEmail("member@calishealth.vn")).thenReturn(Optional.of(member));
        when(media.sumMemberBytes(3L)).thenReturn(0L);
        when(media.countUploadsSince(eq(3L), any())).thenReturn(10L);
        when(media.sumBytesOnDisk()).thenReturn(0L);

        assertThatThrownBy(() -> registry.checkUpload(MediaFile.DEMO_VIDEO, "mp4", 1000,
                "member@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.TOO_MANY_REQUESTS));
    }

    @Test
    @DisplayName("checkUpload: uploader khong ton tai -> null")
    void checkUploadReturnsNullForUnknownUploader() {
        when(users.findByEmail("ghost@calishealth.vn")).thenReturn(Optional.empty());
        when(media.sumBytesOnDisk()).thenReturn(0L);

        assertThat(registry.checkUpload(MediaFile.DEMO_VIDEO, "mp4", 1000, "ghost@calishealth.vn")).isNull();
    }

    // -------------------------------------------------------------------- register

    @Test
    @DisplayName("register: tao ban ghi media moi")
    void registerCreatesMediaFile() {
        when(media.save(any(MediaFile.class))).thenAnswer(inv -> inv.getArgument(0));
        User member = new User();
        member.setRole(UserRole.MEMBER);

        MediaFile file = registry.register("/media/exercise-demos/a.mp4", "a.mp4", 1024,
                MediaFile.DEMO_VIDEO, "mp4", "hash", member, LocalDateTime.now(), 12);

        assertThat(file.getFileUrl()).isEqualTo("/media/exercise-demos/a.mp4");
        assertThat(file.getSizeBytes()).isEqualTo(1024);
        assertThat(file.getCategory()).isEqualTo(MediaFile.DEMO_VIDEO);
        assertThat(file.getFileType()).isEqualTo(MediaFile.TYPE_VIDEO);
        assertThat(file.getSource()).isEqualTo(MediaFile.SOURCE_MEMBER);
        assertThat(file.getDurationSeconds()).isEqualTo(12);
        assertThat(file.getStatus()).isEqualTo(MediaFile.ACTIVE);
    }

    @Test
    @DisplayName("register: khong co ten goc -> lay ten tu URL")
    void registerDerivesOriginalNameFromUrl() {
        when(media.save(any(MediaFile.class))).thenAnswer(inv -> inv.getArgument(0));

        MediaFile file = registry.register("/media/exercise-anatomy/a.png", "  ", 1024,
                MediaFile.ANATOMY_IMAGE, "png", "hash", null, LocalDateTime.now());

        assertThat(file.getOriginalName()).isEqualTo("a.png");
        assertThat(file.getFileType()).isEqualTo(MediaFile.TYPE_IMAGE);
        assertThat(file.getSource()).isEqualTo(MediaFile.SOURCE_SYSTEM);
    }

    // -------------------------------------------------------------------- reuse

    @Test
    @DisplayName("reuse: kich hoat lai file da bi an")
    void reuseActivatesExistingFile() {
        MediaFile file = file("/media/exercise-demos/a.mp4", MediaFile.ORPHANED);
        when(media.findById(1L)).thenReturn(Optional.of(file));

        String url = registry.reuse(1L);

        assertThat(url).isEqualTo("/media/exercise-demos/a.mp4");
        assertThat(file.getStatus()).isEqualTo(MediaFile.ACTIVE);
        assertThat(file.getReason()).isNull();
    }

    // ------------------------------------------------------------ referenceState

    @Test
    @DisplayName("referenceState: khong bai nao dung -> null")
    void referenceStateWithoutExercises() {
        when(exercises.findModerationStatusesUsingMedia("/media/a.mp4")).thenReturn(List.of());

        assertThat(registry.referenceState("/media/a.mp4")).isNull();
    }

    @Test
    @DisplayName("referenceState: chi bai bi tu choi -> REJECTED")
    void referenceStateForRejectedOnly() {
        when(exercises.findModerationStatusesUsingMedia("/media/a.mp4")).thenReturn(List.of("REJECTED"));

        assertThat(registry.referenceState("/media/a.mp4")).isEqualTo(MediaFile.REJECTED);
    }

    @Test
    @DisplayName("referenceState: co bai da duyet -> ACTIVE")
    void referenceStateWithApprovedExercise() {
        when(exercises.findModerationStatusesUsingMedia("/media/a.mp4")).thenReturn(List.of("ACTIVE"));

        assertThat(registry.referenceState("/media/a.mp4")).isEqualTo(MediaFile.ACTIVE);
    }

    @Test
    @DisplayName("referenceState: bo qua bai da xoa")
    void referenceStateIgnoresDeletedExercises() {
        when(exercises.findModerationStatusesUsingMedia("/media/a.mp4")).thenReturn(List.of("DELETED"));

        assertThat(registry.referenceState("/media/a.mp4")).isNull();
    }

    // ------------------------------------------------------------------- release

    @Test
    @DisplayName("release: khong co file khop -> khong lam gi")
    void releaseWithoutMatchingFile() {
        when(media.findFirstByFileUrlAndStatusNotOrderByIdDesc(anyString(), eq(MediaFile.PURGED)))
                .thenReturn(Optional.empty());

        registry.release("/media/exercise-demos/a.mp4", "Khong con dung");

        verify(media, never()).save(any(MediaFile.class));
    }

    @Test
    @DisplayName("release: khong con bai nao dung -> ORPHANED")
    void releaseMarksFileOrphaned() {
        MediaFile file = file("/media/exercise-demos/a.mp4", MediaFile.ACTIVE);
        when(media.findFirstByFileUrlAndStatusNotOrderByIdDesc(anyString(), eq(MediaFile.PURGED)))
                .thenReturn(Optional.of(file));
        when(exercises.findModerationStatusesUsingMedia(anyString())).thenReturn(List.of());

        registry.release("/media/exercise-demos/a.mp4", "Khong con dung");

        assertThat(file.getStatus()).isEqualTo(MediaFile.ORPHANED);
        assertThat(file.getReason()).isEqualTo("Khong con dung");
        assertThat(file.getDeletableAt()).isNotNull();
    }

    @Test
    @DisplayName("release: URL null -> bo qua")
    void releaseIgnoresNullUrl() {
        registry.release(null, "Khong con dung");

        verify(media, never()).save(any(MediaFile.class));
    }

    // --------------------------------------------------------------- markRejected

    @Test
    @DisplayName("markRejected: bai bi tu choi -> REJECTED")
    void markRejectedMarksFileRejected() {
        MediaFile file = file("/media/exercise-demos/a.mp4", MediaFile.ACTIVE);
        when(media.findFirstByFileUrlAndStatusNotOrderByIdDesc(anyString(), eq(MediaFile.PURGED)))
                .thenReturn(Optional.of(file));
        when(exercises.findModerationStatusesUsingMedia(anyString())).thenReturn(List.of("REJECTED"));

        registry.markRejected(List.of("/media/exercise-demos/a.mp4"), "Khong an toan");

        assertThat(file.getStatus()).isEqualTo(MediaFile.REJECTED);
        assertThat(file.getReason()).isEqualTo("Khong an toan");
    }

    @Test
    @DisplayName("markRejected: URL null trong danh sach -> bo qua")
    void markRejectedIgnoresNullUrl() {
        registry.markRejected(java.util.Arrays.asList("/media/a.mp4", null), "Khong an toan");

        verify(media, never()).save(any(MediaFile.class));
    }

    // ----------------------------------------------------------------- markActive

    @Test
    @DisplayName("markActive: kich hoat lai file")
    void markActiveActivatesFile() {
        MediaFile file = file("/media/exercise-demos/a.mp4", MediaFile.REJECTED);
        when(media.findFirstByFileUrlAndStatusNotOrderByIdDesc(anyString(), eq(MediaFile.PURGED)))
                .thenReturn(Optional.of(file));

        registry.markActive(List.of("/media/exercise-demos/a.mp4"));

        assertThat(file.getStatus()).isEqualTo(MediaFile.ACTIVE);
    }

    // ------------------------------------------------------------- purgeAvatar

    @Test
    @DisplayName("purgeAvatar: danh dau da xoa vinh vien")
    void purgeAvatarMarksFilePurged() {
        MediaFile file = file("/media/profile-avatars/a.jpg", MediaFile.ACTIVE);
        when(media.findFirstByFileUrlAndStatusNotOrderByIdDesc(anyString(), eq(MediaFile.PURGED)))
                .thenReturn(Optional.of(file));

        registry.purgeAvatar("/media/profile-avatars/a.jpg");

        assertThat(file.getStatus()).isEqualTo(MediaFile.PURGED);
        assertThat(file.getReason()).isEqualTo("Profile photo removed");
    }

    @Test
    @DisplayName("purgeAvatar: URL null -> bo qua")
    void purgeAvatarIgnoresNullUrl() {
        registry.purgeAvatar(null);

        verify(media, never()).save(any(MediaFile.class));
    }

    // ------------------------------------------------------- applyReferenceState

    @Test
    @DisplayName("applyReferenceState: file avatar khong bao gio bi doi trang thai")
    void applyReferenceStateKeepsAvatarActive() {
        MediaFile avatar = file("/media/profile-avatars/a.jpg", MediaFile.ACTIVE);
        avatar.setCategory(MediaFile.PROFILE_AVATAR);

        registry.applyReferenceState(avatar, null, "Khong con dung", LocalDateTime.now());

        assertThat(avatar.getStatus()).isEqualTo(MediaFile.ACTIVE);
    }

    @Test
    @DisplayName("applyReferenceState: file da xoa vinh vien -> giu nguyen")
    void applyReferenceStateKeepsPurgedFile() {
        MediaFile purged = file("/media/exercise-demos/a.mp4", MediaFile.PURGED);

        registry.applyReferenceState(purged, MediaFile.ACTIVE, "Khong con dung", LocalDateTime.now());

        assertThat(purged.getStatus()).isEqualTo(MediaFile.PURGED);
    }

    @Test
    @DisplayName("applyReferenceState: con bai dung -> ACTIVE")
    void applyReferenceStateActivatesFile() {
        MediaFile file = file("/media/exercise-demos/a.mp4", MediaFile.ORPHANED);

        registry.applyReferenceState(file, MediaFile.ACTIVE, "Khong con dung", LocalDateTime.now());

        assertThat(file.getStatus()).isEqualTo(MediaFile.ACTIVE);
    }

    @Test
    @DisplayName("applyReferenceState: file da ORPHANED -> giu nguyen ngay bat dau")
    void applyReferenceStateKeepsOrphanInactiveSince() {
        MediaFile file = file("/media/exercise-demos/a.mp4", MediaFile.ORPHANED);
        LocalDateTime since = LocalDateTime.now().minusDays(2);
        file.setInactiveSince(since);

        registry.applyReferenceState(file, null, "Khong con dung", LocalDateTime.now());

        assertThat(file.getStatus()).isEqualTo(MediaFile.ORPHANED);
        assertThat(file.getInactiveSince()).isEqualTo(since);
    }

    // ------------------------------------------------------------------ settings

    @Test
    @DisplayName("settings: thieu dong cau -> nem loi")
    void settingsRequiresConfigurationRow() {
        when(settingsRepository.findById(StorageSettings.ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> registry.settings())
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("findSameContent: khong co file cung noi dung -> rong")
    void findSameContentReturnsEmpty() {
        when(media.findFirstByContentHashAndCategoryAndStatusNotOrderByIdDesc(
                anyString(), anyString(), eq(MediaFile.PURGED))).thenReturn(Optional.empty());

        assertThat(registry.findSameContent("hash", MediaFile.DEMO_VIDEO)).isEmpty();
    }

    @Test
    @DisplayName("registerAvatar: URL null -> bo qua")
    void registerAvatarIgnoresNullUrl() {
        registry.registerAvatar(null, "a.jpg", 100, null);

        verify(media, never()).save(any(MediaFile.class));
    }

    @Test
    @DisplayName("registerAvatar: upload lai cung anh -> lam moi kich thuoc")
    void registerAvatarRefreshesExistingFile() {
        MediaFile existing = file("/media/profile-avatars/a.jpg", MediaFile.TRASHED);
        existing.setCategory(MediaFile.PROFILE_AVATAR);
        when(media.findFirstByFileUrlAndStatusNotOrderByIdDesc(anyString(), eq(MediaFile.PURGED)))
                .thenReturn(Optional.of(existing));

        registry.registerAvatar("/media/profile-avatars/a.jpg", "a.jpg", 4096, null);

        assertThat(existing.getStatus()).isEqualTo(MediaFile.ACTIVE);
        assertThat(existing.getSizeBytes()).isEqualTo(4096);
    }

    @Test
    @DisplayName("activate: xoa sach truong hop bi an")
    void activateClearsInactiveFields() {
        MediaFile file = file("/media/exercise-demos/a.mp4", MediaFile.REJECTED);
        file.setReason("Khong an toan");
        file.setInactiveSince(LocalDateTime.now().minusDays(1));

        registry.activate(file);

        assertThat(file.getStatus()).isEqualTo(MediaFile.ACTIVE);
        assertThat(file.getReason()).isNull();
        assertThat(file.getInactiveSince()).isNull();
        assertThat(file.getDeletableAt()).isNull();
        assertThat(file.getTrashedAt()).isNull();
        assertThat(file.getPurgeAt()).isNull();
    }

    @Test
    @DisplayName("checkUpload: thanh cong -> tra ve nguoi upload")
    void checkUploadReturnsUploader() {
        User member = new User();
        member.setId(3L);
        member.setRole(UserRole.MEMBER);
        when(users.findByEmail("member@calishealth.vn")).thenReturn(Optional.of(member));
        when(media.sumMemberBytes(3L)).thenReturn(0L);
        when(media.countUploadsSince(eq(3L), any())).thenReturn(0L);
        when(media.sumBytesOnDisk()).thenReturn(0L);

        assertThat(registry.checkUpload(MediaFile.DEMO_VIDEO, "mp4", 1000, "member@calishealth.vn"))
                .isSameAs(member);
    }

    @Test
    @DisplayName("checkUpload: dung luong dat dung theo MB")
    void checkUploadUsesMegabyteLimit() {
        when(media.sumBytesOnDisk()).thenReturn(0L);

        assertThat(registry.checkUpload(MediaFile.ANATOMY_IMAGE, "png", 5L * 1024 * 1024, null)).isNull();
        assertThatThrownBy(() -> registry.checkUpload(MediaFile.ANATOMY_IMAGE, "png", 20L * 1024 * 1024, null))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("applyReferenceState: state REJECTED -> REJECTED")
    void applyReferenceStateMarksRejected() {
        MediaFile file = file("/media/exercise-demos/a.mp4", MediaFile.ACTIVE);

        registry.applyReferenceState(file, MediaFile.REJECTED, "Khong con dung", LocalDateTime.now());

        assertThat(file.getStatus()).isEqualTo(MediaFile.REJECTED);
        assertThat(file.getReason()).isEqualTo("Rejected by moderation");
    }

    @Test
    @DisplayName("applyReferenceState: file TRASHED -> giu nguyen")
    void applyReferenceStateKeepsTrashedFile() {
        MediaFile file = file("/media/exercise-demos/a.mp4", MediaFile.TRASHED);

        registry.applyReferenceState(file, null, "Khong con dung", LocalDateTime.now());

        assertThat(file.getStatus()).isEqualTo(MediaFile.TRASHED);
    }

    @Test
    @DisplayName("markRejected: file da REJECTED -> giu nguyen")
    void markRejectedKeepsAlreadyRejectedFile() {
        MediaFile file = file("/media/exercise-demos/a.mp4", MediaFile.REJECTED);
        when(media.findFirstByFileUrlAndStatusNotOrderByIdDesc(anyString(), eq(MediaFile.PURGED)))
                .thenReturn(Optional.of(file));
        when(exercises.findModerationStatusesUsingMedia(anyString())).thenReturn(List.of("REJECTED"));

        registry.markRejected(List.of("/media/exercise-demos/a.mp4"), "Khong an toan");

        assertThat(file.getStatus()).isEqualTo(MediaFile.REJECTED);
    }

    @Test
    @DisplayName("markActive: danh sach rong -> khong lam gi")
    void markActiveWithEmptyList() {
        registry.markActive(List.of());

        verify(media, never()).save(any(MediaFile.class));
    }

    @Test
    @DisplayName("referenceState: nhieu bai, co mot bai bi tu choi -> ACTIVE")
    void referenceStateWithMixedExercises() {
        when(exercises.findModerationStatusesUsingMedia(anyString())).thenReturn(List.of("REJECTED", "ACTIVE"));

        assertThat(registry.referenceState("/media/a.mp4")).isEqualTo(MediaFile.ACTIVE);
    }

    @Test
    @DisplayName("referenceState: tat ca bi tu choi -> REJECTED")
    void referenceStateWithAllRejected() {
        when(exercises.findModerationStatusesUsingMedia(anyString())).thenReturn(List.of("REJECTED", "REJECTED"));

        assertThat(registry.referenceState("/media/a.mp4")).isEqualTo(MediaFile.REJECTED);
    }

    @Test
    @DisplayName("release: file da dung lai -> ORPHANED")
    void releaseMarksUnusedFileOrphaned() {
        MediaFile file = file("/media/exercise-demos/a.mp4", MediaFile.ACTIVE);
        when(media.findFirstByFileUrlAndStatusNotOrderByIdDesc(anyString(), eq(MediaFile.PURGED)))
                .thenReturn(Optional.of(file));
        when(exercises.findModerationStatusesUsingMedia(anyString())).thenReturn(List.of("DELETED"));

        registry.release("/media/exercise-demos/a.mp4", "Khong con dung");

        assertThat(file.getStatus()).isEqualTo(MediaFile.ORPHANED);
    }

    @Test
    @DisplayName("release: file co bai con dung -> giu ACTIVE")
    void releaseKeepsFileUsedByActiveExercise() {
        MediaFile file = file("/media/exercise-demos/a.mp4", MediaFile.ACTIVE);
        when(media.findFirstByFileUrlAndStatusNotOrderByIdDesc(anyString(), eq(MediaFile.PURGED)))
                .thenReturn(Optional.of(file));
        when(exercises.findModerationStatusesUsingMedia(anyString())).thenReturn(List.of("ACTIVE"));

        registry.release("/media/exercise-demos/a.mp4", "Khong con dung");

        assertThat(file.getStatus()).isEqualTo(MediaFile.ACTIVE);
    }

    @Test
    @DisplayName("release: file da ORPHANED -> giu nguyen")
    void releaseKeepsAlreadyOrphanedFile() {
        MediaFile file = file("/media/exercise-demos/a.mp4", MediaFile.ORPHANED);
        when(media.findFirstByFileUrlAndStatusNotOrderByIdDesc(anyString(), eq(MediaFile.PURGED)))
                .thenReturn(Optional.of(file));
        when(exercises.findModerationStatusesUsingMedia(anyString())).thenReturn(List.of());

        registry.release("/media/exercise-demos/a.mp4", "Khong con dung");

        assertThat(file.getStatus()).isEqualTo(MediaFile.ORPHANED);
    }
}
