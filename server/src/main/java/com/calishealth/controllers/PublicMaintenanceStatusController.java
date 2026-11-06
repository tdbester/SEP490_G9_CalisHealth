package com.calishealth.controllers;

import com.calishealth.models.AffectedArea;
import com.calishealth.service.MaintenanceScheduleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/public/maintenance")
@RequiredArgsConstructor
public class PublicMaintenanceStatusController {
    private final MaintenanceScheduleService schedules;

    @GetMapping("/service-status")
    public ResponseEntity<Map<String, Object>> getServiceStatus(@RequestParam AffectedArea serviceKey) {
        return ResponseEntity.ok(Map.of(
                "serviceKey", serviceKey.name(),
                "isUnderMaintenance", schedules.isServiceUnderMaintenance(serviceKey.name())
        ));
    }
}
