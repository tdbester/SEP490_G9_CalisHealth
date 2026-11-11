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
        scoreRepository.saveAll(weekScores);
        scoreRepository.flush();

        reassignRanks(weekStart);
        log.info("Completed: {} member scores computed for week {}", weekScores.size(), weekStart);
    }

    /**
     * Tính lại điểm của 1 member ngay sau khi họ hoàn thành buổi tập.
     *
     * <p>Điểm leaderboard phải phản ánh hoạt động mới nhất, không đợi tới
     * job thứ 2 00:00 hay lần khởi động server. Vì vậy sau mỗi buổi tập
     * hoàn thành, điểm của member đó trong tuần hiện tại được tính lại và
     * thứ hạng của cả tuần được xếp lại theo level.</p>
     *
     * @param memberProfileId id member vừa tập xong
     */
    @Transactional
    public void refreshMemberScore(Long memberProfileId) {
        MemberProfile member = memberProfileRepository.findById(memberProfileId).orElse(null);
        if (member == null) {
            return;
        }

        LocalDate weekStart = mondayOf(LocalDate.now());
        MemberWeeklyScore score = computeScoreForMember(member, weekStart);
        // Lưu trước để score có id, cần cho bước xếp hạng bên dưới.
        scoreRepository.saveAndFlush(score);

        reassignRanks(weekStart);
        log.info("Refreshed leaderboard score for member {} in week {}", memberProfileId, weekStart);
    }

    /**
     * Xóa toàn bộ điểm tuần của 1 member rồi tính lại từ đầu.
     *
     * <p>Dùng khi member đổi fitness level giữa tuần. Bảng điểm có ràng buộc
     * duy nhất gồm member + tuần + level, nên nếu không xóa dòng cũ thì member
     * sẽ có hai dòng điểm trong cùng tuần: một dòng treo lơ lửng ở level cũ
     * và một dòng mới ở level mới. Xóa hết rồi tính lại giúp điểm của tuần
     * luôn nhất quán với level hiện tại.</p>
     *
     * @param memberProfileId id member vừa đổi level
     */
    @Transactional
    public void resetAndRecomputeMemberScore(Long memberProfileId) {
        MemberProfile member = memberProfileRepository.findById(memberProfileId).orElse(null);
        if (member == null) {
            return;
        }

        LocalDate weekStart = mondayOf(LocalDate.now());

        // Xóa mọi dòng điểm của member trong tuần (kể cả dòng ở level cũ).
        List<MemberWeeklyScore> existingRows =
                scoreRepository.findAllByMember_IdAndWeekStart(memberProfileId, weekStart);
        if (!existingRows.isEmpty()) {
            scoreRepository.deleteAll(existingRows);
            scoreRepository.flush();
            log.info("Deleted {} stale leaderboard score row(s) for member {} after a level change",
                    existingRows.size(), memberProfileId);
        }

        // Tính lại từ đầu dưới level hiện tại.
        MemberWeeklyScore score = computeScoreForMember(member, weekStart);
        scoreRepository.saveAndFlush(score);

        reassignRanks(weekStart);
        log.info("Recomputed leaderboard score for member {} in week {} under level {}",
                memberProfileId, weekStart,
                member.getFitnessLevel() != null ? member.getFitnessLevel().getName() : "none");
    }

    /**
     * Xếp lại thứ hạng của mọi member trong 1 tuần, theo từng level.
     *
     * <p>Dùng chung cho {@link #computeScoresForWeek(LocalDate)} và
     * {@link #refreshMemberScore(Long)} để thứ hạng luôn khớp với tổng điểm
     * mới nhất, kể cả khi chỉ một member vừa tập xong.</p>
     */
    private void reassignRanks(LocalDate weekStart) {
        List<MemberWeeklyScore> weekScores = scoreRepository.findByWeekStart(weekStart);

        weekScores.sort((a, b) -> {
            int cmp = b.getTotalScore().compareTo(a.getTotalScore());
            if (cmp != 0) return cmp;
            return a.getMember().getId().compareTo(b.getMember().getId());
        });

        LocalDate previousWeek = weekStart.minusWeeks(1);
        Map<Long, Integer> rankByLevel = new java.util.HashMap<>();
        for (MemberWeeklyScore score : weekScores) {
            Long levelId = score.getFitnessLevel() != null ? score.getFitnessLevel().getId() : null;
            int rankInLevel = rankByLevel.merge(levelId, 1, Integer::sum);
            score.setRank(rankInLevel);

            var prevRows = scoreRepository.findAllByMember_IdAndWeekStart(score.getMember().getId(), previousWeek);
            if (!prevRows.isEmpty()) {
                Integer prevRank = prevRows.get(0).getRank();
                score.setPreviousRank(prevRank);
                score.setRankChange(prevRank != null ? prevRank - score.getRank() : null);
            } else {
                score.setPreviousRank(null);
                score.setRankChange(null);
            }
        }

        scoreRepository.saveAll(weekScores);
    }

    /** Thứ 2 của tuần chứa date. */
    private static LocalDate mondayOf(LocalDate date) {
        return date.with(java.time.DayOfWeek.MONDAY);
    }

    private MemberWeeklyScore computeScoreForMember(MemberProfile member, LocalDate weekStart) {
        LocalDate weekEnd = weekStart.plusDays(LeaderboardScoringRepository.DAYS_PER_WEEK - 1L);

        // Member đổi level giữa tuần thì có thể có nhiều dòng điểm trong tuần
        // (ràng buộc duy nhất gồm member + week + level). Lấy dòng ứng với
        // level hiện tại; nếu chưa có thì tạo mới.
        Long currentLevelId = member.getFitnessLevel() != null ? member.getFitnessLevel().getId() : null;
        List<MemberWeeklyScore> existingRows =
                scoreRepository.findAllByMember_IdAndWeekStart(member.getId(), weekStart);
        MemberWeeklyScore score = existingRows.stream()
                .filter(row -> {
                    Long rowLevelId = row.getFitnessLevel() != null ? row.getFitnessLevel().getId() : null;
                    return java.util.Objects.equals(rowLevelId, currentLevelId);
                })
                .findFirst()
                .orElseGet(() -> existingRows.isEmpty() ? new MemberWeeklyScore() : existingRows.get(0));

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
