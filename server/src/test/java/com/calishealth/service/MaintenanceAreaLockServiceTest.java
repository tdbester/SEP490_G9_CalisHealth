package com.calishealth.service;

import com.calishealth.dtos.MaintenanceAreaLockResponseDto;
import com.calishealth.models.AffectedArea;
import com.calishealth.models.MaintenanceAreaLock;
import com.calishealth.repository.MaintenanceAreaLockRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

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

/**
 * Bộ test cho {@link MaintenanceAreaLockService}: khoá / mở khoá theo từng khu vực dịch vụ.
 */
class MaintenanceAreaLockServiceTest {

    private MaintenanceAreaLockRepository locks;
    private MaintenanceAreaLockService service;

    @BeforeEach
    void setUp() {
        locks = mock(MaintenanceAreaLockRepository.class);
        service = new MaintenanceAreaLockService(locks);
    }

    private MaintenanceAreaLock lock(String area, boolean locked) {
        MaintenanceAreaLock lock = new MaintenanceAreaLock();
        lock.setId(1L);
        lock.setArea(area);
        lock.setLocked(locked);
        lock.setLockedAt(LocalDateTime.now());
        return lock;
    }

    @Test
    @DisplayName("isAreaLocked: co ban ghi -> tra ve trang thai")
    void isAreaLockedReadsStoredState() {
        when(locks.findByArea("MEMBER_APP_ACCESS")).thenReturn(Optional.of(lock("MEMBER_APP_ACCESS", true)));

        assertThat(service.isAreaLocked("MEMBER_APP_ACCESS")).isTrue();
    }

    @Test
    @DisplayName("isAreaLocked: khong co ban ghi -> false")
    void isAreaLockedDefaultsToFalse() {
        when(locks.findByArea("MEMBER_APP_ACCESS")).thenReturn(Optional.empty());

        assertThat(service.isAreaLocked("MEMBER_APP_ACCESS")).isFalse();
    }

    @Test
    @DisplayName("getLockStatusByArea: tra ve trang thai tat ca khu vuc")
    void lockStatusCoversEveryArea() {
        when(locks.findByArea(any())).thenReturn(Optional.empty());

        var status = service.getLockStatusByArea();

        assertThat(status).hasSize(AffectedArea.values().length);
        assertThat(status).containsEntry("MEMBER_APP_ACCESS", false);
        assertThat(status).containsEntry("ADMIN_MANAGEMENT_PORTAL", false);
    }

