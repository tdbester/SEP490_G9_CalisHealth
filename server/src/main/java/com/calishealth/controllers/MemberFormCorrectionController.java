package com.calishealth.controllers;

import com.calishealth.dtos.FormCorrectionDtos.FormCorrectionPlanResponse;
import com.calishealth.service.FormCorrectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;

/** Màn "Form correction" — member xem ngưỡng chấm form và các bước sửa. */
@RestController
@RequestMapping("/api/member/form-correction")
@RequiredArgsConstructor
@Tag(name = "Member Form Correction", description = "Kế hoạch sửa form cho bài tập vừa tập (ngưỡng chấm + bước sửa)")
public class MemberFormCorrectionController {

    private final FormCorrectionService formCorrection;

    /**
     * Lấy kế hoạch sửa form của một bài tập.
     *
     * @param exerciseCode mã bài tập
     * @param failedJoints các khớp vừa bị lỗi, phân tách bằng dấu phẩy
     *                   (vd: "KNEE,HIP") — dùng để ưu tiên bước sửa đúng lỗi.
     */
    @Operation(summary = "Kế hoạch sửa form của một bài tập",
            description = "Trả về các ngưỡng chấm form đang áp dụng và tối đa 3 bước sửa form")
    @GetMapping
    public FormCorrectionPlanResponse plan(
            @RequestParam String exerciseCode,
            @RequestParam(required = false) String failedJoints) {
        List<String> joints = List.of();
        if (failedJoints != null && !failedJoints.isBlank()) {
            joints = Arrays.stream(failedJoints.split(","))
                    .map(String::trim)
                    .filter(item -> !item.isEmpty())
                    .toList();
        }
        return formCorrection.plan(exerciseCode, joints);
    }
}
