package com.calishealth.controllers;

import com.calishealth.dtos.ProgressionRuleDtos.ExerciseResultResponse;
import com.calishealth.dtos.ProgressionRuleDtos.SubmitExerciseResultRequest;
import com.calishealth.service.ProgressionRuleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Member gửi số đếm từng set (MediaPipe chạy ở client); server tính % clean và mở khóa bài tiếp theo. */
@RestController
@RequestMapping("/api/member/progression")
@RequiredArgsConstructor
public class MemberProgressionController {
    private final ProgressionRuleService progressionRules;

    @PostMapping("/results")
    @ResponseStatus(HttpStatus.CREATED)
    public ExerciseResultResponse submit(@Valid @RequestBody SubmitExerciseResultRequest request, Authentication authentication) {
        return progressionRules.submitResult(authentication.getName(), request);
    }
}
