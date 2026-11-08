package com.calishealth.controllers;

import com.calishealth.dtos.CreateMaintenanceScheduleRequestDto;
import com.calishealth.dtos.MaintenanceScheduleResponseDto;
import com.calishealth.dtos.UpdateMaintenanceLockRequestDto;
import com.calishealth.models.AffectedArea;
import com.calishealth.service.MaintenanceAreaLockService;
import com.calishealth.service.MaintenanceScheduleService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/admin/maintenance-schedules", "/api/admin/maintenance"})
@PreAuthorize("hasRole('ADMIN')")
public class AdminMaintenanceScheduleController {
    private final MaintenanceScheduleService schedules;
    private final MaintenanceAreaLockService areaLocks;

    public AdminMaintenanceScheduleController(
            MaintenanceScheduleService schedules,
            MaintenanceAreaLockService areaLocks
    ) {
        this.schedules = schedules;
        this.areaLocks = areaLocks;
    }

    @GetMapping
    public ResponseEntity<Page<MaintenanceScheduleResponseDto>> getSchedules(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) LocalDateTime startsFrom,
            @RequestParam(required = false) LocalDateTime startsBefore
    ) {
        return ResponseEntity.ok(
                schedules.getSchedules(page, title, startsFrom, startsBefore)
        );
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

    @GetMapping("/locks")
    public ResponseEntity<List<com.calishealth.dtos.MaintenanceAreaLockResponseDto>> getLocks() {
        return ResponseEntity.ok(areaLocks.getLocks());
    }

    @PatchMapping("/locks")
    public ResponseEntity<com.calishealth.dtos.MaintenanceAreaLockResponseDto> updateLock(
            @Valid @RequestBody UpdateMaintenanceLockRequestDto request
    ) {
        return ResponseEntity.ok(
                areaLocks.setLock(request.area(), request.locked(), request.reason())
        );
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
            path = "/{id}/start",
            method = {RequestMethod.PATCH, RequestMethod.POST}
    )
    public ResponseEntity<MaintenanceScheduleResponseDto> start(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(schedules.start(id, authentication.getName()));
    }

    @RequestMapping(
            path = "/{id}/complete",
            method = {RequestMethod.PATCH, RequestMethod.POST}
    )
    public ResponseEntity<MaintenanceScheduleResponseDto> complete(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(schedules.complete(id, authentication.getName()));
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
