package com.calishealth.controllers;

import com.calishealth.dtos.SurveyStepManagementDtos.AvailableQuestionResponse;
import com.calishealth.dtos.SurveyStepManagementDtos.ChangeStepStatusRequest;
import com.calishealth.dtos.SurveyStepManagementDtos.CreateStepRequest;
import com.calishealth.dtos.SurveyStepManagementDtos.PreviewCheckRequest;
import com.calishealth.dtos.SurveyStepManagementDtos.PreviewCheckResponse;
import com.calishealth.dtos.SurveyStepManagementDtos.ReorderStepsRequest;
import com.calishealth.dtos.SurveyStepManagementDtos.ResultConfigResponse;
import com.calishealth.dtos.SurveyStepManagementDtos.StepDetailResponse;
import com.calishealth.dtos.SurveyStepManagementDtos.StepListResponse;
import com.calishealth.dtos.SurveyStepManagementDtos.StepPreviewResponse;
import com.calishealth.dtos.SurveyStepManagementDtos.UpdateResultConfigRequest;
import com.calishealth.dtos.SurveyStepManagementDtos.UpdateStepRequest;
import com.calishealth.models.SurveyStep;
import com.calishealth.service.SurveyStepManagementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Màn "Survey management" (Content Manager). /api/content/** đã giới hạn ROLE_CONTENT_MANAGER ở SecurityConfig.
 * version (tùy chọn) chọn survey version; bỏ trống = version ACTIVE, không có thì version DRAFT mới nhất.
 */
@RestController
@RequestMapping("/api/content/surveys/{surveyCode}/steps")
@RequiredArgsConstructor
public class ContentSurveyStepController {
    private final SurveyStepManagementService steps;

    @GetMapping
    public StepListResponse list(
            @PathVariable String surveyCode,
            @RequestParam(required = false) Integer version,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) SurveyStep.Status status) {
        return steps.list(surveyCode, version, search, status);
    }

    @PostMapping
    public ResponseEntity<StepDetailResponse> create(
            Authentication a,
            @PathVariable String surveyCode,
            @RequestParam(required = false) Integer version,
            @Valid @RequestBody CreateStepRequest r) {
        return ResponseEntity.status(HttpStatus.CREATED).body(steps.create(a.getName(), surveyCode, version, r));
    }

    /** "Save order" sau khi kéo thả. */
    @PutMapping("/order")
    public StepListResponse reorder(
            @PathVariable String surveyCode,
            @RequestParam(required = false) Integer version,
            @Valid @RequestBody ReorderStepsRequest r) {
        return steps.reorder(surveyCode, version, r);
    }

    @GetMapping("/{stepId}")
    public StepDetailResponse get(
            @PathVariable String surveyCode,
            @PathVariable Long stepId,
            @RequestParam(required = false) Integer version) {
        return steps.get(surveyCode, version, stepId);
    }

    /** Pop-up "Update step" - "Save changes" (chỉ bước QUESTIONS): tên, mô tả, trạng thái, câu hỏi. */
    @PutMapping("/{stepId}")
    public StepDetailResponse update(
            Authentication a,
            @PathVariable String surveyCode,
            @PathVariable Long stepId,
            @RequestParam(required = false) Integer version,
            @Valid @RequestBody UpdateStepRequest r) {
        return steps.update(a.getName(), surveyCode, version, stepId, r);
    }

    /** Menu "⋮": Activate / Deactivate. */
    @PutMapping("/{stepId}/status")
    public StepDetailResponse changeStatus(
            Authentication a,
            @PathVariable String surveyCode,
            @PathVariable Long stepId,
            @RequestParam(required = false) Integer version,
            @Valid @RequestBody ChangeStepStatusRequest r) {
        return steps.changeStatus(a.getName(), surveyCode, version, stepId, r);
    }

    /** Menu "⋮": Delete. */
    @DeleteMapping("/{stepId}")
    public ResponseEntity<Void> delete(
            @PathVariable String surveyCode,
            @PathVariable Long stepId,
            @RequestParam(required = false) Integer version) {
        steps.delete(surveyCode, version, stepId);
        return ResponseEntity.noContent().build();
    }

    /** Pop-up "Preview step". */
    @GetMapping("/{stepId}/preview")
    public StepPreviewResponse preview(
            @PathVariable String surveyCode,
            @PathVariable Long stepId,
            @RequestParam(required = false) Integer version) {
        return steps.preview(surveyCode, version, stepId);
    }

    /** Nút "Continue" trong pop-up Preview: kiểm tra thử câu trả lời, không lưu gì. Luôn 200, xem field valid. */
    @PostMapping("/{stepId}/preview/check")
    public PreviewCheckResponse previewCheck(
            @PathVariable String surveyCode,
            @PathVariable Long stepId,
            @RequestParam(required = false) Integer version,
            @Valid @RequestBody PreviewCheckRequest r) {
        return steps.previewCheck(surveyCode, version, stepId, r);
    }

    /** Nút "Add existing" trong pop-up Create step (bước chưa tồn tại): câu hỏi chưa dùng ở bước nào của survey. */
    @GetMapping("/available-questions")
    public List<AvailableQuestionResponse> availableQuestionsForNewStep(
            @PathVariable String surveyCode,
            @RequestParam(required = false) Integer version,
            @RequestParam(required = false) String search) {
        return steps.availableQuestions(surveyCode, version, null, search);
    }

    /** Nút "Add existing" trong pop-up Update step: câu hỏi có thể thêm vào bước này. */
    @GetMapping("/{stepId}/available-questions")
    public List<AvailableQuestionResponse> availableQuestions(
            @PathVariable String surveyCode,
            @PathVariable Long stepId,
            @RequestParam(required = false) Integer version,
            @RequestParam(required = false) String search) {
        return steps.availableQuestions(surveyCode, version, stepId, search);
    }

    /** Nút "Configure" của bước "Result and recommended plan". */
    @GetMapping("/{stepId}/result-config")
    public ResultConfigResponse getResultConfig(
            @PathVariable String surveyCode,
            @PathVariable Long stepId,
            @RequestParam(required = false) Integer version) {
        return steps.getResultConfig(surveyCode, version, stepId);
    }

    @PutMapping("/{stepId}/result-config")
    public ResultConfigResponse updateResultConfig(
            Authentication a,
            @PathVariable String surveyCode,
            @PathVariable Long stepId,
            @RequestParam(required = false) Integer version,
            @Valid @RequestBody UpdateResultConfigRequest r) {
        return steps.updateResultConfig(a.getName(), surveyCode, version, stepId, r);
    }
}
