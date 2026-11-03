package com.calishealth.service.survey;

import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkExercise;
import com.calishealth.models.AssessmentQuestion;
import com.calishealth.models.ConfigStatus;
import com.calishealth.models.Survey;
import com.calishealth.models.SurveyStep;
import com.calishealth.models.SurveyStepQuestion;
import com.calishealth.models.User;
import com.calishealth.repository.AssessmentAnswerRepository;
import com.calishealth.repository.AssessmentQuestionRepository;
import com.calishealth.repository.SurveyRepository;
import com.calishealth.repository.SurveyStepQuestionRepository;
import com.calishealth.repository.SurveyStepRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.node.ObjectNode;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Giữ bước "Level test" của survey luôn khớp bảng Exercise point rules (Level Benchmark Criteria).
 *
 * <p>Mỗi bài tập trong bảng đó có một "slot" = mã câu hỏi NUMBER cung cấp số rep / số giây của member.
 * Khi content manager thêm / bỏ bài tập, hàm {@link #sync} tạo câu hỏi còn thiếu và gắn vào bước LEVEL_TEST,
 * nên member thấy ngay danh sách mới mà không ai phải vào Survey management sửa tay. Thiếu câu hỏi cho một
 * bài thì không chấm level được (LevelBenchmarkService cần đáp án của mọi bài).</p>
 *
 * <ul>
 *   <li>Câu hỏi đã có (vd PUSH_UP_MAX_REPS) giữ nguyên nội dung; chỉ bật lại nếu đang INACTIVE và bổ sung
 *       display_config khi còn trống.</li>
 *   <li>Bài bị gỡ khỏi bảng: câu đã có member trả lời thì ẩn khỏi bước (câu trả lời cũ vẫn đọc được),
 *       chưa có thì gỡ liên kết. Câu hỏi trong ngân hàng không bị xóa.</li>
 *   <li>Chỉ đụng tới các câu có mã là slot; câu khác content manager thêm vào bước được giữ nguyên.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class BenchmarkSurveySync {
    /** Mã bước chứa các câu kiểm tra trình độ (xem seed_survey_management.sql). */
    public static final String LEVEL_TEST_STEP_CODE = "LEVEL_TEST";
    private static final String NUMBER = "NUMBER";
    /** Quy ước mã slot của LevelBenchmarkService: PUSH_UP_MAX_REPS, PLANK_MAX_SECONDS, ... */
    private static final Pattern SLOT_CODE = Pattern.compile(".+_MAX_(REPS|SECONDS)");

    private final SurveyRepository surveys;
    private final SurveyStepRepository steps;
    private final SurveyStepQuestionRepository stepQuestions;
    private final AssessmentQuestionRepository questions;
    private final AssessmentAnswerRepository answers;

    /**
     * @param configured   bài tập hiện có trong bảng Exercise point rules, theo thứ tự hiển thị
     * @param removedSlots slot của các bài vừa bị gỡ khỏi bảng (rỗng khi chỉ đồng bộ lại)
     * @param actor        người lưu thay đổi; null khi hệ thống tự đồng bộ lúc khởi động
     */
    @Transactional
    public void sync(List<BenchmarkExercise> configured, Collection<String> removedSlots, User actor) {
        List<Survey> targets = new ArrayList<>(surveys.findByStatus(Survey.Status.ACTIVE));
        targets.addAll(surveys.findByStatus(Survey.Status.DRAFT));
        for (Survey survey : targets) {
            // cùng khóa với màn Survey management: không xen vào lúc có người đang lưu bước
            Survey locked = surveys.findByIdForUpdate(survey.getId()).orElse(null);
            if (locked == null) {
                continue;
            }
            steps.findBySurveyIdOrderBySortOrderAsc(locked.getId()).stream()
                    .filter(step -> !step.isResult() && LEVEL_TEST_STEP_CODE.equals(step.getStepCode()))
                    .findFirst()
                    .ifPresent(step -> syncStep(locked, step, configured, removedSlots, actor));
        }
    }

    private void syncStep(Survey survey, SurveyStep step, List<BenchmarkExercise> configured,
            Collection<String> removedSlots, User actor) {
        List<SurveyStepQuestion> links = stepQuestions.findAllByStepId(step.getId());
        Map<String, SurveyStepQuestion> byCode = new HashMap<>();
        links.forEach(link -> byCode.put(link.getQuestion().getQuestionCode(), link));
        int nextOrder = links.stream().mapToInt(SurveyStepQuestion::getSortOrder).max().orElse(0);
        boolean changed = false;

        Set<String> wanted = new HashSet<>();
        for (BenchmarkExercise exercise : configured) {
            String slot = exercise.slot();
            wanted.add(slot);
            AssessmentQuestion question = questions.findByQuestionCode(slot).orElse(null);
            if (question == null) {
                question = questions.save(newQuestion(exercise));
                log.info("Created survey question {} for benchmark exercise {}", slot, exercise.name());
            } else if (!NUMBER.equalsIgnoreCase(question.getQuestionType())) {
                log.warn("Question {} exists but is {}, not NUMBER: benchmark exercise {} is not shown in survey {}",
                        slot, question.getQuestionType(), exercise.name(), survey.getSurveyCode());
                continue;
            } else {
                boolean dirty = false;
                if (question.getStatus() != ConfigStatus.ACTIVE) {
                    question.setStatus(ConfigStatus.ACTIVE);
                    dirty = true;
                }
                if (question.getDisplayConfig() == null) {
                    question.setDisplayConfig(displayConfig(exercise));
                    dirty = true;
                }
                if (dirty) {
                    questions.save(question);
                }
            }

            SurveyStepQuestion link = byCode.get(slot);
            if (link == null) {
                link = new SurveyStepQuestion();
                link.setStep(step);
                link.setQuestion(question);
                link.setSortOrder(++nextOrder);
                link.setActive(true);
                stepQuestions.save(link);
                changed = true;
            } else if (!link.isActive()) {
                link.setActive(true);
                stepQuestions.save(link);
                changed = true;
            }
        }

        // Bài vừa bị gỡ + câu "mồ côi" còn sót từ lần bảng đổi mà không qua sync (vd restart server sau khi sửa DB).
        Set<String> stale = new LinkedHashSet<>(removedSlots);
        byCode.forEach((code, link) -> {
            if (!configured.isEmpty() && !wanted.contains(code) && SLOT_CODE.matcher(code).matches()
                    && NUMBER.equalsIgnoreCase(link.getQuestion().getQuestionType())) {
                stale.add(code);
            }
        });

        for (String slot : stale) {
            SurveyStepQuestion link = wanted.contains(slot) ? null : byCode.get(slot);
            if (link == null) {
                continue;
            }
            boolean answered = !answers
                    .findAnsweredQuestionIds(survey.getId(), List.of(link.getQuestion().getId())).isEmpty();
            if (answered) {
                if (link.isActive()) {
                    link.setActive(false);
                    stepQuestions.save(link);
                    changed = true;
                }
            } else {
                stepQuestions.delete(link);
                changed = true;
            }
        }

        if (changed) {
            // nội dung bước đổi: người đang mở form sửa bước sẽ nhận 409 STEP_MODIFIED thay vì ghi đè
            step.setUpdatedAt(LocalDateTime.now());
            step.setUpdatedBy(actor);
            step.setRevision(step.getRevision() + 1);
            steps.save(step);
        }
    }

    private static AssessmentQuestion newQuestion(BenchmarkExercise exercise) {
        boolean hold = isHold(exercise);
        AssessmentQuestion question = new AssessmentQuestion();
        question.setQuestionCode(exercise.slot());
        question.setQuestionText(hold ? "Longest " + exercise.name() + " hold"
                : "Max " + exercise.name() + " reps in one set");
        question.setDescription(hold ? "Hold with good form for as long as you can."
                : "Do as many clean reps as you can without stopping.");
        question.setQuestionType(NUMBER);
        question.setRequired(true);
        question.setValidationRules(hold ? "{\"integerOnly\": true, \"min\": 0, \"max\": 1800}"
                : "{\"integerOnly\": true, \"min\": 0, \"max\": 500}");
        question.setUnit(hold ? "sec" : "reps");
        question.setDisplayConfig(displayConfig(exercise));
        question.setStatus(ConfigStatus.ACTIVE);
        return question;
    }

    /** Thẻ Level test theo Figma: tên bài + dòng gợi ý + icon + ô số. */
    private static String displayConfig(BenchmarkExercise exercise) {
        boolean hold = isHold(exercise);
        ObjectNode config = SurveyJson.nodes().objectNode();
        config.put("label", exercise.name());
        config.put("hint", hold ? "Max hold time" : "Max reps in a row");
        config.put("icon", hold ? "clock" : "arrowUp");
        config.put("placeholder", "0");
        return SurveyJson.write(config);
    }

    private static boolean isHold(BenchmarkExercise exercise) {
        return "HOLD".equalsIgnoreCase(exercise.category());
    }
}
