package com.calishealth.service;

import com.calishealth.events.MemberFitnessLevelChangedEvent;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.MemberProfile;
import com.calishealth.repository.MemberProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

/**
 * Đổi trình độ thể lực (fitness level) của member.
 *
 * <p>Mọi nơi trong hệ thống đổi level đều phải đi qua đây để không bỏ sót
 * việc cập nhật bảng xếp hạng: khi đổi level giữa tuần, điểm đã tính trong
 * tuần của member bị xóa và tính lại từ đầu dưới level mới.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MemberFitnessLevelService {

    private final MemberProfileRepository memberProfiles;
    private final ApplicationEventPublisher events;

    /**
     * Gán level mới cho member và báo lại để tính lại điểm leaderboard.
     *
     * @param profile hồ sơ member (đã được load)
     * @param level   level mới, null nghĩa là không đổi
     */
    public void changeLevel(MemberProfile profile, FitnessLevel level) {
        if (profile == null || level == null) {
            return;
        }

        FitnessLevel current = profile.getFitnessLevel();
        if (current != null && current.getId() != null && current.getId().equals(level.getId())) {
            // Không đổi level -> không cần tính lại điểm.
            return;
        }

        Long previousLevelId = current != null ? current.getId() : null;
        profile.setFitnessLevel(level);
        memberProfiles.save(profile);

        log.info("Member {} changed fitness level from {} to {}",
                profile.getId(), previousLevelId, level.getId());

        // Phát event sau khi transaction commit (listener xử lý), nên ở đây chỉ
        // cần đưa id member đi.
        events.publishEvent(new MemberFitnessLevelChangedEvent(profile.getId()));
    }
}
