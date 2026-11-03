package com.calishealth.service.survey.level;

import com.calishealth.models.LevelRuleSet;
import com.calishealth.repository.LevelRuleSetRepository;
import com.calishealth.service.SurveyService;
import com.calishealth.service.survey.SurveyDefinitionLoader;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Kiểm tra mọi bộ luật level ACTIVE với survey ACTIVE tương ứng khi khởi động, để lỗi cấu hình hiện ra
 * trong log ngay thay vì âm thầm rơi về level dự phòng khi member hoàn thành khảo sát. Chỉ log.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class LevelRuleStartupCheck implements ApplicationRunner {
    private final LevelRuleSetRepository ruleSets;
    private final LevelRuleSetLoader loader;
    private final SurveyService surveys;
    private final SurveyDefinitionLoader surveyLoader;

    @Override
    @Transactional(readOnly = true)
    public void run(ApplicationArguments args) {
        for (LevelRuleSet ruleSet : ruleSets.findByStatus(LevelRuleSet.Status.ACTIVE)) {
            try {
                List<String> problems = new ArrayList<>();
                loader.load(ruleSet, surveyLoader.load(surveys.findActiveSurvey(ruleSet.getSurveyCode())), problems);
                if (problems.isEmpty()) {
                    log.info("Level rule set {} v{} configuration OK", ruleSet.getRuleSetCode(), ruleSet.getVersion());
                } else {
                    log.error("Level rule set {} v{} has an invalid configuration:\n - {}", ruleSet.getRuleSetCode(),
                            ruleSet.getVersion(), String.join("\n - ", problems));
                }
            } catch (RuntimeException exception) {
                log.error("Level rule set {} v{} configuration check failed: {}", ruleSet.getRuleSetCode(),
                        ruleSet.getVersion(), exception.getMessage());
            }
        }
    }
}
