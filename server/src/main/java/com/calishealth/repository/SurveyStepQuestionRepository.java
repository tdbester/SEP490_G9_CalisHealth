package com.calishealth.repository;

import com.calishealth.models.SurveyStepQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SurveyStepQuestionRepository extends JpaRepository<SurveyStepQuestion, Long> {
    /** 1 query cho toàn bộ câu hỏi của 1 survey version (tránh N+1). */
    @Query("""
            select l from SurveyStepQuestion l
            join fetch l.question
            join fetch l.step s
            where s.survey.id = :surveyId
            order by s.sortOrder, l.sortOrder
            """)
    List<SurveyStepQuestion> findAllBySurveyId(@Param("surveyId") Long surveyId);

    @Query("""
            select l from SurveyStepQuestion l
            join fetch l.question
            where l.step.id = :stepId
            order by l.sortOrder
            """)
    List<SurveyStepQuestion> findAllByStepId(@Param("stepId") Long stepId);
}
