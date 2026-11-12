package com.calishealth.controllers;

import com.calishealth.dtos.PhysiologyEvidenceDTO;
import com.calishealth.service.ExercisePhysiologyService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Thư viện nguồn trích dẫn sinh lý cho Content Manager.
 *
 * <p>Nằm dưới {@code /api/content/**} nên SecurityConfig giới hạn ROLE_CONTENT_MANAGER.
 * Member không được gọi endpoint này — bài họ học thuật chỉ dùng để CM tra cứu khi
 * tạo hồ sơ sinh lý cho bài tập hệ thống.
 */
@RestController
@RequestMapping("/api/content/physiology")
@RequiredArgsConstructor
public class PhysiologyEvidenceController {

    private final ExercisePhysiologyService physiologyService;

    @GetMapping("/evidence")
    public List<PhysiologyEvidenceDTO> evidence(@RequestParam(required = false) String keyword) {
        return physiologyService.listEvidence(keyword);
    }
}
