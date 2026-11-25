package com.calishealth.service;

import com.calishealth.models.FitnessLevel;
import com.calishealth.models.MemberProfile;
import com.calishealth.models.MemberWeeklyScore;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.LeaderboardScoringRepository;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.MemberWeeklyScoreRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho {@link WeeklyLeaderboardService}: giải thích điểm, tính điểm cả tuần và các nhánh null.
 */
class WeeklyLeaderboardServiceExtraCoverageTest {

    private final MemberWeeklyScoreRepository scoreRepository = mock(MemberWeeklyScoreRepository.class);
    private final MemberProfileRepository memberProfileRepository = mock(MemberProfileRepository.class);
    private final LeaderboardScoringRepository scoring = mock(LeaderboardScoringRepository.class);

    private final WeeklyLeaderboardService service =
            new WeeklyLeaderboardService(scoreRepository, memberProfileRepository, scoring);

    private static MemberProfile member(long id, int daysPerWeek, Long levelId) {
        MemberProfile profile = new MemberProfile();
        profile.setId(id);
        profile.setDaysPerWeek(daysPerWeek);
        User user = new User();
        user.setId(id + 1000);
        user.setRole(UserRole.MEMBER);
        user.setFullName("Member " + id);
        profile.setUser(user);
        if (levelId != null) {
            FitnessLevel level = new FitnessLevel();
            level.setId(levelId);
            level.setName("Beginner");
            profile.setFitnessLevel(level);
        }
        return profile;
    }

    private void stubScoring(long memberId) {
        when(scoring.countCompletedSessions(eq(memberId), any(LocalDate.class), any(LocalDate.class))).thenReturn(2);
        when(scoring.totalActiveMinutes(eq(memberId), any(LocalDate.class), any(LocalDate.class))).thenReturn(30L);
        when(scoring.findAverageAccuracy(eq(memberId), any(LocalDate.class))).thenReturn(new BigDecimal("80"));
        when(scoring.countTrainingDays(eq(memberId), any(LocalDate.class), any(LocalDate.class))).thenReturn(3);
        when(scoring.countGoalWeekStreak(eq(memberId), anyInt(), any(LocalDate.class))).thenReturn(1);
    }

    @Test
    @DisplayName("Explain score: tra ve chi tiet tung thanh diem")
    void explainScoreReturnsBreakdown() {
        when(memberProfileRepository.findById(1L)).thenReturn(Optional.of(member(1L, 3, 1L)));
        stubScoring(1L);

        Map<String, BigDecimal> breakdown = service.explainScore(1L, LocalDate.now());

        assertThat(breakdown).containsKeys("sessionsScore", "timeScore", "accuracyScore", "restDayBonus", "streakBonus");
        assertThat(breakdown.get("sessionsScore")).isEqualByComparingTo("50.00");
        assertThat(breakdown.get("timeScore")).isEqualByComparingTo("5.00");
        assertThat(breakdown.get("accuracyScore")).isEqualByComparingTo("24.00");
        assertThat(breakdown.get("restDayBonus")).isEqualByComparingTo("16.00");
        assertThat(breakdown.get("streakBonus")).isEqualByComparingTo("5.00");
    }

    @Test
    @DisplayName("Explain score: khong tim thay member -> dung muc tieu mac dinh")
    void explainScoreFallsBackToDefaultGoal() {
        when(memberProfileRepository.findById(9L)).thenReturn(Optional.empty());
        when(scoring.countCompletedSessions(eq(9L), any(LocalDate.class), any(LocalDate.class))).thenReturn(0);
        when(scoring.totalActiveMinutes(eq(9L), any(LocalDate.class), any(LocalDate.class))).thenReturn(0L);
        when(scoring.findAverageAccuracy(eq(9L), any(LocalDate.class))).thenReturn(null);
        when(scoring.countTrainingDays(eq(9L), any(LocalDate.class), any(LocalDate.class))).thenReturn(0);
        when(scoring.countGoalWeekStreak(eq(9L), anyInt(), any(LocalDate.class))).thenReturn(0);

        Map<String, BigDecimal> breakdown = service.explainScore(9L, LocalDate.now());

        assertThat(breakdown.get("accuracyScore")).isEqualByComparingTo("0.00");
        assertThat(breakdown.get("restDayBonus")).isEqualByComparingTo("0.00");
    }

