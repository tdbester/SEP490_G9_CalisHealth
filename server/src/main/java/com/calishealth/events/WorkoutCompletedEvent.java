package com.calishealth.events;

/**
 * Member vừa hoàn thành một buổi tập.
 *
 * <p>Được phát sau khi buổi tập đã ghi xong để bảng xếp hạng cộng điểm ngay,
 * không phải chờ job cuối tuần.</p>
 *
 * @param memberProfileId id của member vừa tập xong
 */
public record WorkoutCompletedEvent(Long memberProfileId) {
}
