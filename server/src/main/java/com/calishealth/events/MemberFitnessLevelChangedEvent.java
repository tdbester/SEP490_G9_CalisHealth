package com.calishealth.events;

/**
 * Member đổi trình độ thể lực (fitness level).
 *
 * <p>Khi đổi level giữa tuần, toàn bộ điểm đã tính trong tuần của member bị
 * xóa và tính lại từ đầu dưới level mới, để không còn dòng điểm cũ treo lơ
 * lửng ở level cũ.</p>
 *
 * @param memberProfileId id của member vừa đổi level
 */
public record MemberFitnessLevelChangedEvent(Long memberProfileId) {
}
