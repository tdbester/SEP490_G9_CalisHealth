package com.calishealth.repository;

import com.calishealth.models.MaintenanceAreaLock;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MaintenanceAreaLockRepository extends JpaRepository<MaintenanceAreaLock, Long> {
    Optional<MaintenanceAreaLock> findByArea(String area);

    List<MaintenanceAreaLock> findAllByOrderByAreaAsc();
}
