package com.calishealth.security;

import com.calishealth.service.MaintenanceScheduleService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class MaintenanceEnforcementFilter extends OncePerRequestFilter {
    private static final String MEMBER_ROLE = "ROLE_MEMBER";

    /**
     * Danh sách endpoint ĐỌC danh mục công khai (guest cũng xem được).
     *
     * <p>Chỉ endpoint trả về dữ liệu chung của thư viện, đúng với các route
     * {@code permitAll} trong {@code SecurityConfig}. Endpoint riêng của member
     * (bài tập cá nhân {@code /api/library/member-exercises}, chi tiết bài tập
     * {@code /api/library/exercises/&#123;id&#125;}) vẫn phải bị chặn khi bảo trì —
     * nếu không thì member vẫn đọc được dữ liệu cá nhân trong lúc toàn bộ app
     * member đang bảo trì.</p>
     */
    private static final java.util.Set<String> PUBLIC_CATALOG_PATHS = java.util.Set.of(
            "/api/library/levels",
            "/api/library/summary",
            "/api/library/counts",
            "/api/library/exercises"
    );

    private static final Map<String, String> SERVICE_MESSAGES = Map.of(
            "MEMBER_APP_ACCESS", "Ứng dụng thành viên đang trong thời gian bảo trì.",
            "MEMBER_VIDEO_UPLOADS", "Dịch vụ tải lên video bài tập đang trong thời gian bảo trì.",
            "AI_POSE_ASSESSMENT", "Dịch vụ đánh giá tư thế AI đang bảo trì.",
            "SYSTEM_STORAGE_CDN", "Dịch vụ lưu trữ và phân phối media đang bảo trì."
    );

    private final MaintenanceScheduleService schedules;

    public MaintenanceEnforcementFilter(MaintenanceScheduleService schedules) {
        this.schedules = schedules;
    }
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
            String path = request.getRequestURI();
            for (String serviceKey : servicesForRequest(request, path)) {
                if (schedules.isServiceUnderMaintenance(serviceKey)) {
                    response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    response.setCharacterEncoding("UTF-8");
                    objectMapper.writeValue(response.getWriter(), Map.of(
                            "code", "SERVICE_UNDER_MAINTENANCE",
                            "serviceKey", serviceKey,
                            "message", SERVICE_MESSAGES.get(serviceKey)
                    ));
                    return;
                }
            }
            filterChain.doFilter(request, response);
    }

    private List<String> servicesForRequest(HttpServletRequest request, String path) {
            if ("OPTIONS".equalsIgnoreCase(request.getMethod())) return List.of();

            if (path.startsWith("/media/")) return List.of("SYSTEM_STORAGE_CDN");

            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication == null || !authentication.getAuthorities().stream()
                    .anyMatch(authority -> MEMBER_ROLE.equals(authority.getAuthority()))) {
                return isMediaUpload(request, path) ? List.of("SYSTEM_STORAGE_CDN") : List.of();
            }

            List<String> serviceKeys = new ArrayList<>(4);
            if (!isPublicPath(request, path)) serviceKeys.add("MEMBER_APP_ACCESS");
            if (isMemberVideoUpload(request, path)) serviceKeys.add("MEMBER_VIDEO_UPLOADS");
            if (isMediaUpload(request, path)) serviceKeys.add("SYSTEM_STORAGE_CDN");
            if ("POST".equalsIgnoreCase(request.getMethod())
                    && "/api/member/progression/results".equals(path)) {
                serviceKeys.add("AI_POSE_ASSESSMENT");
            }
            return serviceKeys;
    }

    private static boolean isPublicPath(HttpServletRequest request, String path) {
        String method = request.getMethod();
        if (path.startsWith("/api/public/")) return true;
        // Chỉ những endpoint ĐỌC danh mục công khai mới được miễn bảo trì.
        // Trước đây mọi GET dưới /api/library/ đều bị bỏ qua, kể cả các endpoint
        // riêng của member (danh sách bài tập cá nhân, chi tiết bài tập) — sai vì
        // các endpoint đó đã bị SecurityConfig yêu cầu role MEMBER.
        if ("GET".equalsIgnoreCase(method) && PUBLIC_CATALOG_PATHS.contains(path)) return true;
        if ("/api/dashboard".equals(path) && "GET".equalsIgnoreCase(method)) return true;
        return switch (path) {
            case "/api/auth/me", "/api/auth/change-password",
                    "/api/auth/register",
                    "/api/auth/verify",
                    "/api/auth/login",
                    "/api/auth/forgot-password",
                    "/api/auth/verify-reset-token",
                    "/api/auth/reset-password" -> true;
            default -> false;
        };
    }

    private static boolean isMemberVideoUpload(HttpServletRequest request, String path) {
        String method = request.getMethod();
        if (path.equals("/api/v1/library/personal-exercises")) {
            return "POST".equalsIgnoreCase(method);
        }
        if (path.startsWith("/api/v1/library/personal-exercises/")) {
            return "PUT".equalsIgnoreCase(method);
        }
        return false;
    }

    private static boolean isMediaUpload(HttpServletRequest request, String path) {
        String method = request.getMethod();
        boolean exerciseApi = path.equals("/api/content/exercises")
                || path.startsWith("/api/content/exercises/")
                || path.equals("/api/v1/library/personal-exercises")
                || path.startsWith("/api/v1/library/personal-exercises/");
        return exerciseApi
                && ("POST".equalsIgnoreCase(method) || "PUT".equalsIgnoreCase(method));
    }
}
