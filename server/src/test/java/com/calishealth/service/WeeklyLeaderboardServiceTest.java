package com.calishealth.service;

import com.calishealth.models.FitnessLevel;
import com.calishealth.models.MemberProfile;
import com.calishealth.models.MemberWeeklyScore;
import com.calishealth.models.User;
import com.calishealth.repository.LeaderboardScoringRepository;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.MemberWeeklyScoreRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Kiểm tra việc cộng điểm bảng xếp hạng: một buổi tập hoàn thành phải làm
 * điểm tuần của member tăng lên ngay, và thứ hạng phải được xếp lại.
 */
class WeeklyLeaderboardServiceTest {

    private final MemberWeeklyScoreRepository scoreRepository = mock(MemberWeeklyScoreRepository.class);
    private final MemberProfileRepository memberProfileRepository = mock(MemberProfileRepository.class);
    private final LeaderboardScoringRepository scoring = mock(LeaderboardScoringRepository.class);

    private final WeeklyLeaderboardService service =
            new WeeklyLeaderboardService(scoreRepository, memberProfileRepository, scoring);

    private static MemberProfile member(long id, int daysPerWeek, Long levelId) {
        MemberProfile profile = new MemberProfile();
        profile.setId(id);
        profile.setDaysPerWeek(daysPerWeek);
        profile.setUser(new User());
        profile.getUser().setId(id + 1000);
        profile.getUser().setFullName("Member " + id);
        if (levelId != null) {
            FitnessLevel level = new FitnessLevel();
            level.setId(levelId);
            level.setName("Beginner");
            profile.setFitnessLevel(level);
        }
        return profile;
    }

    @Test
    void refreshMemberScoreAddsSessionPointsRightAfterAWorkout() {
        MemberProfile profile = member(1L, 3, 1L);
        when(memberProfileRepository.findById(1L)).thenReturn(Optional.of(profile));
        when(scoreRepository.findAllByMember_IdAndWeekStart(anyLong(), any(LocalDate.class)))
                .thenReturn(List.of());

        // 2 buổi tập, 30 phút, accuracy trung bình 80%.
        when(scoring.countCompletedSessions(eq(1L), any(LocalDate.class), any(LocalDate.class))).thenReturn(2);
        when(scoring.totalActiveMinutes(eq(1L), any(LocalDate.class), any(LocalDate.class))).thenReturn(30L);
        when(scoring.findAverageAccuracy(eq(1L), any(LocalDate.class))).thenReturn(new BigDecimal("80"));
        when(scoring.countTrainingDays(eq(1L), any(LocalDate.class), any(LocalDate.class))).thenReturn(3);
        when(scoring.countGoalWeekStreak(eq(1L), anyInt(), any(LocalDate.class))).thenReturn(1);

        service.refreshMemberScore(1L);

        ArgumentCaptor<MemberWeeklyScore> captor = ArgumentCaptor.forClass(MemberWeeklyScore.class);
        verify(scoreRepository).saveAndFlush(captor.capture());
        MemberWeeklyScore score = captor.getValue();

        // 2 buổi x 25 điểm = 50; 30 phút / 6 = 5; accuracy 80 x 0.30 = 24;
        // đạt mục tiêu 3 ngày -> nghỉ 4 ngày x 4 = 16; streak 1 tuần x 5 = 5.
        assertThat(score.getSessionsScore()).isEqualByComparingTo("50.00");
        assertThat(score.getTimeScore()).isEqualByComparingTo("5.00");
        assertThat(score.getAccuracyScore()).isEqualByComparingTo("24.00");
        assertThat(score.getRestDayBonus()).isEqualByComparingTo("16.00");
        assertThat(score.getStreakBonus()).isEqualByComparingTo("5.00");
        assertThat(score.getTotalScore()).isEqualByComparingTo("100.00");
    }

    @Test
    void refreshMemberScoreGivesNoPointsWithoutAnyWorkout() {
        MemberProfile profile = member(2L, 3, 1L);
        when(memberProfileRepository.findById(2L)).thenReturn(Optional.of(profile));
        when(scoreRepository.findAllByMember_IdAndWeekStart(eq(2L), any(LocalDate.class)))
                .thenReturn(List.of());

        when(scoring.countCompletedSessions(eq(2L), any(LocalDate.class), any(LocalDate.class))).thenReturn(0);
        when(scoring.totalActiveMinutes(eq(2L), any(LocalDate.class), any(LocalDate.class))).thenReturn(0L);
        when(scoring.findAverageAccuracy(eq(2L), any(LocalDate.class))).thenReturn(null);
        when(scoring.countTrainingDays(eq(2L), any(LocalDate.class), any(LocalDate.class))).thenReturn(0);
        when(scoring.countGoalWeekStreak(eq(2L), anyInt(), any(LocalDate.class))).thenReturn(0);

        service.refreshMemberScore(2L);

        ArgumentCaptor<MemberWeeklyScore> captor = ArgumentCaptor.forClass(MemberWeeklyScore.class);
        verify(scoreRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getTotalScore()).isEqualByComparingTo("0.00");
        // Nghỉ chỉ được thưởng khi đạt mục tiêu tuần.
        assertThat(captor.getValue().getRestDayBonus()).isEqualByComparingTo("0.00");
    }

