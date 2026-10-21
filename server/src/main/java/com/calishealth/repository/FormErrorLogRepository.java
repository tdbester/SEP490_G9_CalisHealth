package com.calishealth.repository;

import com.calishealth.models.FormErrorLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FormErrorLogRepository extends JpaRepository<FormErrorLog, Long> {
}
