package com.calishealth.service;

import com.calishealth.dtos.AdminStorageDtos.DeleteResult;
import com.calishealth.dtos.AdminStorageDtos.FolderSetup;
import com.calishealth.dtos.AdminStorageDtos.MediaItem;
import com.calishealth.dtos.AdminStorageDtos.Overview;
import com.calishealth.dtos.AdminStorageDtos.QuotaInfo;
import com.calishealth.dtos.AdminStorageDtos.RestoreResult;
import com.calishealth.dtos.AdminStorageDtos.Settings;
import com.calishealth.dtos.AdminStorageDtos.TrashResult;
import com.calishealth.dtos.AdminStorageDtos.UpdateSettingsRequest;
import com.calishealth.models.MediaFile;
import com.calishealth.models.StorageSettings;
import com.calishealth.models.StorageUsageDaily;
import com.calishealth.models.User;
import com.calishealth.repository.MediaFileRepository;
import com.calishealth.repository.StorageSettingsRepository;
import com.calishealth.repository.StorageUsageDailyRepository;
import com.calishealth.repository.UserActivityRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminStorageServiceTest {
    @Mock private MediaFileRepository media;
    @Mock private StorageSettingsRepository settingsRepository;
    @Mock private StorageUsageDailyRepository usageDaily;
    @Mock private MediaRegistryService registry;
    @Mock private MediaCleanupService cleanup;
    @Mock private ExerciseVideoStorageService storage;
    @Mock private CloudinaryUsageService cloudinary;
    @Mock private CloudinarySetupService cloudinarySetup;
    @Mock private CloudinaryOptimizationService optimization;
    @Mock private CreditGuardService guard;
    @Mock private StorageUsageJob usageJob;
    @Mock private UserRepository users;
    @Mock private UserActivityRepository activity;
    @InjectMocks private AdminStorageService service;

    private static final String ADMIN = "admin@example.test";

    private User admin;

    @BeforeEach
    void setUp() {
        admin = new User();
        admin.setId(1L);
        admin.setEmail(ADMIN);
        admin.setFullName("Admin");
    }

    private StorageSettings settings() {
        StorageSettings s = new StorageSettings();
        s.setId(StorageSettings.ID);
        s.setMaxVideoMb(50);
        s.setMaxImageMb(5);
        s.setVideoFormats("MP4,WEBM");
        s.setImageFormats("JPG,PNG");
        s.setDemoMaxSeconds(120);
        s.setMemberQuotaMb(200);
        s.setUploadsPerDay(5);
        s.setRejectedRetentionDays(30);
        s.setOrphanGraceHours(24);
        s.setTrashRetentionDays(14);
        s.setRestoreGraceDays(7);
        s.setAutoCleanupEnabled(true);
        s.setCreditGuardEnabled(true);
        s.setCreditGuardThreshold(90);
        s.setQuotaGb(50);
        s.setWarningPercent(80);
        s.setCriticalPercent(95);
        return s;
    }

    private void stubAdmin() {
        when(users.findByEmail(ADMIN)).thenReturn(Optional.of(admin));
    }

    private void stubRegistry() {
        lenient().when(registry.settings()).thenReturn(settings());
    }

    // ------------------------------------------------------------------- overview

    @Test
    @DisplayName("Overview: không có Cloudinary -> provider LOCAL, quota lấy từ cài đặt")
    void overviewFallsBackToLocalProvider() {
        stubRegistry();
        when(media.sumBytesOnDisk()).thenReturn(1_000L);
        when(cloudinary.usage()).thenReturn(Optional.empty());
        when(media.usageByCategory()).thenReturn(List.of());
        when(media.usageBySource()).thenReturn(List.of());
        when(media.countByFileType()).thenReturn(List.<Object[]>of(
                new Object[] {MediaFile.TYPE_VIDEO, 3L},
                new Object[] {MediaFile.TYPE_IMAGE, 2L}));
        when(media.sumBytesOnDiskAt(any(LocalDateTime.class))).thenReturn(500L);
        when(media.topMembers(any(Pageable.class))).thenReturn(List.<Object[]>of(
                new Object[] {9L, "member@example.test", 100L, 2L}));
        when(media.countByStatus()).thenReturn(List.of());
        when(media.sumExpiringBy(any(LocalDateTime.class))).thenReturn(0L);
        when(cloudinary.consoleLinks()).thenReturn(new CloudinaryUsageService.ConsoleLinks(
                "lib", "usage", "upload", "plan"));
        when(cloudinary.isEnabled()).thenReturn(false);
        when(cloudinary.cloudName()).thenReturn(null);
        when(usageDaily.findByDayGreaterThanEqualOrderByDayAsc(any(LocalDate.class))).thenReturn(List.of());

        Overview overview = service.overview();

        assertEquals("LOCAL", overview.provider());
        assertNull(overview.plan());
        assertFalse(overview.cdnReachable());
        assertEquals(50L * 1024 * 1024 * 1024, overview.quotaBytes());
        assertFalse(overview.quotaLimited());
        assertEquals(1_000L, overview.usedBytes());
        assertEquals(1_000L, overview.registryBytes());
        assertEquals(5, overview.fileCount());
        assertEquals(3, overview.videoCount());
        assertEquals(2, overview.imageCount());
        assertEquals(200L * 1024 * 1024, overview.memberQuotaBytes());
        assertEquals(6, overview.history().size());
        assertEquals(1, overview.topMembers().size());
        assertEquals(9L, overview.topMembers().get(0).userId());
    }

    @Test
    @DisplayName("Overview: có Cloudinary -> provider CLOUDINARY, quota lấy từ plan")
    void overviewUsesCloudinaryQuotaWhenAvailable() {
        stubRegistry();
        CloudinaryUsageService.Usage usage = new CloudinaryUsageService.Usage(
                "Pro", 5_000L, 10_000L, 800L, 4_000L,
                BigDecimal.valueOf(12), BigDecimal.valueOf(20), 60d, LocalDateTime.now());
        when(media.sumBytesOnDisk()).thenReturn(1_000L);
        when(cloudinary.usage()).thenReturn(Optional.of(usage));
        when(media.usageByCategory()).thenReturn(List.<Object[]>of(
                new Object[] {MediaFile.DEMO_VIDEO, 2L, 100L}));
        when(media.usageBySource()).thenReturn(List.<Object[]>of(
                new Object[] {MediaFile.SOURCE_SYSTEM, 1L, 50L}));
        when(media.countByFileType()).thenReturn(List.of());
        when(media.sumBytesOnDiskAt(any(LocalDateTime.class))).thenReturn(500L);
        when(media.topMembers(any(Pageable.class))).thenReturn(List.of());
        when(media.countByStatus()).thenReturn(List.of());
        when(media.sumExpiringBy(any(LocalDateTime.class))).thenReturn(0L);
        when(cloudinary.consoleLinks()).thenReturn(new CloudinaryUsageService.ConsoleLinks(
                "lib", "usage", "upload", "plan"));
        when(cloudinary.isEnabled()).thenReturn(true);
        when(cloudinary.cloudName()).thenReturn("calishealth");
        when(usageDaily.findByDayGreaterThanEqualOrderByDayAsc(any(LocalDate.class))).thenReturn(List.of());

        Overview overview = service.overview();

        assertEquals("CLOUDINARY", overview.provider());
        assertEquals("Pro", overview.plan());
        assertEquals("calishealth", overview.cloudName());
        assertTrue(overview.cdnReachable());
        assertEquals(10_000L, overview.quotaBytes());
        assertTrue(overview.quotaLimited());
        assertEquals(5_000L, overview.usedBytes());
        assertEquals(800L, overview.bandwidthUsedBytes());
        assertEquals(4_000L, overview.bandwidthLimitBytes());
        assertEquals(12d, overview.creditsUsed());
        assertEquals(20d, overview.creditsLimit());
        assertEquals(60d, overview.creditsUsedPercent());
        assertEquals(3, overview.byCategory().size());
        assertEquals(2, overview.bySource().size());
        assertEquals(100L, overview.byCategory().get(0).bytes());
    }

    @Test
    @DisplayName("Overview: có snapshot trong ngày -> dùng dữ liệu daily")
    void overviewIncludesDailySnapshots() {
        stubRegistry();
        LocalDate today = LocalDate.now();
        StorageUsageDaily row = new StorageUsageDaily();
        row.setDay(today);
        row.setStorageUsed(500L);
        row.setBandwidthUsed(10L);
        row.setCreditsUsed(BigDecimal.ONE);
        row.setRegistryBytes(500L);

        when(media.sumBytesOnDisk()).thenReturn(500L);
        when(cloudinary.usage()).thenReturn(Optional.empty());
        when(media.usageByCategory()).thenReturn(List.of());
        when(media.usageBySource()).thenReturn(List.of());
        when(media.countByFileType()).thenReturn(List.of());
        when(media.sumBytesOnDiskAt(any(LocalDateTime.class))).thenReturn(500L);
        when(media.topMembers(any(Pageable.class))).thenReturn(List.of());
        when(media.countByStatus()).thenReturn(List.of());
        when(media.sumExpiringBy(any(LocalDateTime.class))).thenReturn(0L);
        when(cloudinary.consoleLinks()).thenReturn(new CloudinaryUsageService.ConsoleLinks(
                "lib", "usage", "upload", "plan"));
        when(cloudinary.isEnabled()).thenReturn(false);
        when(usageDaily.findByDayGreaterThanEqualOrderByDayAsc(any(LocalDate.class)))
                .thenReturn(List.of(row));

        Overview overview = service.overview();

        assertEquals(1, overview.daily().size());
        assertEquals(today.toString(), overview.daily().get(0).day());
        assertEquals(500L, overview.daily().get(0).usedBytes());
        assertEquals(10L, overview.daily().get(0).bandwidthBytes());
        assertEquals(1d, overview.daily().get(0).creditsUsed());
    }

    // ---------------------------------------------------------------------- media

    @Test
    @DisplayName("Media page: chuyển file sang bảng, trả về summary")
    void mediaPageReturnsItemsAndSummary() {
        stubRegistry();
        MediaFile file = new MediaFile();
        file.setId(1L);
        file.setOriginalName("demo.mp4");
        file.setFileType(MediaFile.TYPE_VIDEO);
        file.setStatus(MediaFile.ORPHANED);
        file.setSource(MediaFile.SOURCE_SYSTEM);
        file.setFileUrl("https://cdn/demo.mp4");
        file.setSizeBytes(1000L);

        when(media.findAll(any(Specification.class), any(Pageable.class))).thenReturn(new PageImpl<>(List.of(file)));
        when(media.countByStatus()).thenReturn(List.<Object[]>of(
                new Object[] {MediaFile.ORPHANED, 2L, 300L}));
        when(media.reclaimable(any(LocalDateTime.class))).thenReturn(List.<Object[]>of(new Object[] {1L, 50L}));
        when(media.sumTrashDue(any(LocalDateTime.class))).thenReturn(0L);
        when(storage.thumbnailUrl(nullable(String.class), anyBoolean())).thenReturn(Optional.empty());

        var page = service.media("inactive", null, null, null, "size_desc", 0, 20);

        assertEquals(1, page.items().size());
        assertEquals("demo.mp4", page.items().get(0).fileName());
        assertEquals("Exercise library", page.items().get(0).sourceLabel());
        assertEquals(2, page.summary().orphanedFiles());
        assertEquals(300L, page.summary().orphanedBytes());
        assertEquals(14, page.summary().trashRetentionDays());
    }

    @Test
    @DisplayName("Media page: file của member -> sourceLabel là email")
    void mediaPageUsesMemberEmailAsSourceLabel() {
        stubRegistry();
        MediaFile file = new MediaFile();
        file.setId(1L);
        file.setOriginalName("avatar.png");
        file.setFileType(MediaFile.TYPE_IMAGE);
        file.setStatus(MediaFile.ORPHANED);
        file.setSource(MediaFile.SOURCE_MEMBER);
        file.setUploadedBy(admin);
        file.setSizeBytes(10L);

        when(media.findAll(any(Specification.class), any(Pageable.class))).thenReturn(new PageImpl<>(List.of(file)));
        when(media.countByStatus()).thenReturn(List.of());
        when(media.reclaimable(any(LocalDateTime.class))).thenReturn(List.<Object[]>of(new Object[] {0L, 0L}));
        when(media.sumTrashDue(any(LocalDateTime.class))).thenReturn(0L);
        when(storage.thumbnailUrl(nullable(String.class), anyBoolean())).thenReturn(Optional.empty());

        assertEquals(ADMIN, service.media("inactive", null, null, null, null, 0, 20)
                .items().get(0).sourceLabel());
    }

    @Test
    @DisplayName("Media page: file của member không còn tài khoản -> Unknown member")
    void mediaPageHandlesMissingUploader() {
        stubRegistry();
        MediaFile file = new MediaFile();
        file.setId(1L);
        file.setStatus(MediaFile.ORPHANED);
        file.setSource(MediaFile.SOURCE_MEMBER);
        file.setSizeBytes(10L);

        when(media.findAll(any(Specification.class), any(Pageable.class))).thenReturn(new PageImpl<>(List.of(file)));
        when(media.countByStatus()).thenReturn(List.of());
        when(media.reclaimable(any(LocalDateTime.class))).thenReturn(List.<Object[]>of(new Object[] {0L, 0L}));
        when(media.sumTrashDue(any(LocalDateTime.class))).thenReturn(0L);
        when(storage.thumbnailUrl(nullable(String.class), anyBoolean())).thenReturn(Optional.empty());

        assertEquals("Unknown member", service.media("inactive", null, null, null, null, 0, 20)
                .items().get(0).sourceLabel());
    }

    @Test
    @DisplayName("Media page: file đã vào thùng rác và bị chính admin xoá -> trashedBy là email")
    void mediaPageShowsTrashedBy() {
        stubRegistry();
        MediaFile file = new MediaFile();
        file.setId(1L);
        file.setStatus(MediaFile.TRASHED);
        file.setSource(MediaFile.SOURCE_SYSTEM);
        file.setTrashedAt(LocalDateTime.now());
        file.setTrashedBy(admin);
        file.setSizeBytes(10L);

        when(media.findAll(any(Specification.class), any(Pageable.class))).thenReturn(new PageImpl<>(List.of(file)));
        when(media.countByStatus()).thenReturn(List.of());
        when(media.reclaimable(any(LocalDateTime.class))).thenReturn(List.<Object[]>of(new Object[] {0L, 0L}));
        when(media.sumTrashDue(any(LocalDateTime.class))).thenReturn(0L);
        when(storage.thumbnailUrl(nullable(String.class), anyBoolean())).thenReturn(Optional.empty());

        assertEquals(ADMIN, service.media("trash", null, null, null, null, 0, 20)
                .items().get(0).trashedBy());
    }

    @Test
    @DisplayName("Media page: file bị dọn tự động -> trashedBy là Auto-cleanup")
    void mediaPageShowsAutoCleanupWhenNoTrashedBy() {
        stubRegistry();
        MediaFile file = new MediaFile();
        file.setId(1L);
        file.setStatus(MediaFile.TRASHED);
        file.setSource(MediaFile.SOURCE_SYSTEM);
        file.setTrashedAt(LocalDateTime.now());
        file.setSizeBytes(10L);

        when(media.findAll(any(Specification.class), any(Pageable.class))).thenReturn(new PageImpl<>(List.of(file)));
        when(media.countByStatus()).thenReturn(List.of());
        when(media.reclaimable(any(LocalDateTime.class))).thenReturn(List.<Object[]>of(new Object[] {0L, 0L}));
        when(media.sumTrashDue(any(LocalDateTime.class))).thenReturn(0L);
        when(storage.thumbnailUrl(nullable(String.class), anyBoolean())).thenReturn(Optional.empty());

        assertEquals("Auto-cleanup", service.media("trash", null, null, null, null, 0, 20)
                .items().get(0).trashedBy());
    }

    // ------------------------------------------------------------------ trash etc.

    @Test
    @DisplayName("Trash: chuyển file vào thùng rác")
    void trashMovesFilesToTrash() {
        stubAdmin();
        stubRegistry();
        MediaFile file = new MediaFile();
        file.setId(1L);
        file.setOriginalName("demo.mp4");
        when(cleanup.trash(any(), any())).thenReturn(new MediaCleanupService.TrashOutcome(
                List.of(file), List.of(), 0L, 0, LocalDateTime.now().plusDays(14)));

        TrashResult result = service.trash(ADMIN, List.of(1L));

        assertEquals(1, result.trashed());
        assertEquals(0, result.purged());
        assertEquals(0, result.skipped());
        assertNotNullPurgeAt(result);
    }

    @Test
    @DisplayName("Trash: không có file nào -> purgeAt null")
    void trashReturnsNullPurgeAtWhenNothingTrashed() {
        stubAdmin();
        stubRegistry();
        when(cleanup.trash(any(), any())).thenReturn(new MediaCleanupService.TrashOutcome(
                List.of(), List.of(), 0L, 0, null));

        TrashResult result = service.trash(ADMIN, List.of(1L));

        assertEquals(0, result.trashed());
        assertNull(result.purgeAt());
    }

    @Test
    @DisplayName("Trash: admin không tồn tại -> 401")
    void trashRejectsUnknownAdmin() {
        when(users.findByEmail(ADMIN)).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.trash(ADMIN, List.of(1L)));
        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
    }

    @Test
    @DisplayName("Restore: trả về số file đã khôi phục và số ngày bảo vệ")
    void restoreReturnsRestoredCount() {
        stubAdmin();
        stubRegistry();
        MediaFile file = new MediaFile();
        file.setId(1L);
        file.setOriginalName("demo.mp4");
        when(cleanup.restore(any())).thenReturn(List.of(file));

        RestoreResult result = service.restore(ADMIN, List.of(1L));

        assertEquals(1, result.restored());
        assertEquals(7, result.graceDays());
    }

    @Test
    @DisplayName("Extend: gia hạn thời gian lưu trữ")
    void extendIncreasesRetention() {
        stubAdmin();
        MediaFile file = new MediaFile();
        file.setId(1L);
        file.setOriginalName("demo.mp4");
        file.setStatus(MediaFile.TRASHED);
        file.setSource(MediaFile.SOURCE_SYSTEM);
        file.setSizeBytes(10L);
        when(cleanup.extend(1L, 5)).thenReturn(file);
        when(storage.thumbnailUrl(nullable(String.class), anyBoolean())).thenReturn(Optional.empty());

        MediaItem item = service.extend(ADMIN, 1L, 5);

        assertEquals("demo.mp4", item.fileName());
        verify(cleanup).extend(1L, 5);
    }

    @Test
    @DisplayName("Delete: xoá vĩnh viễn các file")
    void deletePurgesFiles() {
        stubAdmin();
        stubRegistry();
        MediaFile file = new MediaFile();
        file.setId(1L);
        file.setOriginalName("demo.mp4");
        when(cleanup.purge(any())).thenReturn(new MediaCleanupService.PurgeOutcome(
                List.of(file), 100L, 0));

        DeleteResult result = service.delete(ADMIN, List.of(1L));

        assertEquals(1, result.deleted());
        assertEquals(100L, result.freedBytes());
    }

    @Test
    @DisplayName("Empty trash: dọn sạch thùng rác")
    void emptyTrashPurgesEverything() {
        stubAdmin();
        stubRegistry();
        when(cleanup.emptyTrash()).thenReturn(new MediaCleanupService.PurgeOutcome(
                List.of(), 0L, 0));

        DeleteResult result = service.emptyTrash(ADMIN);

        assertEquals(0, result.deleted());
        assertEquals(0, result.freedBytes());
    }

    // --------------------------------------------------------------------- quota

    @Test
    @DisplayName("Quota info: có Cloudinary -> quota do plan quyết định, không sửa được")
    void quotaInfoUsesCloudinaryPlan() {
        when(cloudinary.usage()).thenReturn(Optional.of(new CloudinaryUsageService.Usage(
                "Pro", 100L, 1000L, 0L, 0L, null, null, 0d, LocalDateTime.now())));

        QuotaInfo info = service.quotaInfo();

        assertEquals("CLOUDINARY", info.provider());
        assertEquals("Pro", info.plan());
        assertEquals(1000L, info.planLimitBytes());
        assertFalse(info.quotaEditable());
    }

    @Test
    @DisplayName("Quota info: không có Cloudinary -> LOCAL, admin sửa được quota")
    void quotaInfoFallsBackToLocal() {
        when(cloudinary.usage()).thenReturn(Optional.empty());

        QuotaInfo info = service.quotaInfo();

        assertEquals("LOCAL", info.provider());
        assertNull(info.plan());
        assertTrue(info.quotaEditable());
    }

    // ------------------------------------------------------------------- folders

    @Test
    @DisplayName("Folders: liệt kê folder Cloudinary kèm số file và dung lượng")
    void foldersListsCloudinaryFolders() {
        when(cloudinarySetup.folderLabels()).thenReturn(Map.of("calishealth/demos", "Exercise demos"));
        when(cloudinarySetup.folderExists("calishealth/demos")).thenReturn(true);
        when(cloudinarySetup.fileCount("calishealth/demos")).thenReturn(7);
        when(cloudinarySetup.folderBytes("calishealth/demos")).thenReturn(900L);

        FolderSetup setup = service.folders();

        assertEquals(1, setup.folders().size());
        assertEquals("calishealth/demos", setup.folders().get(0).path());
        assertEquals("Exercise demos", setup.folders().get(0).label());
        assertTrue(setup.folders().get(0).exists());
        assertEquals(7, setup.folders().get(0).files());
        assertEquals(900L, setup.folders().get(0).bytes());
    }

    @Test
    @DisplayName("Setup folders: tạo các folder còn thiếu")
    void setupFoldersCreatesMissingFolders() {
        stubAdmin();
        CloudinarySetupService.FolderStatus status = new CloudinarySetupService.FolderStatus(
                "calishealth/demos", true, 3, 100L);
        when(cloudinarySetup.setupFolders()).thenReturn(new CloudinarySetupService.SetupResult(
                List.of(status), List.of("calishealth/demos"), List.of(), List.of()));
        when(cloudinarySetup.folderLabels()).thenReturn(Map.of("calishealth/demos", "Exercise demos"));

        FolderSetup setup = service.setupFolders(ADMIN);

        assertEquals(1, setup.created().size());
        assertEquals(1, setup.folders().size());
    }

    @Test
    @DisplayName("Optimization: trả về quy tắc nén ảnh và video")
    void optimizationReturnsRules() {
        when(optimization.enabled()).thenReturn(true);
        when(optimization.imageTransformation()).thenReturn("c_limit,w_1600");
        when(optimization.videoTransformation()).thenReturn("vc_auto,w_1280");
        when(optimization.deliveryTransformation()).thenReturn("q_auto:good");
        when(optimization.imageMaxWidth()).thenReturn(1600);
        when(optimization.videoMaxWidth()).thenReturn(1280);

        var info = service.optimization();

        assertTrue(info.enabled());
        assertEquals("c_limit,w_1600", info.imageRule());
        assertEquals(1600, info.imageMaxWidth());
    }

    @Test
    @DisplayName("Credit guard: báo trạng thái guard và số byte có thể thu hồi")
    void creditGuardReportsStatus() {
        stubRegistry();
        when(cloudinary.usage()).thenReturn(Optional.of(new CloudinaryUsageService.Usage(
                "Pro", 1000L, 1000L, 0L, 0L, null, null, 95d, LocalDateTime.now())));
        when(guard.reclaimableBytes()).thenReturn(4096L);

        var info = service.creditGuard();

        assertTrue(info.enabled());
        assertEquals(90, info.threshold());
        assertEquals(100d, info.usedPercent());
        assertEquals(4096L, info.reclaimableBytes());
        assertTrue(info.active());
    }

    @Test
    @DisplayName("Free space: chạy credit guard và giải phóng dung lượng")
    void freeSpaceRunsGuard() {
        stubAdmin();
        stubRegistry();
        when(guard.run(true)).thenReturn(new CreditGuardService.GuardOutcome(
                true, 2, 2048L, 1, 95d, "Freed space"));

        var result = service.freeSpace(ADMIN);

        assertEquals(2, result.purged());
        assertEquals(2048L, result.freedBytes());
        assertEquals(1, result.trashed());
    }

    // ------------------------------------------------------------------ settings

    @Test
    @DisplayName("Settings: đọc cài đặt hiện tại")
    void settingsReturnsCurrentValues() {
        stubRegistry();
        when(cloudinary.usage()).thenReturn(Optional.empty());
        when(media.sumBytesOnDisk()).thenReturn(2048L);

        Settings settings = service.settings();

        assertEquals(50, settings.maxVideoMb());
        assertEquals(List.of("MP4", "WEBM"), settings.videoFormats());
        assertEquals(List.of("JPG", "PNG"), settings.imageFormats());
        assertEquals(14, settings.trashRetentionDays());
        assertEquals(50, settings.quotaGb());
        assertEquals(2048L, settings.usedBytes());
    }

    @Test
    @DisplayName("Cập nhật settings: lưu các giá trị hợp lệ")
    void updateSettingsStoresValidValues() {
        stubAdmin();
        stubRegistry();
        when(cloudinary.usage()).thenReturn(Optional.empty());
        when(media.sumBytesOnDisk()).thenReturn(0L);

        UpdateSettingsRequest request = new UpdateSettingsRequest(
                60, 6, List.of("mp4", "mov"), List.of("jpg"), 150, 250, 6,
                30, 24, 14, 7, true, false, 85, 50, 80, 95);

        Settings updated = service.updateSettings(ADMIN, request);

        assertEquals(60, updated.maxVideoMb());
        assertEquals(List.of("MP4", "MOV"), updated.videoFormats());
        assertEquals(List.of("JPG"), updated.imageFormats());
        assertEquals(250, updated.memberQuotaMb());
        verify(settingsRepository).save(any(StorageSettings.class));
    }

    @Test
    @DisplayName("Cập nhật settings: giá trị nằm ngoài khoảng cho phép -> 400")
    void updateSettingsRejectsOutOfRangeValues() {
        stubAdmin();
        UpdateSettingsRequest request = new UpdateSettingsRequest(
                5, 6, List.of("MP4"), List.of("JPG"), 150, 250, 6,
                30, 24, 14, 7, true, false, 85, 50, 80, 95);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.updateSettings(ADMIN, request));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Cập nhật settings: ngưỡng critical phải lớn hơn warning -> 400")
    void updateSettingsRejectsCriticalBelowWarning() {
        stubAdmin();
        UpdateSettingsRequest request = new UpdateSettingsRequest(
                60, 6, List.of("MP4"), List.of("JPG"), 150, 250, 6,
                30, 24, 14, 7, true, false, 85, 50, 90, 80);

        assertThrows(ResponseStatusException.class, () -> service.updateSettings(ADMIN, request));
    }

    @Test
    @DisplayName("Cập nhật settings: credit guard threshold phải lớn hơn critical -> 400")
    void updateSettingsRejectsGuardBelowCritical() {
        stubAdmin();
        UpdateSettingsRequest request = new UpdateSettingsRequest(
                60, 6, List.of("MP4"), List.of("JPG"), 150, 250, 6,
                30, 24, 14, 7, true, true, 90, 50, 80, 95);

        assertThrows(ResponseStatusException.class, () -> service.updateSettings(ADMIN, request));
    }

    @Test
    @DisplayName("Cập nhật settings: định dạng video không hỗ trợ -> 400")
    void updateSettingsRejectsUnsupportedFormat() {
        stubAdmin();
        UpdateSettingsRequest request = new UpdateSettingsRequest(
                60, 6, List.of("AVI"), List.of("JPG"), 150, 250, 6,
                30, 24, 14, 7, true, false, 85, 50, 80, 95);

        assertThrows(ResponseStatusException.class, () -> service.updateSettings(ADMIN, request));
    }

    @Test
    @DisplayName("Cập nhật settings: không có định dạng nào -> 400")
    void updateSettingsRejectsEmptyFormatList() {
        stubAdmin();
        UpdateSettingsRequest request = new UpdateSettingsRequest(
                60, 6, List.of(), List.of("JPG"), 150, 250, 6,
                30, 24, 14, 7, true, false, 85, 50, 80, 95);

        assertThrows(ResponseStatusException.class, () -> service.updateSettings(ADMIN, request));
    }

    @Test
    @DisplayName("Cập nhật settings: quota phải lớn hơn mức đang dùng -> 400")
    void updateSettingsRejectsQuotaBelowUsage() {
        stubAdmin();
        stubRegistry();
        when(cloudinary.usage()).thenReturn(Optional.empty());
        when(media.sumBytesOnDisk()).thenReturn(100L * 1024 * 1024 * 1024);

        UpdateSettingsRequest request = new UpdateSettingsRequest(
                60, 6, List.of("MP4"), List.of("JPG"), 150, 250, 6,
                30, 24, 14, 7, true, false, 85, 50, 80, 95);

        assertThrows(ResponseStatusException.class, () -> service.updateSettings(ADMIN, request));
    }

    @Test
    @DisplayName("Refresh usage: chụp snapshot và trả về overview")
    void refreshUsageTakesSnapshot() {
        stubAdmin();
        stubRegistry();
        when(media.sumBytesOnDisk()).thenReturn(0L);
        when(cloudinary.usage()).thenReturn(Optional.empty());
        when(media.usageByCategory()).thenReturn(List.of());
        when(media.usageBySource()).thenReturn(List.of());
        when(media.countByFileType()).thenReturn(List.of());
        when(media.sumBytesOnDiskAt(any(LocalDateTime.class))).thenReturn(0L);
        when(media.topMembers(any(Pageable.class))).thenReturn(List.of());
        when(media.countByStatus()).thenReturn(List.of());
        when(media.sumExpiringBy(any(LocalDateTime.class))).thenReturn(0L);
        when(cloudinary.consoleLinks()).thenReturn(new CloudinaryUsageService.ConsoleLinks(
                "lib", "usage", "upload", "plan"));
        when(cloudinary.isEnabled()).thenReturn(false);
        when(usageDaily.findByDayGreaterThanEqualOrderByDayAsc(any(LocalDate.class))).thenReturn(List.of());

        service.refreshUsage(ADMIN);

        verify(usageJob).snapshot();
    }

    private static void assertNotNullPurgeAt(TrashResult result) {
        assertTrue(result.purgeAt() != null);
    }
}
