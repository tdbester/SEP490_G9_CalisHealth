package com.calishealth.config;

import com.calishealth.service.WeeklyLeaderboardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;

@Component
@RequiredArgsConstructor
@Slf4j
public class LeaderboardScheduler {
    /** Số tuần được tính lại mỗi khi app khởi động (tuần hiện tại + 11 tuần trước). */
    private static final int BACKFILL_WEEKS = 12;

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
            LocalDate lastMonday = mondayOf(LocalDate.now()).minusWeeks(1);
            leaderboardService.computeScoresForWeek(lastMonday);
            log.info("Weekly leaderboard computation completed successfully");
        } catch (Exception e) {
            log.error("Error computing weekly leaderboard", e);
        }
    }

    /**
     * Tính lại điểm cho các tuần gần nhất khi app khởi động.
     *
     * <p>Điểm leaderboard là dữ liệu tính từ hoạt động thật (buổi tập, thời gian,
     * accuracy), nên phải chạy lại sau mỗi lần có buổi tập mới. Tính sẵn lúc
     * start giúp bảng xếp hạng luôn khớp với dữ liệu mới nhất mà không cần
     * chờ job thứ 2 đầu tuần.</p>
     */
    @EventListener(ApplicationReadyEvent.class)
    public void backfillOnStartup() {
        try {
            LocalDate currentMonday = mondayOf(LocalDate.now());
            for (int week = BACKFILL_WEEKS - 1; week >= 0; week--) {
                leaderboardService.computeScoresForWeek(currentMonday.minusWeeks(week));
            }
            log.info("Leaderboard backfill completed for {} weeks", BACKFILL_WEEKS);
        } catch (Exception e) {
            log.error("Error backfilling leaderboard scores on startup", e);
        }
    }

    /** Thứ 2 của tuần chứa date. */
    private static LocalDate mondayOf(LocalDate date) {
        return date.with(DayOfWeek.MONDAY);
    }
}
