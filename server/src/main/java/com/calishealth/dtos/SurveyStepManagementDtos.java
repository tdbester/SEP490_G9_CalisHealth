package com.calishealth.dtos;

import com.calishealth.dtos.SurveyDtos.AnswerItem;
import com.calishealth.dtos.SurveyDtos.OptionResponse;
import com.calishealth.dtos.SurveyDtos.QuestionResponse;
import com.calishealth.dtos.SurveyDtos.ResultConfig;
import com.calishealth.exception.SurveyException.ErrorItem;
import com.calishealth.models.SurveyStep;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.JsonNode;

import java.time.LocalDateTime;
import java.util.List;

/** DTO của màn "Survey management" (Content Manager): /api/content/surveys/{surveyCode}/steps. */
public class SurveyStepManagementDtos {

    // ---------- Requests ----------

    /**
     * stepCode bỏ trống -> sinh từ stepName (vd "Body information" -> BODY_INFORMATION).
     * stepType bỏ trống -> QUESTIONS; RESULT chỉ tạo được khi survey chưa có bước RESULT.
     * questions (tùy chọn, chỉ bước QUESTIONS): câu hỏi tạo/thêm luôn cùng bước, cùng luật như Update step.
     */
    public record CreateStepRequest(
            @NotBlank(message = "stepName is required")
            @Size(max = 255, message = "stepName must be at most 255 characters") String stepName,
            @Size(max = 150, message = "description must be at most 150 characters") String description,
            @Pattern(regexp = "^[A-Z][A-Z0-9_]{1,63}$",
                    message = "stepCode must be 2-64 characters: uppercase letters, digits and '_', starting with a letter")
            String stepCode,
            SurveyStep.Type stepType,
            @Size(max = 50, message = "a step can have at most 50 questions")
            List<@NotNull(message = "questions must not contain null") @Valid StepQuestionInput> questions) {

        public CreateStepRequest(String stepName, String description, String stepCode, SurveyStep.Type stepType) {
            this(stepName, description, stepCode, stepType, null);
        }
    }

    /**
     * Pop-up "Update step" - "Save changes" lưu tất cả trong 1 transaction.
     * revision: giá trị step.revision lúc mở pop-up; người khác đã sửa trước -> 409 STEP_MODIFIED.
     * questions: danh sách câu hỏi CUỐI CÙNG của bước theo đúng thứ tự hiển thị. Câu có trong bước nhưng không có
     * trong danh sách = bị gỡ (đã có member trả lời thì chỉ tắt để giữ dữ liệu). stepCode không đổi được.
     */
    public record UpdateStepRequest(
            @NotNull(message = "revision is required") Integer revision,
            @NotBlank(message = "stepName is required")
            @Size(max = 255, message = "stepName must be at most 255 characters") String stepName,
            @Size(max = 150, message = "description must be at most 150 characters") String description,
            @NotNull(message = "status is required") SurveyStep.Status status,
            @NotNull(message = "questions is required")
            @Size(max = 50, message = "a step can have at most 50 questions")
            List<@NotNull(message = "questions must not contain null") @Valid StepQuestionInput> questions) {}

    /**
     * 1 câu hỏi của bước.
     * questionCode: câu có sẵn trong ngân hàng; null = câu hỏi MỚI (bắt buộc có content, mã tự sinh).
     * required: nút "Required" của câu hỏi trong bước này.
     * content: null = giữ nguyên nội dung câu hỏi; có = tạo mới / sửa nội dung câu hỏi trong ngân hàng.
     */
    public record StepQuestionInput(
            @Size(max = 64, message = "questionCode must be at most 64 characters") String questionCode,
            @NotNull(message = "required is required") Boolean required,
            @Valid QuestionContentInput content) {

        public StepQuestionInput(String questionCode, Boolean required) {
            this(questionCode, required, null);
        }
    }

    /**
     * Nội dung câu hỏi (editor kiểu Google Form). questionType: NUMBER | SINGLE_SELECT | MULTIPLE_SELECT | BOOLEAN
     * | TEXT | TEXTAREA. validationRules theo loại (vd NUMBER: min, max, integerOnly, maxDecimals), kiểm tra bằng
     * đúng handler của loại đó. unit chỉ dùng cho NUMBER. options chỉ dùng cho SINGLE_SELECT / MULTIPLE_SELECT,
     * theo thứ tự hiển thị.
     */
    public record QuestionContentInput(
            @NotBlank(message = "questionText is required")
            @Size(max = 500, message = "questionText must be at most 500 characters") String questionText,
            @Size(max = 1000, message = "question description must be at most 1000 characters") String description,
            @NotBlank(message = "questionType is required")
            @Size(max = 32, message = "questionType must be at most 32 characters") String questionType,
            @Size(max = 32, message = "unit must be at most 32 characters") String unit,
            JsonNode validationRules,
            @Size(max = 50, message = "a question can have at most 50 options")
            List<@NotNull(message = "options must not contain null") @Valid OptionInput> options) {}

    /** optionCode: lựa chọn đã có của câu hỏi; null = lựa chọn mới (mã tự sinh từ label). */
    public record OptionInput(
            @Size(max = 64, message = "optionCode must be at most 64 characters") String optionCode,
            @NotBlank(message = "option label is required")
            @Size(max = 255, message = "option label must be at most 255 characters") String label) {}

    /** Nút "Continue" trong Preview: kiểm tra thử câu trả lời bằng đúng luật của member, không lưu gì. */
    public record PreviewCheckRequest(
            @NotNull(message = "answers is required")
            @Size(max = 100, message = "answers must contain at most 100 items")
            List<@NotNull(message = "answer item must not be null") @Valid AnswerItem> answers) {}

