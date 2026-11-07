package com.calishealth.config;

import com.calishealth.service.WeeklyLeaderboardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

@Component
@RequiredArgsConstructor
@Slf4j
public class LeaderboardScheduler {
    private final WeeklyLeaderboardService leaderboardService;

    /**
     * 每周一 00:00 UTC+7 计算上周排名
     * Cron: 0 0 0 ? * MON
     * 时区: Asia/Ho_Chi_Minh
     */
    @Scheduled(cron = "0 0 0 ? * MON", zone = "Asia/Ho_Chi_Minh")
    public void computeWeeklyLeaderboard() {
        log.info("Starting weekly leaderboard computation...");
        try {
            LocalDate lastMonday = LocalDate.now().minusWeeks(1).minusDays(LocalDate.now().minusWeeks(1).getDayOfWeek().getValue() - 1);
            leaderboardService.computeScoresForWeek(lastMonday);
            log.info("Weekly leaderboard computation completed successfully");
        } catch (Exception e) {
            log.error("Error computing weekly leaderboard", e);
        }
    }
}