    @Test
    @DisplayName("getLocks: tra ve danh sach khoa theo thu tu")
    void getLocksReturnsAll() {
        when(locks.findAllByOrderByAreaAsc()).thenReturn(List.of(
                lock("MEMBER_APP_ACCESS", true),
                lock("SYSTEM_STORAGE_CDN", false)));

        List<MaintenanceAreaLockResponseDto> result = service.getLocks();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).area()).isEqualTo("MEMBER_APP_ACCESS");
        assertThat(result.get(0).locked()).isTrue();
        assertThat(result.get(0).lockedAt()).isNotNull();
        assertThat(result.get(0).unlockedAt()).isNull();
        assertThat(result.get(1).locked()).isFalse();
    }

    @Test
    @DisplayName("setLock: khoa vung moi -> tao ban ghi")
    void setLockCreatesRecord() {
        when(locks.findByArea("MEMBER_APP_ACCESS")).thenReturn(Optional.empty());
        when(locks.save(any(MaintenanceAreaLock.class))).thenAnswer(i -> i.getArgument(0));

        MaintenanceAreaLockResponseDto result =
                service.setLock("MEMBER_APP_ACCESS", "LOCKED", "  Server upgrade  ");

        assertThat(result.locked()).isTrue();
        assertThat(result.reason()).isEqualTo("Server upgrade");
        assertThat(result.lockedAt()).isNotNull();
        verify(locks).save(any(MaintenanceAreaLock.class));
    }

    @Test
    @DisplayName("setLock: mo khoa -> ghi unlockedAt")
    void setLockUnlocksArea() {
        MaintenanceAreaLock existing = lock("MEMBER_APP_ACCESS", true);
        when(locks.findByArea("MEMBER_APP_ACCESS")).thenReturn(Optional.of(existing));
        when(locks.save(any(MaintenanceAreaLock.class))).thenAnswer(i -> i.getArgument(0));

        MaintenanceAreaLockResponseDto result = service.setLock("MEMBER_APP_ACCESS", "UNLOCKED", null);

        assertThat(result.locked()).isFalse();
        assertThat(result.unlockedAt()).isNotNull();
    }

    @Test
    @DisplayName("setLock: khu vuc khong hop le -> nem loi")
    void setLockRejectsUnknownArea() {
        assertThatThrownBy(() -> service.setLock("NOPE", "LOCKED", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unsupported affected area");
    }

    @Test
    @DisplayName("setLock: khu vuc rong -> nem loi")
    void setLockRejectsBlankArea() {
        assertThatThrownBy(() -> service.setLock("  ", "LOCKED", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Affected area is required");
    }

    @Test
    @DisplayName("setLock: trang thai rong -> nem loi")
    void setLockRejectsBlankState() {
        assertThatThrownBy(() -> service.setLock("MEMBER_APP_ACCESS", " ", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Lock state is required");
    }

    @Test
    @DisplayName("setLock: trang thai khong hop le -> nem loi")
    void setLockRejectsUnknownState() {
        assertThatThrownBy(() -> service.setLock("MEMBER_APP_ACCESS", "MAYBE", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unsupported lock state");
    }

    @Test
    @DisplayName("setLock: chap nhan cac cach viet tuong duong")
    void setLockAcceptsAliases() {
        when(locks.findByArea(any())).thenReturn(Optional.empty());
        when(locks.save(any(MaintenanceAreaLock.class))).thenAnswer(i -> i.getArgument(0));

        assertThat(service.setLock("member_app_access", "true", null).locked()).isTrue();
        assertThat(service.setLock("MEMBER_APP_ACCESS", "OFF", null).locked()).isFalse();
        assertThat(service.setLock("MEMBER_APP_ACCESS", "1", null).locked()).isTrue();
        assertThat(service.setLock("MEMBER_APP_ACCESS", "0", null).locked()).isFalse();
    }

    @Test
    @DisplayName("setLock: ly do rong -> null")
    void setLockNormalizesBlankReason() {
        when(locks.findByArea(any())).thenReturn(Optional.empty());
        when(locks.save(any(MaintenanceAreaLock.class))).thenAnswer(i -> i.getArgument(0));

        assertThat(service.setLock("MEMBER_APP_ACCESS", "LOCKED", "   ").reason()).isNull();
    }

    @Test
    @DisplayName("lockScheduleAreas: khoa nhieu khu vuc theo lich")
    void lockScheduleAreasLocksEachArea() {
        when(locks.findByArea(any())).thenReturn(Optional.empty());
        when(locks.save(any(MaintenanceAreaLock.class))).thenAnswer(i -> i.getArgument(0));

        service.lockScheduleAreas(9L, List.of("MEMBER_APP_ACCESS", "AI_POSE_ASSESSMENT"));

        verify(locks, org.mockito.Mockito.times(2)).save(any(MaintenanceAreaLock.class));
    }

    @Test
    @DisplayName("lockScheduleAreas: ban ghi da ton tai -> cap nhat")
    void lockScheduleAreasUpdatesExisting() {
        MaintenanceAreaLock existing = lock("MEMBER_APP_ACCESS", false);
        when(locks.findByArea("MEMBER_APP_ACCESS")).thenReturn(Optional.of(existing));

        service.lockScheduleAreas(9L, List.of("MEMBER_APP_ACCESS"));

        assertThat(existing.isLocked()).isTrue();
        assertThat(existing.getScheduleId()).isEqualTo(9L);
        assertThat(existing.getUnlockedAt()).isNull();
    }

    @Test
    @DisplayName("lockScheduleAreas: khu vuc khong hop le -> nem loi")
    void lockScheduleAreasRejectsUnknownArea() {
        assertThatThrownBy(() -> service.lockScheduleAreas(9L, List.of("NOPE")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("unlockScheduleAreas: mo khoa khu vuc dang khoa")
    void unlockScheduleAreasUnlocks() {
        MaintenanceAreaLock existing = lock("MEMBER_APP_ACCESS", true);
        when(locks.findByArea("MEMBER_APP_ACCESS")).thenReturn(Optional.of(existing));
        when(locks.save(any(MaintenanceAreaLock.class))).thenAnswer(i -> i.getArgument(0));

        service.unlockScheduleAreas(List.of("MEMBER_APP_ACCESS"));

        assertThat(existing.isLocked()).isFalse();
        assertThat(existing.getUnlockedAt()).isNotNull();
    }

    @Test
    @DisplayName("unlockScheduleAreas: khong co ban ghi -> bo qua")
    void unlockScheduleAreasIgnoresMissing() {
        when(locks.findByArea("MEMBER_APP_ACCESS")).thenReturn(Optional.empty());

        service.unlockScheduleAreas(List.of("MEMBER_APP_ACCESS"));

        verify(locks, never()).save(any(MaintenanceAreaLock.class));
    }

    @Test
    @DisplayName("unlockScheduleAreas: khu vuc khong hop le -> nem loi")
    void unlockScheduleAreasRejectsUnknownArea() {
        assertThatThrownBy(() -> service.unlockScheduleAreas(List.of("NOPE")))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
