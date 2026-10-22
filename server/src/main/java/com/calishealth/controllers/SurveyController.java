package com.calishealth.controllers;

import com.calishealth.dtos.SurveyDtos.SurveyDefinitionResponse;
import com.calishealth.service.SurveyService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/surveys")
@RequiredArgsConstructor
public class SurveyController {
    private final SurveyService surveys;

    @GetMapping("/{surveyCode}")
    public SurveyDefinitionResponse definition(
            @PathVariable String surveyCode,
            @RequestParam(required = false) Integer version) {
        return surveys.getDefinition(surveyCode, version);
    }
}
