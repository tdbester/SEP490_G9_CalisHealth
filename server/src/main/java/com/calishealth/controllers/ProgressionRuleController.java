package com.calishealth.controllers;

import com.calishealth.dtos.ProgressionRuleDtos.RuleDetail;
import com.calishealth.dtos.ProgressionRuleDtos.RuleList;
import com.calishealth.dtos.ProgressionRuleDtos.SaveRuleRequest;
import com.calishealth.dtos.ProgressionRuleDtos.UpdateRuleRequest;
import com.calishealth.service.ProgressionRuleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Màn Progression Rules của Content Manager. /api/content/** đã giới hạn ROLE_CONTENT_MANAGER ở SecurityConfig. */
@RestController
@RequestMapping("/api/content/progression-rules")
@RequiredArgsConstructor
public class ProgressionRuleController {
    private final ProgressionRuleService progressionRules;

    @GetMapping
    public RuleList list() {
        return progressionRules.list();
    }

    @GetMapping("/{id}")
    public RuleDetail detail(@PathVariable Long id) {
        return progressionRules.detail(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RuleDetail create(@Valid @RequestBody SaveRuleRequest request) {
        return progressionRules.create(request);
    }

    @PutMapping("/{id}")
    public RuleDetail update(@PathVariable Long id, @Valid @RequestBody UpdateRuleRequest request) {
        return progressionRules.update(id, request);
    }

    @PatchMapping("/{id}/status")
    public RuleDetail updateStatus(@PathVariable Long id, @RequestParam String status) {
        return progressionRules.updateStatus(id, status);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        progressionRules.delete(id);
    }
}
