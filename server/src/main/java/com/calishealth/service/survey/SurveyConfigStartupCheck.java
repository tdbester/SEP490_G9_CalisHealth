package com.calishealth.service.survey;

import com.calishealth.models.Survey;
import com.calishealth.repository.SurveyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Kiểm tra cấu hình mọi survey ACTIVE khi khởi động để lỗi cấu hình hiện ra trong log ngay,
 * thay vì đợi người dùng gọi API. Chỉ log, không chặn ứng dụng khởi động.
 */
@Component
@Order(2)
@RequiredArgsConstructor
@Slf4j
public class SurveyConfigStartupCheck implements ApplicationRunner {
    private final SurveyRepository surveys;
    private final SurveyDefinitionLoader loader;

    @Override
    @Transactional(readOnly = true)
    public void run(ApplicationArguments args) {
        for (Survey survey : surveys.findByStatus(Survey.Status.ACTIVE)) {
            try {
                loader.load(survey);
                log.info("Survey {} v{} configuration OK", survey.getSurveyCode(), survey.getVersion());
            } catch (RuntimeException exception) {
                // chi tiết đã được SurveyDefinitionLoader log
                log.error("Survey {} v{} configuration check failed: {}", survey.getSurveyCode(),
                        survey.getVersion(), exception.getMessage());
            }
        }
    }
}
