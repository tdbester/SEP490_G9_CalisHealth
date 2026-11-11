package com.calishealth.service;

import com.calishealth.events.MemberFitnessLevelChangedEvent;
import com.calishealth.events.WorkoutCompletedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Phản hồi các sự kiện liên quan tới bảng xếp hạng.
 *
 * <p>Mọi xử lý chạy SAU khi transaction đã commit ({@code AFTER_COMMIT}) và
 * trong transaction riêng ({@code REQUIRES_NEW}): nếu tính điểm chạy trong
 * cùng transaction với việc ghi buổi tập thì một lỗi tính điểm sẽ làm mất
 * luôn kết quả buổi tập của member.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class LeaderboardEventListener {

    private final WeeklyLeaderboardService leaderboardService;

    /** Member vừa tập xong -> cộng điểm tuần ngay. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onWorkoutCompleted(WorkoutCompletedEvent event) {
        try {
            leaderboardService.refreshMemberScore(event.memberProfileId());
        } catch (Exception e) {
            // Lỗi tính điểm không được ảnh hưởng tới kết quả buổi tập.
            log.warn("Could not refresh leaderboard score for member {}: {}",
                    event.memberProfileId(), e.getMessage());
        }
    }

    /** Member đổi level -> xóa điểm tuần đã tính và tính lại từ đầu. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onFitnessLevelChanged(MemberFitnessLevelChangedEvent event) {
        try {
            leaderboardService.resetAndRecomputeMemberScore(event.memberProfileId());
        } catch (Exception e) {
            log.warn("Could not reset leaderboard score for member {} after a level change: {}",
                    event.memberProfileId(), e.getMessage());
        }
    }
}