    @Test
    void refreshMemberScoreRanksMembersOfTheSameLevelByTotalScore() {
        MemberProfile top = member(1L, 3, 1L);
        MemberProfile bottom = member(2L, 3, 1L);
        when(memberProfileRepository.findById(1L)).thenReturn(Optional.of(top));
        when(scoreRepository.findAllByMember_IdAndWeekStart(anyLong(), any(LocalDate.class)))
                .thenReturn(List.of());

        when(scoring.countCompletedSessions(eq(1L), any(LocalDate.class), any(LocalDate.class))).thenReturn(4);
        when(scoring.totalActiveMinutes(eq(1L), any(LocalDate.class), any(LocalDate.class))).thenReturn(60L);
        when(scoring.findAverageAccuracy(eq(1L), any(LocalDate.class))).thenReturn(new BigDecimal("90"));
        when(scoring.countTrainingDays(eq(1L), any(LocalDate.class), any(LocalDate.class))).thenReturn(4);
        when(scoring.countGoalWeekStreak(eq(1L), anyInt(), any(LocalDate.class))).thenReturn(2);

        // Bảng điểm đã lưu của tuần: member 1 điểm cao, member 2 điểm thấp.
        MemberWeeklyScore topScore = new MemberWeeklyScore();
        topScore.setMember(top);
        topScore.setWeekStart(LocalDate.now());
        topScore.setTotalScore(new BigDecimal("200.00"));
        MemberWeeklyScore bottomScore = new MemberWeeklyScore();
        bottomScore.setMember(bottom);
        bottomScore.setWeekStart(LocalDate.now());
        bottomScore.setTotalScore(new BigDecimal("50.00"));
        when(scoreRepository.findByWeekStart(any(LocalDate.class)))
                .thenReturn(new java.util.ArrayList<>(List.of(bottomScore, topScore)));

        service.refreshMemberScore(1L);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<MemberWeeklyScore>> captor = ArgumentCaptor.forClass(List.class);
        verify(scoreRepository, times(1)).saveAll(captor.capture());
        List<MemberWeeklyScore> saved = captor.getValue();
        assertThat(saved.get(0).getRank()).isEqualTo(1);
        assertThat(saved.get(1).getRank()).isEqualTo(2);
    }

    @Test
    void changingLevelMidWeekDeletesTheOldScoreAndRecomputesFromScratch() {
        // Member giờ thuộc level 2 (đã đổi giữa tuần).
        MemberProfile profile = member(1L, 3, 2L);
        when(memberProfileRepository.findById(1L)).thenReturn(Optional.of(profile));

        // Dòng điểm cũ của tuần, còn gắn với level 1.
        MemberWeeklyScore staleRow = new MemberWeeklyScore();
        staleRow.setMember(member(1L, 3, 1L));
        staleRow.setWeekStart(LocalDate.now());
        staleRow.setTotalScore(new BigDecimal("75.00"));
        when(scoreRepository.findAllByMember_IdAndWeekStart(eq(1L), any(LocalDate.class)))
                .thenReturn(List.of(staleRow));
        when(scoreRepository.findByWeekStart(any(LocalDate.class)))
                .thenReturn(new java.util.ArrayList<>());

        when(scoring.countCompletedSessions(eq(1L), any(LocalDate.class), any(LocalDate.class))).thenReturn(2);
        when(scoring.totalActiveMinutes(eq(1L), any(LocalDate.class), any(LocalDate.class))).thenReturn(30L);
        when(scoring.findAverageAccuracy(eq(1L), any(LocalDate.class))).thenReturn(new BigDecimal("80"));
        when(scoring.countTrainingDays(eq(1L), any(LocalDate.class), any(LocalDate.class))).thenReturn(3);
        when(scoring.countGoalWeekStreak(eq(1L), anyInt(), any(LocalDate.class))).thenReturn(1);

        service.resetAndRecomputeMemberScore(1L);

        // Dòng điểm ở level cũ phải bị xóa hẳn.
        verify(scoreRepository).deleteAll(List.of(staleRow));

        // Điểm được tính lại từ đầu dưới level hiện tại.
        ArgumentCaptor<MemberWeeklyScore> captor = ArgumentCaptor.forClass(MemberWeeklyScore.class);
        verify(scoreRepository).saveAndFlush(captor.capture());
        MemberWeeklyScore score = captor.getValue();
        assertThat(score.getFitnessLevel().getId()).isEqualTo(2L);
        assertThat(score.getTotalScore()).isEqualByComparingTo("100.00");
    }

    @Test
    void changingLevelMidWeekKeepsTheScoreWhenNothingWasRecordedYet() {
        MemberProfile profile = member(1L, 3, 2L);
        when(memberProfileRepository.findById(1L)).thenReturn(Optional.of(profile));
        when(scoreRepository.findAllByMember_IdAndWeekStart(eq(1L), any(LocalDate.class)))
                .thenReturn(List.of());
        when(scoreRepository.findByWeekStart(any(LocalDate.class)))
                .thenReturn(new java.util.ArrayList<>());

        when(scoring.countCompletedSessions(eq(1L), any(LocalDate.class), any(LocalDate.class))).thenReturn(0);
        when(scoring.totalActiveMinutes(eq(1L), any(LocalDate.class), any(LocalDate.class))).thenReturn(0L);
        when(scoring.findAverageAccuracy(eq(1L), any(LocalDate.class))).thenReturn(null);
        when(scoring.countTrainingDays(eq(1L), any(LocalDate.class), any(LocalDate.class))).thenReturn(0);
        when(scoring.countGoalWeekStreak(eq(1L), anyInt(), any(LocalDate.class))).thenReturn(0);

        service.resetAndRecomputeMemberScore(1L);

        verify(scoreRepository, never()).deleteAll(any());
        ArgumentCaptor<MemberWeeklyScore> captor = ArgumentCaptor.forClass(MemberWeeklyScore.class);
        verify(scoreRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getTotalScore()).isEqualByComparingTo("0.00");
        assertThat(captor.getValue().getFitnessLevel().getId()).isEqualTo(2L);
    }
}
