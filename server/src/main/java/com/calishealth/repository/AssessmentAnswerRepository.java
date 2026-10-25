package com.calishealth.repository;

import com.calishealth.models.AssessmentAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface AssessmentAnswerRepository extends JpaRepository<AssessmentAnswer, Long> {
    @Query("select a from AssessmentAnswer a join fetch a.question where a.session.id = :sessionId")
    List<AssessmentAnswer> findBySessionId(@Param("sessionId") Long sessionId);

    /** Số câu trả lời member đã gửi cho các câu hỏi này trong 1 survey version (để chặn xóa bước đã dùng). */
    @Query("""
            select count(a) from AssessmentAnswer a
            where a.session.survey.id = :surveyId and a.question.id in :questionIds
            """)
    long countBySurveyAndQuestions(@Param("surveyId") Long surveyId,
            @Param("questionIds") Collection<Long> questionIds);

    /** Trong các câu hỏi này, câu nào đã có member trả lời trong survey version này. */
    @Query("""
            select distinct a.question.id from AssessmentAnswer a
            where a.session.survey.id = :surveyId and a.question.id in :questionIds
            """)
    List<Long> findAnsweredQuestionIds(@Param("surveyId") Long surveyId,
            @Param("questionIds") Collection<Long> questionIds);
}
