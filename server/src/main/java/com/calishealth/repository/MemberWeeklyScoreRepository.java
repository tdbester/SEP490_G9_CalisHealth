package com.calishealth.repository;

import com.calishealth.models.MemberWeeklyScore;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface MemberWeeklyScoreRepository extends JpaRepository<MemberWeeklyScore, Long> {

    @Query("SELECT m FROM MemberWeeklyScore m JOIN FETCH m.member mem JOIN FETCH mem.user JOIN FETCH m.fitnessLevel WHERE m.weekStart = :weekStart AND m.fitnessLevel.id = :levelId ORDER BY m.totalScore DESC")
    List<MemberWeeklyScore> findLeaderboardForWeekAndLevel(@Param("weekStart") LocalDate weekStart, @Param("levelId") Long levelId, Pageable pageable);

    /** Tổng số member trong tuần thuộc level đang lọc. */
    @Query("SELECT COUNT(m) FROM MemberWeeklyScore m WHERE m.weekStart = :weekStart AND m.fitnessLevel.id = :levelId")
    long countForWeekAndLevel(@Param("weekStart") LocalDate weekStart, @Param("levelId") Long levelId);

    @Query("SELECT m FROM MemberWeeklyScore m WHERE m.member.id = :memberId ORDER BY m.weekStart DESC")
    List<MemberWeeklyScore> findRecentWeeksForMember(@Param("memberId") Long memberId, Pageable pageable);

    Optional<MemberWeeklyScore> findByMember_IdAndWeekStart(Long memberId, LocalDate weekStart);

    @Query("SELECT m FROM MemberWeeklyScore m JOIN FETCH m.member mem JOIN FETCH mem.user JOIN FETCH m.fitnessLevel WHERE m.member.id = :memberId AND m.weekStart = :weekStart AND m.fitnessLevel.id = :levelId")
    Optional<MemberWeeklyScore> findForMemberAndWeekAndLevel(
        @Param("memberId") Long memberId,
        @Param("weekStart") LocalDate weekStart,
        @Param("levelId") Long levelId
    );

    /**
     * Số member đứng trên member này trong tuần (cùng phạm vi level).
     * levelId luôn khác null vì leaderboard chỉ lọc theo level.
     */
    @Query("""
        SELECT COUNT(m) FROM MemberWeeklyScore m
        WHERE m.weekStart = :weekStart
          AND m.fitnessLevel.id = :levelId
          AND (m.totalScore > :totalScore OR (m.totalScore = :totalScore AND m.id < :scoreId))
        """)
    long countScoresAbove(
        @Param("weekStart") LocalDate weekStart,
        @Param("levelId") Long levelId,
        @Param("totalScore") java.math.BigDecimal totalScore,
        @Param("scoreId") Long scoreId
    );

    List<MemberWeeklyScore> findByWeekStart(LocalDate weekStart);
}
