package com.calishealth.controllers;

import com.calishealth.dtos.LibraryOverviewDTO;
import com.calishealth.service.LibraryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/library")
@RequiredArgsConstructor
public class LibraryOverviewController {
    private final LibraryService libraryService;

    /**
     * Số liệu tổng quan của Library. Mở cho GUEST (chưa đăng nhập) nên khi không
     * có phiên đăng nhập thì các nhóm nội dung của Member trả về 0.
     */
    @GetMapping("/overview")
    public ResponseEntity<LibraryOverviewDTO> getOverview(Authentication authentication) {
        String email = null;
        if (authentication != null && authentication.isAuthenticated()) {
            Object principal = authentication.getPrincipal();
            if (principal instanceof String value
                    && !value.isBlank()
                    && !"anonymousUser".equals(value)) {
                email = value;
            }
        }
        return ResponseEntity.ok(libraryService.getOverview(email));
    }
}
