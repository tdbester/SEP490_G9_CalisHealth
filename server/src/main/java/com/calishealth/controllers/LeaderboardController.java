package com.calishealth.controllers;

import com.calishealth.models.MemberWeeklyScore;
import com.calishealth.repository.MemberWeeklyScoreRepository;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.service.WeeklyLeaderboardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/leaderboard")
@RequiredArgsConstructor
@Slf4j
public class LeaderboardController {
    private final MemberWeeklyScoreRepository scoreRepository;
    private final MemberProfileRepository memberProfileRepository;
    private final WeeklyLeaderboardService leaderboardService;

    /**
     * GET /api/leaderboard/week/current
     * Lấy top 50 members của 1 level trong tuần hiện tại.
     * Leaderboard LUÔN lọc theo level — levelId bắt buộc.
     */
    @GetMapping("/week/current")
    public ResponseEntity<LeaderboardResponse> getCurrentWeekLeaderboard(
        @RequestParam Long levelId,
        Authentication authentication
    ) {
        LocalDate weekStart = getMondayOfCurrentWeek();
        Pageable top50 = PageRequest.of(0, 50);

        List<MemberWeeklyScore> entries = scoreRepository.findLeaderboardForWeekAndLevel(weekStart, levelId, top50);

        LeaderboardEntryDTO myEntry = memberProfileRepository
            .findByUser_Email(authentication.getName())
            .flatMap(member -> scoreRepository.findForMemberAndWeekAndLevel(member.getId(), weekStart, levelId))
            .map(score -> LeaderboardEntryDTO.from(
                score,
                (int) scoreRepository.countScoresAbove(
                    weekStart,
                    levelId,
                    score.getTotalScore(),
                    score.getId()) + 1))
            .orElse(null);

        return ResponseEntity.ok(LeaderboardResponse.builder()
            .weekStart(weekStart)
            .weekEnd(weekStart.plusDays(6))
            .levelId(levelId)
            .totalMembers((int) scoreRepository.countForWeekAndLevel(weekStart, levelId))
            .entries(entries.stream()
                .map(LeaderboardEntryDTO::from)
                .collect(Collectors.toList()))
            .myEntry(myEntry)
            .build());
    }

    /**
     * GET /api/leaderboard/week/history?memberId=42
     * Lấy lịch sử 10 tuần gần nhất của 1 member
     */
    @GetMapping("/week/history")
    public ResponseEntity<MemberWeekHistoryResponse> getMemberWeekHistory(
        @RequestParam Long memberId
    ) {
        Pageable last10 = PageRequest.of(0, 10);
        List<MemberWeeklyScore> history = scoreRepository.findRecentWeeksForMember(memberId, last10);

        return ResponseEntity.ok(MemberWeekHistoryResponse.builder()
            .memberId(memberId)
            .weeks(history.stream()
                .map(s -> new MemberWeekEntryDTO(s.getWeekStart(), s.getRank(), s.getTotalScore(), s.getRankChange()))
                .collect(Collectors.toList()))
            .build());
    }

    /**
     * GET /api/leaderboard/week/breakdown?memberId=42
     * Chi tiết cách tính điểm tuần của 1 member: số buổi tập, phút tập,
     * accuracy trung bình, ngày nghỉ và chuỗi tuần — để member hiểu vì sao
     * điểm của họ là con số đó.
     */
    @GetMapping("/week/breakdown")
    public ResponseEntity<ScoreBreakdownResponse> getScoreBreakdown(
        @RequestParam Long memberId,
        @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate weekStart
    ) {
        LocalDate week = weekStart == null ? getMondayOfCurrentWeek() : weekStart;
        Map<String, BigDecimal> breakdown = leaderboardService.explainScore(memberId, week);

        List<MemberWeeklyScore> storedRows = scoreRepository.findAllByMember_IdAndWeekStart(memberId, week);
        MemberWeeklyScore stored = storedRows.isEmpty() ? null : storedRows.get(0);
        Integer rank = stored == null ? null : stored.getRank();
        BigDecimal total = stored == null
                ? breakdown.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                : stored.getTotalScore();

        return ResponseEntity.ok(new ScoreBreakdownResponse(
            memberId,
            week,
            week.plusDays(6),
            rank,
            total,
            new ScoreComponentsDTO(
                breakdown.get("sessionsScore"),
                breakdown.get("timeScore"),
                breakdown.get("accuracyScore"),
                breakdown.get("restDayBonus"),
                breakdown.get("streakBonus"))
        ));
    }

