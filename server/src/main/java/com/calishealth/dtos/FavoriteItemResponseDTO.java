package com.calishealth.dtos;

import java.time.LocalDateTime;

/**
 * Một mục đã yêu thích trả về cho màn "Favorites".
 *
 * <p>Các trường huấn luyện (category / sets / reps / duration) được nhân bản từ nội dung
 * gốc để màn Favorites có thể mở buổi tập ngay mà không cần gọi thêm API chi tiết.
 *
 * @param id         id của bản ghi favorite (dùng cho optimistic UI)
 * @param itemType   SYSTEM_EXERCISE | MEMBER_EXERCISE | SYSTEM_WORKOUT | MEMBER_WORKOUT
 * @param itemId     id của bài tập / workout gốc
 * @param title      tên hiển thị
 * @param level      cấp độ (BEGINNER / INTERMEDIATE / ADVANCED) — có thể null
 * @param authorName tên tác giả (null với nội dung của hệ thống)
 * @param source     SYSTEM | CUSTOM — nguồn của nội dung gốc
 * @param meta       mô tả ngắn (nhóm cơ, số set…)
 * @param totalItems số bài tập trong workout (0 với bài tập đơn lẻ)
 * @param estimatedDuration thời lượng ước tính (phút) — 0 với bài tập đơn lẻ
 * @param code       mã bài tập / workout (dùng để mở màn tracking AI)
 * @param category   HOLD | REPS — cách đo của bài tập
 * @param defaultSets số set mặc định
 * @param defaultReps số lần mặc định
 * @param defaultDuration số giây mặc định (cho bài HOLD)
 * @param createdAt  thời điểm member đánh dấu sao
 */
public record FavoriteItemResponseDTO(
        Long id,
        String itemType,
        Long itemId,
        String title,
        String level,
        String authorName,
        String source,
        String meta,
        int totalItems,
        int estimatedDuration,
        String code,
        String category,
        Integer defaultSets,
        Integer defaultReps,
        Integer defaultDuration,
        LocalDateTime createdAt
) {}
