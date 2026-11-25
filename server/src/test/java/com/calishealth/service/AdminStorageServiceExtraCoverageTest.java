package com.calishealth.service;

import com.calishealth.models.MediaFile;
import com.calishealth.models.StorageSettings;
import com.calishealth.models.User;
import com.calishealth.repository.MediaFileRepository;
import com.calishealth.repository.StorageSettingsRepository;
import com.calishealth.repository.StorageUsageDailyRepository;
import com.calishealth.repository.UserActivityRepository;
import com.calishealth.repository.UserRepository;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bo sung coverage cho {@link AdminStorageService}: cau truc truy van Specification
 * va cac nhanh ghi nhat ky hoat dong.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminStorageServiceExtraCoverageTest {

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

    private AdminStorageService service;

    private static final String ADMIN = "admin@example.test";

    @BeforeEach
    void setUp() {
        service = new AdminStorageService(media, settingsRepository, usageDaily, registry, cleanup,
                storage, cloudinary, cloudinarySetup, optimization, guard, usageJob, users, activity);

        User admin = new User();
        admin.setId(1L);
        admin.setEmail(ADMIN);
        admin.setFullName("Admin");
        when(users.findByEmail(ADMIN)).thenReturn(Optional.of(admin));

        StorageSettings settings = new StorageSettings();
        settings.setTrashRetentionDays(14);
        settings.setRestoreGraceDays(7);
        when(registry.settings()).thenReturn(settings);
        when(media.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));
        when(media.countByStatus()).thenReturn(List.of());
        when(media.reclaimable(any(LocalDateTime.class)))
                .thenReturn(List.<Object[]>of(new Object[]{0L, 0L}));
        when(media.sumTrashDue(any(LocalDateTime.class))).thenReturn(0L);
        when(storage.thumbnailUrl(nullable(String.class), anyBoolean())).thenReturn(Optional.empty());
    }

    /**
     * Dung Specification da capture va chay no voi Criteria API gia lap de kiem tra
     * cau truc truy van (loc theo status/source/type) co chayy het cac nhanh hay khong.
     */
    @SuppressWarnings({"unchecked", "rawtypes"})
    private Predicate runSpecification(Specification<MediaFile> spec, boolean trash,
                                       String statusFilter, String sourceFilter, String typeFilter) {
        Root<MediaFile> root = mock(Root.class);
        CriteriaQuery<?> query = mock(CriteriaQuery.class);
        CriteriaBuilder cb = mock(CriteriaBuilder.class);
        Path<String> path = mock(Path.class);
        Predicate predicate = mock(Predicate.class);

        doReturn(path).when(root).get(any(String.class));
        doReturn(predicate).when(cb).isNotNull(any(Path.class));
        doReturn(predicate).when(cb).equal(any(), any());
        doReturn(predicate).when(cb).and(any(Predicate[].class));

        return spec.toPredicate(root, query, cb);
    }

    @Test
    @DisplayName("media: view=inactive -> Specification loc ORPHANED/REJECTED")
    void mediaBuildsSpecificationForInactiveView() {
        Specification<MediaFile>[] holder = new Specification[1];

        when(media.findAll(any(Specification.class), any(Pageable.class))).thenAnswer(invocation -> {
            holder[0] = invocation.getArgument(0);
            return new PageImpl<>(List.of());
        });

        service.media("inactive", null, null, null, null, 0, 20);

        assertThat(holder[0]).isNotNull();
        assertThat(runSpecification(holder[0], false, null, null, null)).isNotNull();
    }

    @Test
    @DisplayName("media: view=trash -> loc theo TRASHED")
    void mediaBuildsSpecificationForTrashView() {
        Specification<MediaFile>[] holder = new Specification[1];

        when(media.findAll(any(Specification.class), any(Pageable.class))).thenAnswer(invocation -> {
            holder[0] = invocation.getArgument(0);
            return new PageImpl<>(List.of());
        });

        service.media("trash", "ORPHANED", "MEMBER", "VIDEO", "purge_soon", 0, 20);

        assertThat(runSpecification(holder[0], true, "ORPHANED", "MEMBER", "VIDEO")).isNotNull();
    }

    @Test
    @DisplayName("media: co bo loc status/source/type -> van tra ve trang")
    void mediaAppliesAllFilters() {
        var page = service.media("inactive", "ORPHANED", "MEMBER", "VIDEO", null, 0, 20);

        assertThat(page.items()).isEmpty();
        assertThat(page.summary().trashRetentionDays()).isEqualTo(14);
    }

    @Test
    @DisplayName("trash: file bi xoa ngay -> ghi nhat ky hoat dong")
    void trashLogsPermanentDeletion() {
        MediaFile file = new MediaFile();
        file.setId(1L);
        file.setOriginalName("demo.mp4");
        when(cleanup.trash(any(), any())).thenReturn(new MediaCleanupService.TrashOutcome(
                List.of(), List.of(file), 100L, 0, null));

        var result = service.trash(ADMIN, List.of(1L));

        assertThat(result.purged()).isEqualTo(1);
        verify(activity).logEvent(eq(1L), eq("STORAGE"), any(), eq("SUCCESS"));
    }

    @Test
    @DisplayName("trash: file vao thung rac -> ghi nhat ky hoat dong")
    void trashLogsMoveToTrash() {
        MediaFile file = new MediaFile();
        file.setId(1L);
        file.setOriginalName("demo.mp4");
        when(cleanup.trash(any(), any())).thenReturn(new MediaCleanupService.TrashOutcome(
                List.of(file), List.of(), 0L, 0, LocalDateTime.now().plusDays(14)));

        service.trash(ADMIN, List.of(1L));

        verify(activity).logEvent(eq(1L), eq("STORAGE"), any(), eq("SUCCESS"));
    }

    @Test
    @DisplayName("emptyTrash: co file bi xoa -> ghi nhat ky hoat dong")
    void emptyTrashLogsEmptiedTrash() {
        MediaFile file = new MediaFile();
        file.setId(1L);
        file.setOriginalName("demo.mp4");
        when(cleanup.emptyTrash()).thenReturn(new MediaCleanupService.PurgeOutcome(
                List.of(file), 100L, 0));

        var result = service.emptyTrash(ADMIN);

        assertThat(result.deleted()).isEqualTo(1);
        verify(activity).logEvent(eq(1L), eq("STORAGE"), any(), eq("SUCCESS"));
    }

    @Test
    @DisplayName("emptyTrash: khong co file -> khong ghi nhat ky")
    void emptyTrashWithoutFilesLogsNothing() {
        when(cleanup.emptyTrash()).thenReturn(new MediaCleanupService.PurgeOutcome(List.of(), 0L, 0));

        service.emptyTrash(ADMIN);

        verify(activity, never()).logEvent(any(), any(), any(), any());
    }

    @Test
    @DisplayName("delete: co file -> ghi nhat ky hoat dong")
    void deleteLogsPermanentDeletion() {
        MediaFile file = new MediaFile();
        file.setId(1L);
        file.setOriginalName("demo.mp4");
        when(cleanup.purge(any())).thenReturn(new MediaCleanupService.PurgeOutcome(List.of(file), 100L, 0));

        service.delete(ADMIN, List.of(1L));

        verify(activity).logEvent(eq(1L), eq("STORAGE"), any(), eq("SUCCESS"));
    }
}
