package com.calishealth.repository;

import com.calishealth.models.SurveySession;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SurveySessionRepository extends JpaRepository<SurveySession, Long> {
    /** Khóa dòng phiên (SELECT ... FOR UPDATE) để các request ghi đồng thời trên cùng phiên chạy tuần tự. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from SurveySession s join fetch s.survey join fetch s.user where s.id = :id")
    Optional<SurveySession> findByIdForUpdate(@Param("id") Long id);

    @Query("select s from SurveySession s join fetch s.survey join fetch s.user where s.id = :id")
    Optional<SurveySession> findWithSurveyById(@Param("id") Long id);

    @Query("""
            select s from SurveySession s join fetch s.survey sv
            where s.user.id = :userId and sv.surveyCode = :surveyCode
            order by s.startedAt desc, s.id desc
            """)
    List<SurveySession> findByUserAndSurveyCode(@Param("userId") Long userId, @Param("surveyCode") String surveyCode);
}
