package com.calishealth.controllers;

import com.calishealth.dtos.AdminDashboardDtos.SystemOverviewResponse;
import com.calishealth.service.AdminDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * API tổng quan hệ thống cho Admin Dashboard.
 *
 * <p>Bảo vệ bởi SecurityConfig: {@code /api/admin/**} yêu cầu ROLE_ADMIN.
 */
@RestController
@RequestMapping("/api/admin/dashboard")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminDashboardController {
    private final AdminDashboardService service;

    /** Số liệu thật: tổng người dùng, tổng bài tập kỹ năng, tổng bài tập sức khỏe. */
    @GetMapping("/overview")
    public SystemOverviewResponse overview() {
        return service.getSystemOverview();
    }
}
