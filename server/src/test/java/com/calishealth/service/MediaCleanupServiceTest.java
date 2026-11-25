package com.calishealth.service;

import com.calishealth.models.MediaFile;
import com.calishealth.models.StorageSettings;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.MediaFileRepository;
import com.calishealth.repository.StorageSettingsRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.service.ExerciseVideoStorageService.CloudFile;
import com.calishealth.service.ExerciseVideoStorageService.StoredFile;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Unit test cho {@link MediaCleanupService}. */
@ExtendWith(MockitoExtension.class)
class MediaCleanupServiceTest {
    @Mock private MediaFileRepository media;
    @Mock private StorageSettingsRepository settingsRepository;
    @Mock private MediaRegistryService registry;
    @Mock private ExerciseVideoStorageService storage;
    @Mock private ProfileAvatarStorageService avatars;
    @Mock private ExerciseRepository exercises;
    @Mock private UserRepository users;
    @Mock private JdbcTemplate jdbc;
    @InjectMocks private MediaCleanupService service;

    private static Path tempFile(String name) {
        try {
            Path path = java.nio.file.Files.createTempFile("calishealth-test-", name);
            java.nio.file.Files.writeString(path, "data");
            return path;
        } catch (java.io.IOException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static MediaFile file(Long id, String url, String status, String category) {
        MediaFile file = new MediaFile();
        file.setId(id);
        file.setFileUrl(url);
        file.setStatus(status);
        file.setCategory(category);
        file.setSizeBytes(1024);
        return file;
    }

    private static StorageSettings settings(int trashDays, int restoreDays, boolean autoCleanup) {
        StorageSettings settings = new StorageSettings();
        settings.setTrashRetentionDays(trashDays);
        settings.setRestoreGraceDays(restoreDays);
        settings.setAutoCleanupEnabled(autoCleanup);
        return settings;
    }

    // ---------------------------------------------------------------- trash

    @Test
    @DisplayName("trash: chuyen file ORPHANED vao thung rac")
    void trashMovesOrphanedFileToTrash() {
        MediaFile orphaned = file(1L, "https://cdn/a.mp4", MediaFile.ORPHANED, MediaFile.DEMO_VIDEO);
        when(registry.settings()).thenReturn(settings(7, 3, true));
        when(media.findAllByIdIn(List.of(1L))).thenReturn(List.of(orphaned));
        when(storage.folderOf("https://cdn/a.mp4")).thenReturn(Optional.of("calishealth/exercises"));
        when(storage.trashFolderFor("calishealth/exercises")).thenReturn("calishealth/trash/exercises");
        when(storage.moveToFolder(anyString(), anyString())).thenReturn(Optional.of("https://cdn/trash/a.mp4"));

        MediaCleanupService.TrashOutcome outcome = service.trash(List.of(1L), null);

        assertEquals(1, outcome.trashed().size());
        assertEquals(MediaFile.TRASHED, orphaned.getStatus());
        assertEquals(MediaFile.ORPHANED, orphaned.getPreviousStatus());
        assertNotNull(orphaned.getPurgeAt());
        assertEquals("https://cdn/trash/a.mp4", orphaned.getFileUrl());
    }

    @Test
    @DisplayName("trash: file ACTIVE khong duoc chuyen")
    void trashSkipsActiveFile() {
        when(registry.settings()).thenReturn(settings(7, 3, true));
        when(media.findAllByIdIn(List.of(1L))).thenReturn(List.of(file(1L, "u", MediaFile.ACTIVE, MediaFile.DEMO_VIDEO)));

        MediaCleanupService.TrashOutcome outcome = service.trash(List.of(1L), null);

        assertTrue(outcome.trashed().isEmpty());
        assertEquals(1, outcome.skipped());
    }

    @Test
    @DisplayName("trash: file khong co category -> bo qua")
    void trashSkipsFileWithoutCategory() {
        when(registry.settings()).thenReturn(settings(7, 3, true));
        when(media.findAllByIdIn(List.of(1L))).thenReturn(List.of(file(1L, "u", MediaFile.ORPHANED, null)));

        assertTrue(service.trash(List.of(1L), null).trashed().isEmpty());
    }

    @Test
    @DisplayName("trash: thoi gian giu = 0 -> xoa ngay")
    void trashPurgesImmediatelyWhenRetentionIsZero() {
        MediaFile orphaned = file(1L, "https://cdn/a.mp4", MediaFile.ORPHANED, MediaFile.DEMO_VIDEO);
        when(registry.settings()).thenReturn(settings(0, 3, true));
        when(media.findAllByIdIn(List.of(1L))).thenReturn(List.of(orphaned));
        when(registry.referenceState(anyString())).thenReturn("ORPHANED");
        when(storage.deleteFile("https://cdn/a.mp4")).thenReturn(true);

        MediaCleanupService.TrashOutcome outcome = service.trash(List.of(1L), null);

        assertTrue(outcome.trashed().isEmpty());
        assertEquals(1, outcome.purged().size());
        assertEquals(MediaFile.PURGED, orphaned.getStatus());
    }

    // --------------------------------------------------------------- restore

    @Test
    @DisplayName("restore: dua file ORPHANED ve trang thai truoc")
    void restoreBringsBackOrphanedFile() {
        MediaFile trashed = file(1L, "https://cdn/a.mp4", MediaFile.TRASHED, MediaFile.DEMO_VIDEO);
        trashed.setPreviousStatus(MediaFile.ORPHANED);
        trashed.setDeletableAt(LocalDateTime.now().plusDays(2));
        when(registry.settings()).thenReturn(settings(7, 3, true));
        when(media.findAllByIdIn(List.of(1L))).thenReturn(List.of(trashed));
        when(storage.restoreFromTrash("https://cdn/a.mp4")).thenReturn(Optional.of("https://cdn/a.mp4"));

        List<MediaFile> restored = service.restore(List.of(1L));

        assertEquals(1, restored.size());
        assertEquals(MediaFile.ORPHANED, trashed.getStatus());
        assertNull(trashed.getPreviousStatus());
        assertNull(trashed.getPurgeAt());
    }

    @Test
    @DisplayName("restore: file ACTIVE truoc do -> khong dat han xoa")
    void restoreClearsDeletableForActiveFile() {
        MediaFile trashed = file(1L, "https://cdn/a.mp4", MediaFile.TRASHED, MediaFile.DEMO_VIDEO);
        trashed.setPreviousStatus(MediaFile.ACTIVE);
        trashed.setDeletableAt(LocalDateTime.now().plusDays(2));
        when(registry.settings()).thenReturn(settings(7, 3, true));
        when(media.findAllByIdIn(List.of(1L))).thenReturn(List.of(trashed));
        when(storage.restoreFromTrash("https://cdn/a.mp4")).thenReturn(Optional.of("https://cdn/a.mp4"));

        service.restore(List.of(1L));

        assertNull(trashed.getDeletableAt());
    }

    @Test
    @DisplayName("restore: khong co previousStatus -> coi nhu ORPHANED")
    void restoreDefaultsPreviousStatusToOrphaned() {
        MediaFile trashed = file(1L, "https://cdn/a.mp4", MediaFile.TRASHED, MediaFile.DEMO_VIDEO);
        when(registry.settings()).thenReturn(settings(7, 3, true));
        when(media.findAllByIdIn(List.of(1L))).thenReturn(List.of(trashed));
        when(storage.restoreFromTrash("https://cdn/a.mp4")).thenReturn(Optional.of("https://cdn/a.mp4"));

        service.restore(List.of(1L));

        assertEquals(MediaFile.ORPHANED, trashed.getStatus());
    }

    @Test
    @DisplayName("restore: file da thay doi duong dan tren cloudinary -> cap nhat lien ket")
    void restoreUpdatesChangedCloudinaryUrl() {
        MediaFile trashed = file(1L, "https://cdn/trash/a.mp4", MediaFile.TRASHED, MediaFile.DEMO_VIDEO);
        trashed.setPreviousStatus(MediaFile.ORPHANED);
        when(registry.settings()).thenReturn(settings(7, 3, true));
        when(media.findAllByIdIn(List.of(1L))).thenReturn(List.of(trashed));
        when(storage.restoreFromTrash("https://cdn/trash/a.mp4")).thenReturn(Optional.of("https://cdn/a.mp4"));

        service.restore(List.of(1L));

        assertEquals("https://cdn/a.mp4", trashed.getFileUrl());
        verify(jdbc).update("UPDATE exercises SET video_url = ? WHERE video_url = ?",
                "https://cdn/a.mp4", "https://cdn/trash/a.mp4");
    }

    @Test
    @DisplayName("restore: file khong co duong dan -> bo qua cloudinary")
    void restoreHandlesNullUrl() {
        MediaFile trashed = file(1L, null, MediaFile.TRASHED, MediaFile.DEMO_VIDEO);
        trashed.setPreviousStatus(MediaFile.ORPHANED);
        when(registry.settings()).thenReturn(settings(7, 3, true));
        when(media.findAllByIdIn(List.of(1L))).thenReturn(List.of(trashed));

        assertEquals(1, service.restore(List.of(1L)).size());
    }

    @Test
    @DisplayName("restore: file khong o trong thung rac -> bo qua")
    void restoreSkipsNonTrashedFiles() {
        when(registry.settings()).thenReturn(settings(7, 3, true));
        when(media.findAllByIdIn(List.of(1L)))
                .thenReturn(List.of(file(1L, "u", MediaFile.ACTIVE, MediaFile.DEMO_VIDEO)));

        assertTrue(service.restore(List.of(1L)).isEmpty());
    }

    // --------------------------------------------------------------- extend

    @Test
    @DisplayName("extend: keo dai thoi gian cho file ORPHANED")
    void extendPushesDeletableDate() {
        MediaFile orphaned = file(1L, "u", MediaFile.ORPHANED, MediaFile.DEMO_VIDEO);
        orphaned.setDeletableAt(LocalDateTime.now().plusDays(1));
        when(media.findById(1L)).thenReturn(Optional.of(orphaned));

        MediaFile result = service.extend(1L, 5);

        assertTrue(result.getDeletableAt().isAfter(LocalDateTime.now().plusDays(5)));
    }

    @Test
    @DisplayName("extend: file REJECTED cung duoc keo dai")
    void extendWorksOnRejectedFile() {
        MediaFile rejected = file(1L, "u", MediaFile.REJECTED, MediaFile.DEMO_VIDEO);
        when(media.findById(1L)).thenReturn(Optional.of(rejected));

        assertNotNull(service.extend(1L, 3).getDeletableAt());
    }

    @Test
    @DisplayName("extend: file khong ton tai -> 404")
    void extendRejectsUnknownFile() {
        when(media.findById(99L)).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.extend(99L, 3));
        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
    }

    @Test
    @DisplayName("extend: file khong co category -> 404")
    void extendRejectsFileWithoutCategory() {
        when(media.findById(1L)).thenReturn(Optional.of(file(1L, "u", MediaFile.ORPHANED, null)));

        assertThrows(ResponseStatusException.class, () -> service.extend(1L, 3));
    }

    @Test
    @DisplayName("extend: file ACTIVE -> 409")
    void extendRejectsActiveFile() {
        when(media.findById(1L)).thenReturn(Optional.of(file(1L, "u", MediaFile.ACTIVE, MediaFile.DEMO_VIDEO)));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.extend(1L, 3));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    // ---------------------------------------------------------------- purge

    @Test
    @DisplayName("purge: xoa file trong thung rac")
    void purgeRemovesTrashedFiles() {
        MediaFile trashed = file(1L, "https://cdn/a.mp4", MediaFile.TRASHED, MediaFile.DEMO_VIDEO);
        when(media.findAllByIdIn(List.of(1L))).thenReturn(List.of(trashed));
        when(registry.referenceState("https://cdn/a.mp4")).thenReturn("ORPHANED");
        when(storage.deleteFile("https://cdn/a.mp4")).thenReturn(true);

        MediaCleanupService.PurgeOutcome outcome = service.purge(List.of(1L));

        assertEquals(1, outcome.purged().size());
        assertEquals(1024, outcome.freedBytes());
        assertEquals(MediaFile.PURGED, trashed.getStatus());
    }

    @Test
    @DisplayName("purge: file dang duoc dung -> kich hoat lai")
    void purgeReactivatesReferencedFile() {
        MediaFile trashed = file(1L, "https://cdn/a.mp4", MediaFile.TRASHED, MediaFile.DEMO_VIDEO);
        when(media.findAllByIdIn(List.of(1L))).thenReturn(List.of(trashed));
        when(registry.referenceState("https://cdn/a.mp4")).thenReturn("ACTIVE");

        MediaCleanupService.PurgeOutcome outcome = service.purge(List.of(1L));

        assertTrue(outcome.purged().isEmpty());
        verify(registry).activate(trashed);
        verify(storage, never()).deleteFile(anyString());
    }

    @Test
    @DisplayName("purge: khong xoa duoc file -> bo qua")
    void purgeSkipsFilesThatCannotBeRemoved() {
        MediaFile trashed = file(1L, "https://cdn/a.mp4", MediaFile.TRASHED, MediaFile.DEMO_VIDEO);
        when(media.findAllByIdIn(List.of(1L))).thenReturn(List.of(trashed));
        when(registry.referenceState("https://cdn/a.mp4")).thenReturn("ORPHANED");
        when(storage.deleteFile("https://cdn/a.mp4")).thenReturn(false);

        MediaCleanupService.PurgeOutcome outcome = service.purge(List.of(1L));

        assertTrue(outcome.purged().isEmpty());
        assertEquals(1, outcome.skipped());
    }

    @Test
    @DisplayName("purge: file avatar duoc xoa qua kho avatar")
    void purgeRemovesProfileAvatar() {
        MediaFile avatar = file(1L, ProfileAvatarStorageService.URL_PREFIX + "a.png", MediaFile.TRASHED,
                MediaFile.PROFILE_AVATAR);
        when(media.findAllByIdIn(List.of(1L))).thenReturn(List.of(avatar));
        when(registry.referenceState(anyString())).thenReturn("ORPHANED");

        MediaCleanupService.PurgeOutcome outcome = service.purge(List.of(1L));

        assertEquals(1, outcome.purged().size());
        verify(avatars).delete(ProfileAvatarStorageService.URL_PREFIX + "a.png");
    }

    @Test
    @DisplayName("purge: file khong o trong thung rac -> bo qua")
    void purgeSkipsNonTrashedFiles() {
        when(media.findAllByIdIn(List.of(1L)))
                .thenReturn(List.of(file(1L, "u", MediaFile.ACTIVE, MediaFile.DEMO_VIDEO)));

        assertTrue(service.purge(List.of(1L)).purged().isEmpty());
    }

    @Test
    @DisplayName("emptyTrash: xoa toan bo thung rac")
    void emptyTrashRemovesEverything() {
        MediaFile trashed = file(1L, "https://cdn/a.mp4", MediaFile.TRASHED, MediaFile.DEMO_VIDEO);
        when(media.findAllByStatus(MediaFile.TRASHED)).thenReturn(List.of(trashed));
        when(registry.referenceState("https://cdn/a.mp4")).thenReturn("ORPHANED");
        when(storage.deleteFile("https://cdn/a.mp4")).thenReturn(true);

        assertEquals(1, service.emptyTrash().purged().size());
    }

    // ------------------------------------------------------------- runDaily

    @Test
    @DisplayName("runDaily: auto cleanup tat -> chi doi so lieu")
    void runDailyWithoutAutoCleanup() {
        when(registry.settings()).thenReturn(settings(7, 3, false));
        lenient().when(media.findAllByCategoryIsNotNullAndStatusNot(anyString())).thenReturn(List.of());
        lenient().when(exercises.findMediaReferences()).thenReturn(List.of());
        lenient().when(storage.listStoredFiles()).thenReturn(List.of());
        lenient().when(storage.listCloudinaryFiles()).thenReturn(Optional.empty());

        MediaCleanupService.CleanupRun run = service.runDaily();

        assertEquals(0, run.trashed());
        assertEquals(0, run.purged());
        assertEquals(0, run.freedBytes());
        verify(settingsRepository, never()).save(any(StorageSettings.class));
    }

    @Test
    @DisplayName("runDaily: file het han chuyen vao thung rac")
    void runDailyTrashesExpiredFiles() {
        StorageSettings settings = settings(7, 3, true);
        MediaFile expired = file(1L, "https://cdn/a.mp4", MediaFile.ORPHANED, MediaFile.DEMO_VIDEO);
        when(registry.settings()).thenReturn(settings);
        when(media.findAllByCategoryIsNotNullAndStatusNot(anyString())).thenReturn(List.of());
        when(exercises.findMediaReferences()).thenReturn(List.of());
        when(storage.listStoredFiles()).thenReturn(List.of());
        when(storage.listCloudinaryFiles()).thenReturn(Optional.empty());
        when(media.findExpiredInactive(any(LocalDateTime.class))).thenReturn(List.of(expired));
        when(media.findTrashDue(any(LocalDateTime.class))).thenReturn(List.of());
        when(storage.folderOf("https://cdn/a.mp4")).thenReturn(Optional.empty());
        when(storage.trashFolderForCategory(MediaFile.DEMO_VIDEO)).thenReturn("calishealth/trash/demo");
        when(storage.moveToFolder(anyString(), anyString())).thenReturn(Optional.of("https://cdn/a.mp4"));
        lenient().when(settingsRepository.save(any(StorageSettings.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        MediaCleanupService.CleanupRun run = service.runDaily();

        assertEquals(1, run.trashed());
        assertEquals(MediaFile.TRASHED, expired.getStatus());
    }

    @Test
    @DisplayName("runDaily: giu rac = 0 -> xoa luon file het han")
    void runDailyPurgesExpiredFilesWhenRetentionIsZero() {
        StorageSettings settings = settings(0, 3, true);
        MediaFile expired = file(1L, "https://cdn/a.mp4", MediaFile.ORPHANED, MediaFile.DEMO_VIDEO);
        when(registry.settings()).thenReturn(settings);
        when(media.findAllByCategoryIsNotNullAndStatusNot(anyString())).thenReturn(List.of());
        when(exercises.findMediaReferences()).thenReturn(List.of());
        when(storage.listStoredFiles()).thenReturn(List.of());
        when(storage.listCloudinaryFiles()).thenReturn(Optional.empty());
        when(media.findExpiredInactive(any(LocalDateTime.class))).thenReturn(List.of(expired));
        when(media.findTrashDue(any(LocalDateTime.class))).thenReturn(List.of());
        when(registry.referenceState("https://cdn/a.mp4")).thenReturn("ORPHANED");
        when(storage.deleteFile("https://cdn/a.mp4")).thenReturn(true);
        lenient().when(settingsRepository.save(any(StorageSettings.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        MediaCleanupService.CleanupRun run = service.runDaily();

        assertEquals(0, run.trashed());
        assertEquals(1, run.purged());
        assertEquals(1024, run.freedBytes());
    }

    @Test
    @DisplayName("runDaily: file trong thung rac den han -> xoa")
    void runDailyPurgesTrashDueFiles() {
        StorageSettings settings = settings(7, 3, true);
        MediaFile due = file(1L, "https://cdn/a.mp4", MediaFile.TRASHED, MediaFile.DEMO_VIDEO);
        when(registry.settings()).thenReturn(settings);
        when(media.findAllByCategoryIsNotNullAndStatusNot(anyString())).thenReturn(List.of());
        when(exercises.findMediaReferences()).thenReturn(List.of());
        when(storage.listStoredFiles()).thenReturn(List.of());
        when(storage.listCloudinaryFiles()).thenReturn(Optional.empty());
        when(media.findExpiredInactive(any(LocalDateTime.class))).thenReturn(List.of());
        when(media.findTrashDue(any(LocalDateTime.class))).thenReturn(List.of(due));
        when(registry.referenceState("https://cdn/a.mp4")).thenReturn("ORPHANED");
        when(storage.deleteFile("https://cdn/a.mp4")).thenReturn(true);
        lenient().when(settingsRepository.save(any(StorageSettings.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        assertEquals(1, service.runDaily().purged());
    }

    // ------------------------------------------------------------ reconcile

    @Test
    @DisplayName("reconcile: dang ky file moi tren dia")
    void reconcileRegistersNewDiskFiles() throws Exception {
        StoredFile stored = new StoredFile("https://cdn/new.mp4", tempFile("new.mp4"), MediaFile.DEMO_VIDEO);
        when(media.findAllByCategoryIsNotNullAndStatusNot(anyString())).thenReturn(List.of());
        when(exercises.findMediaReferences()).thenReturn(List.of());
        when(storage.listStoredFiles()).thenReturn(List.of(stored));
        when(storage.listCloudinaryFiles()).thenReturn(Optional.empty());
        when(storage.hash(any(Path.class))).thenReturn("hash");
        when(registry.register(anyString(), any(), anyLong(), anyString(), anyString(), anyString(), any(), any()))
                .thenReturn(file(9L, "https://cdn/new.mp4", MediaFile.ORPHANED, MediaFile.DEMO_VIDEO));

        service.reconcile();

        verify(registry).register(anyString(), any(), anyLong(), anyString(), anyString(), anyString(), any(), any());
    }

    @Test
    @DisplayName("reconcile: file bi xoa khoi dia -> danh dau PURGED")
    void reconcileMarksMissingDiskFileAsPurged() {
        MediaFile row = file(1L, "https://cdn/a.mp4", MediaFile.ACTIVE, MediaFile.DEMO_VIDEO);
        when(media.findAllByCategoryIsNotNullAndStatusNot(anyString())).thenReturn(List.of(row));
        when(exercises.findMediaReferences()).thenReturn(List.of());
        when(storage.listStoredFiles()).thenReturn(List.of());
        when(storage.listCloudinaryFiles()).thenReturn(Optional.empty());
        when(storage.resolve("https://cdn/a.mp4")).thenReturn(Optional.of(Path.of("C:/tmp/a.mp4")));
        when(storage.cloudinaryKey("https://cdn/a.mp4")).thenReturn(Optional.empty());

        service.reconcile();

        assertEquals(MediaFile.PURGED, row.getStatus());
        assertEquals("File missing from storage", row.getReason());
        assertNotNull(row.getPurgedAt());
    }

    @Test
    @DisplayName("reconcile: file khong con tham chieu -> ORPHANED")
    void reconcileAppliesOrphanedState() {
        MediaFile row = file(1L, "https://cdn/a.mp4", MediaFile.ACTIVE, MediaFile.DEMO_VIDEO);
        when(media.findAllByCategoryIsNotNullAndStatusNot(anyString())).thenReturn(List.of(row));
        when(exercises.findMediaReferences()).thenReturn(List.of());
        when(storage.listStoredFiles()).thenReturn(List.of());
        when(storage.listCloudinaryFiles()).thenReturn(Optional.empty());
        when(storage.resolve("https://cdn/a.mp4")).thenReturn(Optional.empty());
        when(storage.cloudinaryKey("https://cdn/a.mp4")).thenReturn(Optional.empty());

        service.reconcile();

        verify(registry).applyReferenceState(eq(row), org.mockito.ArgumentMatchers.isNull(), anyString(), any(LocalDateTime.class));
    }

    @Test
    @DisplayName("reconcile: file dang o thung rac nhung bai tap dung -> kich hoat lai")
    void reconcileReactivatesTrashedButUsedFile() {
        MediaFile row = file(1L, "https://cdn/a.mp4", MediaFile.TRASHED, MediaFile.DEMO_VIDEO);
        when(media.findAllByCategoryIsNotNullAndStatusNot(anyString())).thenReturn(List.of(row));
        when(exercises.findMediaReferences()).thenReturn(List.<Object[]>of(
                new Object[]{"https://cdn/a.mp4", null, "APPROVED", null}));
        when(storage.listStoredFiles()).thenReturn(List.of());
        when(storage.listCloudinaryFiles()).thenReturn(Optional.empty());
        when(storage.resolve("https://cdn/a.mp4")).thenReturn(Optional.empty());
        when(storage.cloudinaryKey("https://cdn/a.mp4")).thenReturn(Optional.empty());

        service.reconcile();

        verify(registry).activate(row);
    }

    @Test
    @DisplayName("reconcile: tham chieu DELETED duoc bo qua")
    void reconcileSkipsDeletedReferences() {
        MediaFile row = file(1L, "https://cdn/a.mp4", MediaFile.ACTIVE, MediaFile.DEMO_VIDEO);
        when(media.findAllByCategoryIsNotNullAndStatusNot(anyString())).thenReturn(List.of(row));
        when(exercises.findMediaReferences()).thenReturn(List.<Object[]>of(
                new Object[]{"https://cdn/a.mp4", null, "DELETED", null}));
        when(storage.listStoredFiles()).thenReturn(List.of());
        when(storage.listCloudinaryFiles()).thenReturn(Optional.empty());
        when(storage.resolve("https://cdn/a.mp4")).thenReturn(Optional.empty());
        when(storage.cloudinaryKey("https://cdn/a.mp4")).thenReturn(Optional.empty());

        service.reconcile();

        verify(registry).applyReferenceState(eq(row), org.mockito.ArgumentMatchers.isNull(), anyString(), any(LocalDateTime.class));
    }

    @Test
    @DisplayName("reconcile: file tren cloudinary chua co dong -> dang ky")
    void reconcileRegistersCloudinaryFiles() {
        CloudFile cloud = new CloudFile("key1", "https://cdn/cloud.mp4", 2048, "mp4",
                MediaFile.DEMO_VIDEO, LocalDateTime.now().minusDays(2), null);
        when(media.findAllByCategoryIsNotNullAndStatusNot(anyString())).thenReturn(List.of());
        when(exercises.findMediaReferences()).thenReturn(List.of());
        when(storage.listStoredFiles()).thenReturn(List.of());
        when(storage.listCloudinaryFiles()).thenReturn(Optional.of(Map.of("key1", cloud)));
        when(registry.register(anyString(), any(), anyLong(), anyString(), anyString(), any(), any(), any(), any()))
                .thenReturn(file(9L, "https://cdn/cloud.mp4", MediaFile.ORPHANED, MediaFile.DEMO_VIDEO));

        service.reconcile();

        verify(registry).register(anyString(), any(), anyLong(), anyString(), anyString(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("reconcile: file cloudinary moi tai -> bo qua")
    void reconcileSkipsFreshCloudinaryFiles() {
        CloudFile cloud = new CloudFile("key1", "https://cdn/cloud.mp4", 2048, "mp4",
                MediaFile.DEMO_VIDEO, LocalDateTime.now(), null);
        when(media.findAllByCategoryIsNotNullAndStatusNot(anyString())).thenReturn(List.of());
        when(exercises.findMediaReferences()).thenReturn(List.of());
        when(storage.listStoredFiles()).thenReturn(List.of());
        when(storage.listCloudinaryFiles()).thenReturn(Optional.of(Map.of("key1", cloud)));

        service.reconcile();

        verify(registry, never()).register(anyString(), any(), anyLong(), anyString(), anyString(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("reconcile: file da bi xoa tren cloudinary -> danh dau PURGED")
    void reconcileMarksMissingCloudinaryFileAsPurged() {
        MediaFile row = file(1L, "https://cdn/a.mp4", MediaFile.ACTIVE, MediaFile.DEMO_VIDEO);
        row.setUploadedAt(LocalDateTime.now().minusDays(2));
        when(media.findAllByCategoryIsNotNullAndStatusNot(anyString())).thenReturn(List.of(row));
        when(exercises.findMediaReferences()).thenReturn(List.of());
        when(storage.listStoredFiles()).thenReturn(List.of());
        when(storage.listCloudinaryFiles()).thenReturn(Optional.of(Map.of()));
        when(storage.resolve("https://cdn/a.mp4")).thenReturn(Optional.empty());
        when(storage.cloudinaryKey("https://cdn/a.mp4")).thenReturn(Optional.of("key1"));

        service.reconcile();

        assertEquals(MediaFile.PURGED, row.getStatus());
        verify(jdbc).update("UPDATE exercises SET video_url = NULL WHERE video_url = ?", "https://cdn/a.mp4");
    }

    @Test
    @DisplayName("reconcile: file dang duoc dung boi member -> gan nguoi tai len")
    void reconcileAssignsUploaderFromReferences() throws Exception {
        User member = new User();
        member.setId(5L);
        member.setRole(UserRole.MEMBER);
        StoredFile stored = new StoredFile("https://cdn/new.mp4", tempFile("new.mp4"), MediaFile.DEMO_VIDEO);
        when(media.findAllByCategoryIsNotNullAndStatusNot(anyString())).thenReturn(List.of());
        when(exercises.findMediaReferences()).thenReturn(List.<Object[]>of(
                new Object[]{"https://cdn/new.mp4", null, "APPROVED", 5L}));
        when(storage.listStoredFiles()).thenReturn(List.of(stored));
        when(storage.listCloudinaryFiles()).thenReturn(Optional.empty());
        when(storage.hash(any(Path.class))).thenReturn("hash");
        when(users.findById(5L)).thenReturn(Optional.of(member));
        when(registry.register(anyString(), any(), anyLong(), anyString(), anyString(), anyString(), any(), any()))
                .thenReturn(file(9L, "https://cdn/new.mp4", MediaFile.ORPHANED, MediaFile.DEMO_VIDEO));

        service.reconcile();

        verify(registry).register(anyString(), any(), anyLong(), anyString(), anyString(), anyString(), eq(member), any());
    }

    @Test
    @DisplayName("reconcile: nguoi tai la staff -> khong gan")
    void reconcileIgnoresStaffUploader() throws Exception {
        User admin = new User();
        admin.setId(5L);
        admin.setRole(UserRole.ADMIN);
        StoredFile stored = new StoredFile("https://cdn/new.mp4", tempFile("new.mp4"), MediaFile.DEMO_VIDEO);
        when(media.findAllByCategoryIsNotNullAndStatusNot(anyString())).thenReturn(List.of());
        when(exercises.findMediaReferences()).thenReturn(List.<Object[]>of(
                new Object[]{"https://cdn/new.mp4", null, "APPROVED", 5L}));
        when(storage.listStoredFiles()).thenReturn(List.of(stored));
        when(storage.listCloudinaryFiles()).thenReturn(Optional.empty());
        when(storage.hash(any(Path.class))).thenReturn("hash");
        when(users.findById(5L)).thenReturn(Optional.of(admin));
        when(registry.register(anyString(), any(), anyLong(), anyString(), anyString(), anyString(), any(), any()))
                .thenReturn(file(9L, "https://cdn/new.mp4", MediaFile.ORPHANED, MediaFile.DEMO_VIDEO));

        service.reconcile();

        verify(registry).register(anyString(), any(), anyLong(), anyString(), anyString(), anyString(), org.mockito.ArgumentMatchers.isNull(), any());
    }

    @Test
    @DisplayName("reconcile: khong co file nao -> khong lam gi")
    void reconcileWithNoFiles() {
        when(media.findAllByCategoryIsNotNullAndStatusNot(anyString())).thenReturn(List.of());
        when(exercises.findMediaReferences()).thenReturn(List.of());
        when(storage.listStoredFiles()).thenReturn(List.of());
        when(storage.listCloudinaryFiles()).thenReturn(Optional.empty());

        service.reconcile();

        verify(registry, never()).activate(any());
        assertFalse(false);
    }
}
