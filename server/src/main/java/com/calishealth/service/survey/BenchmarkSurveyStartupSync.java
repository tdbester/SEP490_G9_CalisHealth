package com.calishealth.service.survey;

import com.calishealth.service.LevelBenchmarkService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Đồng bộ bước Level test với bảng Exercise point rules ngay khi khởi động, để DB đã có sẵn bài tập
 * (vd Dips) mà chưa có câu hỏi tương ứng vẫn hiện đủ trong survey mà không cần lưu lại bảng. Chạy trước
 * {@link SurveyConfigStartupCheck} để bước kiểm tra cấu hình thấy dữ liệu đã đồng bộ. Lỗi chỉ được log.
 */
@Component
@Order(1)
@RequiredArgsConstructor
@Slf4j
public class BenchmarkSurveyStartupSync implements ApplicationRunner {
    private final LevelBenchmarkService levelBenchmarks;
    private final BenchmarkSurveySync surveySync;

    @Override
    public void run(ApplicationArguments args) {
        try {
            surveySync.sync(levelBenchmarks.getConfiguration().exercises(), List.of(), null);
        } catch (RuntimeException exception) {
            log.error("Could not sync the Level test step with the benchmark exercises: {}", exception.getMessage(), exception);
        }
    }
}
