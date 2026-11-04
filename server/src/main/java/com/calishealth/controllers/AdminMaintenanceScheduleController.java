package com.calishealth.controllers;

import com.calishealth.dtos.CreateMaintenanceScheduleRequestDto;
import com.calishealth.dtos.MaintenanceScheduleResponseDto;
import com.calishealth.models.AffectedArea;
import com.calishealth.service.MaintenanceScheduleService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping({"/api/admin/maintenance-schedules", "/api/admin/maintenance"})
@PreAuthorize("hasRole('ADMIN')")
public class AdminMaintenanceScheduleController {
    private final MaintenanceScheduleService schedules;

    public AdminMaintenanceScheduleController(MaintenanceScheduleService schedules) {
        this.schedules = schedules;
    }

    @GetMapping
    public ResponseEntity<Page<MaintenanceScheduleResponseDto>> getSchedules(
            @RequestParam(defaultValue = "0") int page
    ) {
        return ResponseEntity.ok(schedules.getSchedules(page));
    }

    @GetMapping("/service-status")
    public ResponseEntity<Map<String, Boolean>> getServiceStatus(
            @RequestParam AffectedArea serviceKey
    ) {
        return ResponseEntity.ok(Map.of(
                serviceKey.name(),
                schedules.isServiceUnderMaintenance(serviceKey.name())
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<MaintenanceScheduleResponseDto> getSchedule(@PathVariable Long id) {
        return ResponseEntity.ok(schedules.getSchedule(id));
    }

    @PostMapping
    public ResponseEntity<MaintenanceScheduleResponseDto> create(
            @Valid @RequestBody CreateMaintenanceScheduleRequestDto request,
            Authentication authentication
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(schedules.create(request, authentication.getName()));
    }

    @RequestMapping(
            path = "/{id}/cancel",
            method = {RequestMethod.PATCH, RequestMethod.POST}
    )
    public ResponseEntity<MaintenanceScheduleResponseDto> cancel(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(schedules.cancel(id, authentication.getName()));
    }
}
