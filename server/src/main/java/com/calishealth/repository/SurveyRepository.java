package com.calishealth.repository;

import com.calishealth.models.Survey;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SurveyRepository extends JpaRepository<Survey, Long> {
    Optional<Survey> findBySurveyCodeAndStatus(String surveyCode, Survey.Status status);
    Optional<Survey> findBySurveyCodeAndVersion(String surveyCode, int version);
    Optional<Survey> findFirstBySurveyCodeAndStatusOrderByVersionDesc(String surveyCode, Survey.Status status);
    List<Survey> findByStatus(Survey.Status status);
    boolean existsBySurveyCode(String surveyCode);

    /**
     * Khóa dòng survey (SELECT ... FOR UPDATE): mọi thao tác ghi trên các bước của cùng 1 survey version
     * chạy tuần tự, nên sort_order và kiểm tra cấu hình không bị 2 request xen nhau.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Survey s where s.id = :id")
    Optional<Survey> findByIdForUpdate(@Param("id") Long id);
}