    public record ChangeStepStatusRequest(@NotNull(message = "status is required") SurveyStep.Status status) {}

    /** Toàn bộ id bước của survey theo thứ tự mới (đúng 1 lần mỗi bước, bước RESULT ở cuối). */
    public record ReorderStepsRequest(
            @NotNull(message = "stepIds is required")
            @Size(min = 1, max = 100, message = "stepIds must contain 1 to 100 items")
            List<@NotNull(message = "stepIds must not contain null") Long> stepIds) {}

    public record UpdateResultConfigRequest(
            @NotBlank(message = "stepName is required")
            @Size(max = 255, message = "stepName must be at most 255 characters") String stepName,
            @Size(max = 150, message = "description must be at most 150 characters") String description,
            @NotNull(message = "config is required") @Valid ResultConfig config) {}

    // ---------- Responses ----------

    public record SurveyInfo(String surveyCode, String surveyName, int version, String status) {}

    /** Số bước theo trạng thái cho các tab All / Active / Draft / Inactive (đã áp dụng ô tìm kiếm). */
    public record StatusCounts(long all, long active, long draft, long inactive) {}

    public record StepListResponse(SurveyInfo survey, StatusCounts counts, List<StepSummaryResponse> steps) {}

    /**
     * 1 dòng trong danh sách bước.
     * position: số thứ tự "STEP n" trên toàn survey (không đổi khi lọc/tìm kiếm).
     * questionCount / questionTypes: chỉ tính câu hỏi member thực sự thấy (liên kết và câu hỏi đều ACTIVE).
     * updatedAt: lần cuối nội dung bước hoặc 1 câu hỏi của bước thay đổi.
     * revision: gửi lại khi "Save changes" ở pop-up Update step.
     */
    public record StepSummaryResponse(
            Long id,
            String stepCode,
            String stepName,
            String description,
            String stepType,
            String status,
            int position,
            int questionCount,
            List<String> questionTypes,
            LocalDateTime updatedAt,
            int revision) {}

    /**
     * Dữ liệu cho pop-up "Update step". questions: câu member thấy theo thứ tự, sau đó tới câu đã bị gỡ
     * nhưng được giữ lại vì đã có câu trả lời (active = false).
     */
    public record StepDetailResponse(
            StepSummaryResponse step,
            List<StepQuestionItem> questions,
            ResultConfig resultConfig) {}

    public record StepQuestionItem(
            String questionCode,
            String questionText,
            String questionType,
            /** Đã tính phần ghi đè của bước (nút "Required"). */
            boolean required,
            /** Giá trị mặc định trong ngân hàng câu hỏi. */
            boolean requiredByDefault,
            String unit,
            /** Để hiển thị "100 to 250 cm"... */
            JsonNode validationRules,
            int sortOrder,
            /** false nếu liên kết hoặc câu hỏi đã bị tắt -> member không thấy. */
            boolean active,
            JsonNode conditionalRules,
            /** Nhãn ngắn / widget như màn member (vd label "Height"). */
            JsonNode displayConfig,
            String description,
            /** Lựa chọn ACTIVE theo thứ tự (SINGLE_SELECT / MULTIPLE_SELECT). */
            List<OptionResponse> options,
            /** Đã có member trả lời: lựa chọn bị gỡ chỉ bị ẩn, câu trả lời cũ giữ nguyên. */
            boolean answered,
            /** Không đổi được loại câu hỏi: đã có câu trả lời hoặc rule chấm level đang dùng. */
            boolean typeLocked) {}

    /**
     * Pop-up "Preview step": đúng những gì member sẽ thấy, kể cả với bước DRAFT/INACTIVE. Không lưu gì.
     * memberStepNumber / memberStepCount: "Step 1 of 4" - đánh số trên các bước câu hỏi member thấy
     * (bước đang xem được tính vào dù chưa ACTIVE, tại đúng vị trí của nó). null với bước RESULT.
     * visibleToMembers: false nếu bước chưa ACTIVE (FE có thể hiện nhãn "not visible to members").
     */
    public record StepPreviewResponse(
            StepSummaryResponse step,
            Integer memberStepNumber,
            Integer memberStepCount,
            boolean visibleToMembers,
            List<QuestionResponse> questions,
            ResultConfig resultConfig) {}

    /**
     * Kết quả nút "Continue" trong Preview. valid = true khi member sẽ được qua bước này.
     * Điều kiện hiển thị trỏ tới câu hỏi ở bước khác không đánh giá được trong Preview -> câu đó được coi là hiển thị.
     */
    public record PreviewCheckResponse(boolean valid, List<ErrorItem> errors) {}

    /** 1 câu trong ngân hàng câu hỏi cho nút "Add question". */
    public record AvailableQuestionResponse(
            String questionCode,
            String questionText,
            String questionType,
            boolean required,
            String unit,
            JsonNode validationRules,
            int optionCount,
            /** true nếu câu đang nằm trong chính bước này. */
            boolean inCurrentStep,
            JsonNode displayConfig,
            String description,
            List<OptionResponse> options,
            boolean answered,
            boolean typeLocked) {}

    public record ResultConfigResponse(
            StepSummaryResponse step,
            ResultConfig config,
            /** Danh sách level để chọn fallbackFitnessLevelId. */
            List<FitnessLevelOption> fitnessLevels) {}

    public record FitnessLevelOption(Long id, String name) {}
}
