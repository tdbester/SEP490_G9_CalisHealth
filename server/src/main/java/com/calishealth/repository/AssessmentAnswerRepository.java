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

    /** Trong các câu hỏi này, câu nào đã có member trả lời ở BẤT KỲ survey nào (câu hỏi dùng chung giữa các version). */
    @Query("select distinct a.question.id from AssessmentAnswer a where a.question.id in :questionIds")
    List<Long> findQuestionIdsWithAnswers(@Param("questionIds") Collection<Long> questionIds);

    /**
     * Câu trả lời mới nhất (JSON) của member cho 1 mã câu hỏi, mới nhất trước. The Profile screen reads
     * the AGE answer from here instead of deriving the age from the stored date of birth.
     */
    @Query("""
            select a.answerValue from AssessmentAnswer a
            where a.session.user.id = :userId
              and upper(a.question.questionCode) = upper(:questionCode)
            order by a.id desc
            """)
    List<String> findLatestAnswerValues(@Param("userId") Long userId,
            @Param("questionCode") String questionCode);
}
