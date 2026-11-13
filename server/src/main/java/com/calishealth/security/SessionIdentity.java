package com.calishealth.security;

import org.springframework.security.core.Authentication;

/**
 * Tiện ích xác định danh tính của người gọi API.
 *
 * <p>Ở các endpoint mở cho cả GUEST (permitAll), Spring Security vẫn gắn
 * một {@code AnonymousAuthenticationToken} vào SecurityContext với principal
 * là chuỗi {@code "anonymousUser"}. Vì vậy không được dùng
 * {@code authentication.getPrincipal()} một cách trực tiếp để kết luận "có
 * đăng nhập hay không" — phải loại trừ chuỗi này.
 */
public final class SessionIdentity {

    /** Principal của request chưa đăng nhập (anonymous) do Spring Security tạo. */
    public static final String ANONYMOUS_PRINCIPAL = "anonymousUser";

    private SessionIdentity() {
    }

    /**
     * Email của người đang đăng nhập, hoặc {@code null} khi là GUEST /
     * request không có phiên.
     */
    public static String emailOf(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        Object principal = authentication.getPrincipal();
        if (!(principal instanceof String email)) {
            return null;
        }
        String trimmed = email.trim();
        if (trimmed.isEmpty() || ANONYMOUS_PRINCIPAL.equals(trimmed)) {
            return null;
        }
        return trimmed;
    }

    /** {@code true} khi người gọi chưa đăng nhập (GUEST). */
    public static boolean isGuest(Authentication authentication) {
        return emailOf(authentication) == null;
    }
}
