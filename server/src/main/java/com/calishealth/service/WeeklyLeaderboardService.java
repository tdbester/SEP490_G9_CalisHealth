package com.calishealth.service;

import com.calishealth.models.MemberProfile;
import com.calishealth.models.MemberWeeklyScore;
import com.calishealth.models.UserRole;
import com.calishealth.repository.LeaderboardScoringRepository;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.MemberWeeklyScoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Tính điểm bảng xếp hạng tuần.
 *
 * <p>Công thức (không có điểm trần, tổng điểm tăng tuyến tính theo hoạt động):
 * <pre>
 *   Weekly Score = Sessions Completed (số buổi tập × 25)
 *                + Workout Time Logged (tổng phút tập ÷ 6)
 *                + Exercises Accuracy (accuracy trung bình × 0.30)
 *                + Rest Day Bonus (số ngày nghỉ × 4)
 *                + Streak Bonus (số tuần liên tiếp đạt mục tiêu × 5)
 * </pre>
 *
 * <p>Ngày nghỉ (rest day) cũng được điểm: những ngày trong tuần không tập
 * nhưng vẫn nằm trong kế hoạch tập của member. Điểm nghỉ chỉ được cộng khi
 * member đạt mục tiêu số buổi/tuần — nghỉ là có chủ đích, không phải bỏ tập.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WeeklyLeaderboardService {
    private final MemberWeeklyScoreRepository scoreRepository;
    private final MemberProfileRepository memberProfileRepository;
    private final LeaderboardScoringRepository scoring;

    /**
     * Tính và lưu điểm cho 1 tuần.
     *
     * @param weekStart ngày bắt đầu tuần (thứ 2)
     */
    @Transactional
    public void computeScoresForWeek(LocalDate weekStart) {
        log.info("Computing weekly leaderboard scores for week starting {}", weekStart);

        // Chỉ tài khoản role = MEMBER mới được xếp hạng.
        List<MemberProfile> members = memberProfileRepository.findAllByUser_Role(UserRole.MEMBER);

        List<MemberWeeklyScore> weekScores = members.stream()
                .map(member -> computeScoreForMember(member, weekStart))
                .collect(Collectors.toList());

        // Xếp hạng: tổng điểm giảm dần, id member tăng dần làm tie-breaker.
        // Lưu ý: dùng id của member chứ không dùng id của score, vì score mới
        // tạo chưa được persist nên getId() còn null -> NPE.
        weekScores.sort((a, b) -> {
            int cmp = b.getTotalScore().compareTo(a.getTotalScore());
            if (cmp != 0) return cmp;
            return a.getMember().getId().compareTo(b.getMember().getId());
        });

        // Rank lưu theo từng level, vì leaderboard luôn lọc theo level:
        // thành viên đứng đầu level Beginner phải là #1 của level đó, không
        // phải #1 toàn bảng.
        LocalDate previousWeek = weekStart.minusWeeks(1);
        Map<Long, Integer> rankByLevel = new java.util.HashMap<>();
        for (MemberWeeklyScore score : weekScores) {
            Long levelId = score.getFitnessLevel() != null ? score.getFitnessLevel().getId() : null;
            int rankInLevel = rankByLevel.merge(levelId, 1, Integer::sum);
            score.setRank(rankInLevel);

            var prevScore = scoreRepository.findByMember_IdAndWeekStart(score.getMember().getId(), previousWeek);
            if (prevScore.isPresent()) {
                Integer prevRank = prevScore.get().getRank();
                score.setPreviousRank(prevRank);
                score.setRankChange(prevRank != null ? prevRank - score.getRank() : null);
            }
        }

        scoreRepository.saveAll(weekScores);
        log.info("Completed: {} member scores computed for week {}", weekScores.size(), weekStart);
    }

    private MemberWeeklyScore computeScoreForMember(MemberProfile member, LocalDate weekStart) {
        LocalDate weekEnd = weekStart.plusDays(LeaderboardScoringRepository.DAYS_PER_WEEK - 1L);

        var existing = scoreRepository.findByMember_IdAndWeekStart(member.getId(), weekStart);
        MemberWeeklyScore score = existing.orElse(new MemberWeeklyScore());

        score.setMember(member);
        score.setWeekStart(weekStart);
        score.setFitnessLevel(member.getFitnessLevel());

        // --- 1. Sessions Completed: mỗi buổi tập hoàn thành 25 điểm ---
        int sessions = scoring.countCompletedSessions(member.getId(), weekStart, weekEnd);
        BigDecimal sessionsScore = points(sessions * (double) LeaderboardScoringRepository.POINTS_PER_SESSION);

        // --- 2. Workout Time Logged: mỗi 6 phút tập 1 điểm ---
        long minutes = scoring.totalActiveMinutes(member.getId(), weekStart, weekEnd);
        BigDecimal timeScore = points(
                (double) minutes / LeaderboardScoringRepository.MINUTES_PER_TIME_POINT);

        // --- 3. Exercises Accuracy: 30% của accuracy trung bình ---
        // Không có bài nào có số đo -> 0 điểm, không bịa số.
        BigDecimal averageAccuracy = scoring.findAverageAccuracy(member.getId(), weekStart);
        BigDecimal accuracyScore = averageAccuracy == null
                ? BigDecimal.ZERO
                : points(averageAccuracy.doubleValue() * 0.30);

        // --- 4. Rest Day Bonus: mỗi ngày nghỉ 4 điểm ---
        int daysPerWeek = member.getDaysPerWeek() > 0 ? member.getDaysPerWeek() : 3;
        int trainingDays = scoring.countTrainingDays(member.getId(), weekStart, weekEnd);
        int restDays = Math.max(0, LeaderboardScoringRepository.DAYS_PER_WEEK - trainingDays);
        BigDecimal restDayBonus = BigDecimal.ZERO;
        if (trainingDays >= daysPerWeek) {
            // Đạt mục tiêu -> nghỉ là có chủ đích, được thưởng.
            restDayBonus = points(restDays * (double) LeaderboardScoringRepository.POINTS_PER_REST_DAY);
        }

        // --- 5. Streak Bonus: mỗi tuần liên tiếp đạt mục tiêu 5 điểm ---
        int streakWeeks = scoring.countGoalWeekStreak(member.getId(), daysPerWeek, weekStart);
        BigDecimal streakBonus = points(
                streakWeeks * (double) LeaderboardScoringRepository.POINTS_PER_STREAK_WEEK);

        score.setSessionsScore(sessionsScore);
        score.setTimeScore(timeScore);
        score.setAccuracyScore(accuracyScore);
        score.setRestDayBonus(restDayBonus);
        score.setStreakBonus(streakBonus);
        score.calculateTotalScore();
        return score;
    }

    /**
     * Làm tròn 2 chữ số, không chặn trên.
     */
    private static BigDecimal points(double raw) {
        double value = Math.max(0d, raw);
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Chi tiết điểm của 1 member trong tuần — dùng cho API breakdown.
     */
    @Transactional(readOnly = true)
    public Map<String, BigDecimal> explainScore(Long memberProfileId, LocalDate weekStart) {
        LocalDate weekEnd = weekStart.plusDays(LeaderboardScoringRepository.DAYS_PER_WEEK - 1L);
        MemberProfile member = memberProfileRepository.findById(memberProfileId).orElse(null);
        int daysPerWeek = member != null && member.getDaysPerWeek() > 0 ? member.getDaysPerWeek() : 3;

        int sessions = scoring.countCompletedSessions(memberProfileId, weekStart, weekEnd);
        long minutes = scoring.totalActiveMinutes(memberProfileId, weekStart, weekEnd);
        BigDecimal accuracy = scoring.findAverageAccuracy(memberProfileId, weekStart);
        int trainingDays = scoring.countTrainingDays(memberProfileId, weekStart, weekEnd);
        int restDays = Math.max(0, LeaderboardScoringRepository.DAYS_PER_WEEK - trainingDays);
        int streakWeeks = scoring.countGoalWeekStreak(memberProfileId, daysPerWeek, weekStart);

        return Map.of(
                "sessionsScore", points(sessions * (double) LeaderboardScoringRepository.POINTS_PER_SESSION),
                "timeScore", points((double) minutes / LeaderboardScoringRepository.MINUTES_PER_TIME_POINT),
                "accuracyScore", accuracy == null ? BigDecimal.ZERO
                        : points(accuracy.doubleValue() * 0.30),
                "restDayBonus", trainingDays >= daysPerWeek
                        ? points(restDays * (double) LeaderboardScoringRepository.POINTS_PER_REST_DAY)
                        : BigDecimal.ZERO,
                "streakBonus", points(streakWeeks * (double) LeaderboardScoringRepository.POINTS_PER_STREAK_WEEK)
        );
    }
}
