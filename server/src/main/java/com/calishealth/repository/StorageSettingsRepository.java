package com.calishealth.repository;

import com.calishealth.models.StorageSettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StorageSettingsRepository extends JpaRepository<StorageSettings, Integer> {
}
