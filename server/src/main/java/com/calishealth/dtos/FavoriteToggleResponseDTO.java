package com.calishealth.dtos;

/**
 * Kết quả toggle favorite.
 *
 * @param itemType loại nội dung vừa toggle
 * @param itemId   id nội dung
 * @param favorite true nếu hiện đang được yêu thích sau khi toggle
 * @param count    tổng số lượt yêu thích của nội dung đó (saveCount)
 */
public record FavoriteToggleResponseDTO(
        String itemType,
        Long itemId,
        boolean favorite,
        int count
) {}
