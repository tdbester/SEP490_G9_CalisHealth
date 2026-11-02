package com.calishealth.controllers;

import com.calishealth.dtos.DailyPlanDtos.DailyPlanStatusRequest;
import com.calishealth.dtos.DailyPlanDtos.DailyPlanTemplateRequest;
import com.calishealth.dtos.DailyPlanDtos.DailyPlanTemplateResponse;
import com.calishealth.service.DailyPlanTemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Daily Training Plan Templates (secured as ROLE_CONTENT_MANAGER by /api/content/**). */
@RestController
@RequestMapping("/api/content/daily-plan-templates")
@RequiredArgsConstructor
public class DailyPlanTemplateController {
    private final DailyPlanTemplateService templates;

    @GetMapping
    public List<DailyPlanTemplateResponse> list() {
        return templates.findAll();
    }

    @GetMapping("/{code}")
    public DailyPlanTemplateResponse get(@PathVariable String code) {
        return templates.findByCode(code);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DailyPlanTemplateResponse create(@RequestBody DailyPlanTemplateRequest request, Authentication authentication) {
        return templates.create(request, authentication.getName());
    }

    @PutMapping("/{code}")
    public DailyPlanTemplateResponse update(@PathVariable String code, @RequestBody DailyPlanTemplateRequest request) {
        return templates.update(code, request);
    }

    @PatchMapping("/{code}/status")
    public DailyPlanTemplateResponse updateStatus(@PathVariable String code, @RequestBody DailyPlanStatusRequest request) {
        return templates.updateStatus(code, request.active());
    }

    @DeleteMapping("/{code}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String code) {
        templates.delete(code);
    }
}