    /**
     * POST /api/leaderboard/admin/compute
     * Admin endpoint: compute scores cho 1 tuần
     */
    @PostMapping("/admin/compute")
    public ResponseEntity<Map<String, String>> computeWeeklyScores(
        @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate weekStart
    ) {
        if (weekStart == null) {
            weekStart = getMondayOfCurrentWeek();
        }
        log.info("Admin requested leaderboard computation for week {}", weekStart);

        try {
            leaderboardService.computeScoresForWeek(weekStart);
            return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Leaderboard computed for week " + weekStart,
                "week", weekStart.toString()
            ));
        } catch (Exception e) {
            log.error("Leaderboard computation failed", e);
            return ResponseEntity.status(500).body(Map.of(
                "status", "error",
                "message", e.getMessage()
            ));
        }
    }

    private LocalDate getMondayOfCurrentWeek() {
        LocalDate today = LocalDate.now();
        return today.minusDays(today.getDayOfWeek().getValue() - 1);
    }

    // ============= DTOs =============

    public record LeaderboardResponse(
        LocalDate weekStart,
        LocalDate weekEnd,
        Long levelId,
        int totalMembers,
        List<LeaderboardEntryDTO> entries,
        LeaderboardEntryDTO myEntry
    ) {
        public static LeaderboardResponseBuilder builder() {
            return new LeaderboardResponseBuilder();
        }

        public static class LeaderboardResponseBuilder {
            private LocalDate weekStart;
            private LocalDate weekEnd;
            private Long levelId;
            private int totalMembers;
            private List<LeaderboardEntryDTO> entries;
            private LeaderboardEntryDTO myEntry;

            public LeaderboardResponseBuilder weekStart(LocalDate weekStart) {
                this.weekStart = weekStart;
                return this;
            }

            public LeaderboardResponseBuilder weekEnd(LocalDate weekEnd) {
                this.weekEnd = weekEnd;
                return this;
            }

            public LeaderboardResponseBuilder levelId(Long levelId) {
                this.levelId = levelId;
                return this;
            }

            public LeaderboardResponseBuilder totalMembers(int totalMembers) {
                this.totalMembers = totalMembers;
                return this;
            }

            public LeaderboardResponseBuilder entries(List<LeaderboardEntryDTO> entries) {
                this.entries = entries;
                return this;
            }

            public LeaderboardResponseBuilder myEntry(LeaderboardEntryDTO myEntry) {
                this.myEntry = myEntry;
                return this;
            }

            public LeaderboardResponse build() {
                return new LeaderboardResponse(weekStart, weekEnd, levelId, totalMembers, entries, myEntry);
            }
        }
    }

    public record LeaderboardEntryDTO(
        Integer rank,
        Long memberId,
        String memberName,
        String avatarUrl,
        java.math.BigDecimal totalScore,
        ScoreBreakdownDTO breakdown,
        Integer previousRank,
        Integer rankChange,
        String fitnessLevel
    ) {
        public static LeaderboardEntryDTO from(MemberWeeklyScore score) {
            return from(score, score.getRank());
        }

        public static LeaderboardEntryDTO from(MemberWeeklyScore score, Integer rank) {
            return new LeaderboardEntryDTO(
                rank,
                score.getMember().getId(),
                score.getMember().getUser().getFullName(),
                score.getMember().getUser().getAvatarUrl(),
                score.getTotalScore(),
                new ScoreBreakdownDTO(
                    score.getSessionsScore(),
                    score.getTimeScore(),
                    score.getAccuracyScore(),
                    score.getRestDayBonus(),
                    score.getStreakBonus()),
                score.getPreviousRank(),
                score.getRankChange(),
                score.getFitnessLevel() != null ? score.getFitnessLevel().getName() : "Global"
            );
        }
    }

    public record ScoreBreakdownDTO(
        java.math.BigDecimal sessionsScore,
        java.math.BigDecimal timeScore,
        java.math.BigDecimal accuracyScore,
        java.math.BigDecimal restDayBonus,
        java.math.BigDecimal streakBonus
    ) {}

    public record MemberWeekHistoryResponse(
        Long memberId,
        List<MemberWeekEntryDTO> weeks
    ) {
        public static MemberWeekHistoryResponseBuilder builder() {
            return new MemberWeekHistoryResponseBuilder();
        }

        public static class MemberWeekHistoryResponseBuilder {
            private Long memberId;
            private List<MemberWeekEntryDTO> weeks;

            public MemberWeekHistoryResponseBuilder memberId(Long memberId) {
                this.memberId = memberId;
                return this;
            }

            public MemberWeekHistoryResponseBuilder weeks(List<MemberWeekEntryDTO> weeks) {
                this.weeks = weeks;
                return this;
            }

            public MemberWeekHistoryResponse build() {
                return new MemberWeekHistoryResponse(memberId, weeks);
            }
        }
    }

    public record MemberWeekEntryDTO(
        LocalDate weekStart,
        Integer rank,
        java.math.BigDecimal totalScore,
        Integer rankChange
    ) {}

    /** Chi tiết điểm của 1 member trong 1 tuần. */
    public record ScoreBreakdownResponse(
        Long memberId,
        LocalDate weekStart,
        LocalDate weekEnd,
        Integer rank,
        java.math.BigDecimal totalScore,
        ScoreComponentsDTO components
    ) {}

    /** Từng thành phần điểm của tuần. */
    public record ScoreComponentsDTO(
        java.math.BigDecimal sessionsScore,
        java.math.BigDecimal timeScore,
        java.math.BigDecimal accuracyScore,
        java.math.BigDecimal restDayBonus,
        java.math.BigDecimal streakBonus
    ) {}
}
