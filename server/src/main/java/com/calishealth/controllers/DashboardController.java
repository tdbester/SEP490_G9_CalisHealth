package com.calishealth.controllers;

import com.calishealth.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.Authentication;
import tools.jackson.databind.node.ObjectNode;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {
    private final DashboardService dashboardService;

    @GetMapping
    public ObjectNode getDashboard(Authentication authentication) {
        return dashboardService.getDashboard(authentication == null ? null : authentication.getName());
    }
}
