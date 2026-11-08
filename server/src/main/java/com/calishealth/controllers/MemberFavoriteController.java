package com.calishealth.controllers;

import com.calishealth.dtos.FavoriteItemResponseDTO;
import com.calishealth.dtos.FavoriteToggleResponseDTO;
import com.calishealth.service.MemberFavoriteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * API yêu thích (bookmark) của Member.
 *
 * <p>Route dưới {@code /api/v1/library/favorites} được bảo vệ bằng rule
 * {@code /api/v1/library/**} trong SecurityConfig (role MEMBER).
 */
@RestController
@RequestMapping("/api/v1/library/favorites")
@RequiredArgsConstructor
@PreAuthorize("hasRole('MEMBER')")
public class MemberFavoriteController {
    private final MemberFavoriteService favoriteService;

    /** Danh sách mọi mục Member đã đánh dấu sao (đã kèm nhóm System / Member). */
    @GetMapping
    public ResponseEntity<List<FavoriteItemResponseDTO>> list(Authentication authentication) {
        return ResponseEntity.ok(favoriteService.list(authentication.getName()));
    }

    /**
     * Bật/tắt yêu thích cho một mục.
     *
     * @param itemType SYSTEM_EXERCISE | MEMBER_EXERCISE | SYSTEM_WORKOUT | MEMBER_WORKOUT
     */
    @PostMapping("/{itemType}/{itemId}/toggle")
    public ResponseEntity<FavoriteToggleResponseDTO> toggle(
            @PathVariable String itemType,
            @PathVariable Long itemId,
            Authentication authentication
    ) {
        return ResponseEntity.ok(favoriteService.toggle(authentication.getName(), itemType, itemId));
    }
}