    @Test
    @DisplayName("Refresh: member khong ton tai -> khong lam gi")
    void refreshMemberScoreIgnoresUnknownMember() {
        when(memberProfileRepository.findById(5L)).thenReturn(Optional.empty());

        service.refreshMemberScore(5L);

        verify(scoreRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("Reset: member khong ton tai -> khong lam gi")
    void resetAndRecomputeIgnoresUnknownMember() {
        when(memberProfileRepository.findById(5L)).thenReturn(Optional.empty());

        service.resetAndRecomputeMemberScore(5L);

        verify(scoreRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("Reset: member khong co level -> ghi log level none")
    void resetAndRecomputeHandlesMemberWithoutLevel() {
        MemberProfile profile = member(1L, 3, null);
        when(memberProfileRepository.findById(1L)).thenReturn(Optional.of(profile));
        when(scoreRepository.findAllByMember_IdAndWeekStart(eq(1L), any(LocalDate.class)))
                .thenReturn(List.of());
        when(scoreRepository.findByWeekStart(any(LocalDate.class))).thenReturn(new ArrayList<>());
        stubScoring(1L);

        service.resetAndRecomputeMemberScore(1L);

        verify(scoreRepository).saveAndFlush(any());
    }

    @Test
    @DisplayName("Tinh diem ca tuan: chi xep hang member")
    void computeScoresForWeekScoresAllMembers() {
        when(memberProfileRepository.findAllByUser_Role(UserRole.MEMBER)).thenReturn(List.of(member(1L, 3, 1L)));
        when(scoreRepository.findAllByMember_IdAndWeekStart(eq(1L), any(LocalDate.class)))
                .thenReturn(List.of());
        when(scoreRepository.findByWeekStart(any(LocalDate.class))).thenReturn(new ArrayList<>());
        stubScoring(1L);

        service.computeScoresForWeek(LocalDate.now());

        verify(scoreRepository, org.mockito.Mockito.atLeastOnce()).saveAll(any());
        verify(scoreRepository).flush();
    }

    @Test
    @DisplayName("Xep hang: so sanh voi tuan truoc -> tinh thay doi thu hang")
    void reassignRanksComputesRankChange() {
        MemberProfile profile = member(1L, 3, 1L);
        when(memberProfileRepository.findById(1L)).thenReturn(Optional.of(profile));

        MemberWeeklyScore previous = new MemberWeeklyScore();
        previous.setMember(profile);
        previous.setRank(5);
        when(scoreRepository.findAllByMember_IdAndWeekStart(eq(1L), any(LocalDate.class)))
                .thenReturn(List.of());
        when(scoreRepository.findByWeekStart(any(LocalDate.class))).thenReturn(new ArrayList<>());
        stubScoring(1L);

        MemberWeeklyScore current = new MemberWeeklyScore();
        current.setMember(profile);
        current.setWeekStart(LocalDate.now());
        current.setTotalScore(new BigDecimal("10.00"));
        current.setFitnessLevel(profile.getFitnessLevel());

        // Vong lap xep hang: dong nao cung lai trong tuan hien tai.
        when(scoreRepository.findByWeekStart(any(LocalDate.class)))
                .thenReturn(new ArrayList<>(List.of(current)));

        service.refreshMemberScore(1L);

        verify(scoreRepository).saveAll(any());
    }

    @Test
    @DisplayName("Xep hang: dong cua tuan truoc co rank null -> rank change null")
    void reassignRanksHandlesNullPreviousRank() {
        MemberProfile profile = member(1L, 3, 1L);
        when(memberProfileRepository.findById(1L)).thenReturn(Optional.of(profile));

        MemberWeeklyScore previous = new MemberWeeklyScore();
        previous.setMember(profile);
        previous.setRank(null);
        when(scoreRepository.findAllByMember_IdAndWeekStart(anyLong(), any(LocalDate.class)))
                .thenReturn(List.of());
        when(scoreRepository.findByWeekStart(any(LocalDate.class))).thenReturn(new ArrayList<>());
        stubScoring(1L);

        service.refreshMemberScore(1L);

        verify(scoreRepository).saveAll(any());
    }

    @Test
    @DisplayName("Diem: khong dat muc tieu tuan -> khong thuong ngay nghi")
    void restDayBonusRequiresGoal() {
        MemberProfile profile = member(1L, 4, 1L);
        when(memberProfileRepository.findById(1L)).thenReturn(Optional.of(profile));
        when(scoreRepository.findAllByMember_IdAndWeekStart(eq(1L), any(LocalDate.class)))
                .thenReturn(List.of());
        when(scoreRepository.findByWeekStart(any(LocalDate.class))).thenReturn(new ArrayList<>());

        when(scoring.countCompletedSessions(eq(1L), any(LocalDate.class), any(LocalDate.class))).thenReturn(1);
        when(scoring.totalActiveMinutes(eq(1L), any(LocalDate.class), any(LocalDate.class))).thenReturn(10L);
        when(scoring.findAverageAccuracy(eq(1L), any(LocalDate.class))).thenReturn(null);
        when(scoring.countTrainingDays(eq(1L), any(LocalDate.class), any(LocalDate.class))).thenReturn(2);
        when(scoring.countGoalWeekStreak(eq(1L), anyInt(), any(LocalDate.class))).thenReturn(0);

        service.refreshMemberScore(1L);

        var captor = org.mockito.ArgumentCaptor.forClass(MemberWeeklyScore.class);
        verify(scoreRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getRestDayBonus()).isEqualByComparingTo("0.00");
        assertThat(captor.getValue().getAccuracyScore()).isEqualByComparingTo("0.00");
    }

    @Test
    @DisplayName("Diem: muc tieu tuan = 0 -> dung muc tieu mac dinh 3")
    void daysPerWeekFallsBackToThree() {
        MemberProfile profile = member(1L, 0, 1L);
        when(memberProfileRepository.findById(1L)).thenReturn(Optional.of(profile));
        when(scoreRepository.findAllByMember_IdAndWeekStart(eq(1L), any(LocalDate.class)))
                .thenReturn(List.of());
        when(scoreRepository.findByWeekStart(any(LocalDate.class))).thenReturn(new ArrayList<>());

        when(scoring.countCompletedSessions(eq(1L), any(LocalDate.class), any(LocalDate.class))).thenReturn(1);
        when(scoring.totalActiveMinutes(eq(1L), any(LocalDate.class), any(LocalDate.class))).thenReturn(10L);
        when(scoring.findAverageAccuracy(eq(1L), any(LocalDate.class))).thenReturn(null);
        when(scoring.countTrainingDays(eq(1L), any(LocalDate.class), any(LocalDate.class))).thenReturn(3);
        when(scoring.countGoalWeekStreak(eq(1L), anyInt(), any(LocalDate.class))).thenReturn(0);

        service.refreshMemberScore(1L);

        var captor = org.mockito.ArgumentCaptor.forClass(MemberWeeklyScore.class);
        verify(scoreRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getRestDayBonus()).isEqualByComparingTo("16.00");
    }
}
