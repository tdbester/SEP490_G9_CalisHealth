package com.calishealth.service;

import com.calishealth.models.MemberProfile;
import com.calishealth.models.MemberWeeklyScore;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.MemberWeeklyScoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class WeeklyLeaderboardService {
    private final MemberWeeklyScoreRepository scoreRepository;
    private final MemberProfileRepository memberProfileRepository;

    @Transactional
    public void computeScoresForWeek(LocalDate weekStart) {
        log.info("Computing weekly leaderboard scores for week starting {}", weekStart);

        // Get all members
        List<MemberProfile> members = memberProfileRepository.findAll();

        // Calculate scores for each member
        List<MemberWeeklyScore> weekScores = members.stream()
            .map(member -> computeScoreForMember(member, weekStart))
            .collect(Collectors.toList());

        // Sort by total score descending
        weekScores.sort((a, b) -> {
            int cmp = b.getTotalScore().compareTo(a.getTotalScore());
            if (cmp != 0) return cmp;
            return a.getId().compareTo(b.getId()); // tie-breaker by ID
        });

        // Assign ranks and compare with previous week
        LocalDate previousWeek = weekStart.minusWeeks(1);
        for (int i = 0; i < weekScores.size(); i++) {
            MemberWeeklyScore score = weekScores.get(i);
            score.setRank(i + 1);

            // Get previous rank
            var prevScore = scoreRepository.findByMember_IdAndWeekStart(score.getMember().getId(), previousWeek);
            if (prevScore.isPresent()) {
                Integer prevRank = prevScore.get().getRank();
                score.setPreviousRank(prevRank);
                score.setRankChange(prevRank != null ? prevRank - score.getRank() : null);
            }
        }

        // Save all scores
        scoreRepository.saveAll(weekScores);
        log.info("Completed: {} member scores computed for week {}", weekScores.size(), weekStart);
    }

    private MemberWeeklyScore computeScoreForMember(MemberProfile member, LocalDate weekStart) {
        // Find existing score or create new
        var existing = scoreRepository.findByMember_IdAndWeekStart(member.getId(), weekStart);
        MemberWeeklyScore score = existing.orElse(new MemberWeeklyScore());

        score.setMember(member);
        score.setWeekStart(weekStart);
        score.setFitnessLevel(member.getFitnessLevel());

        // TODO: Replace the demo component values with activity-derived points.
        // The total is always additive and has no maximum.
        score.setSessionsScore(BigDecimal.valueOf(Math.random() * 100)); // 0-100
        score.setTimeScore(BigDecimal.valueOf(Math.random() * 50));      // 0-50
        score.setAccuracyScore(BigDecimal.valueOf(Math.random() * 30));  // 0-30
        score.setRestDayBonus(BigDecimal.valueOf(Math.random() * 20));   // 0-20
        score.setStreakBonus(BigDecimal.valueOf(Math.random() * 20));    // 0-20

        score.calculateTotalScore();
        return score;
    }
}
