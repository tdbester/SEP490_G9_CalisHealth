package com.calishealth.repository;

import com.calishealth.models.StorageUsageDaily;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface StorageUsageDailyRepository extends JpaRepository<StorageUsageDaily, LocalDate> {
    /** The newest rows, oldest first. */
    List<StorageUsageDaily> findAllByOrderByDayAsc();

    /** The rows of the last {@code days} days, oldest first. */
    List<StorageUsageDaily> findByDayGreaterThanEqualOrderByDayAsc(LocalDate from);
}
