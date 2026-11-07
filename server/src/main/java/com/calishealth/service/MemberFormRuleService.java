package com.calishealth.service;

import com.calishealth.dtos.MemberFormRuleDtos.FormRuleResponse;
import com.calishealth.dtos.MemberFormRuleDtos.FormRulesResponse;
import com.calishealth.repository.FormRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Lấy cấu hình chấm form do Content Manager khai báo cho từng bài tập.
 * Màn AI Pose Tracking dùng các rule này để sinh câu nhắc voice coach.
 */
@Service
@RequiredArgsConstructor
public class MemberFormRuleService {

    private final FormRuleRepository formRules;

    @Transactional(readOnly = true)
    public FormRulesResponse getFormRules(String exerciseCode) {
        List<FormRuleResponse> rules = formRules.findByExerciseCode(exerciseCode).stream()
                .map(rule -> new FormRuleResponse(
                        rule.getId(),
                        rule.getJoint(),
                        rule.getAngleThreshold(),
                        rule.getRomDepth(),
                        rule.getFeedbackMessage()))
                .toList();
        return new FormRulesResponse(exerciseCode, rules);
    }
}
