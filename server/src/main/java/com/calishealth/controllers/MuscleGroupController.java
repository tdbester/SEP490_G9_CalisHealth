package com.calishealth.controllers;

import com.calishealth.service.MuscleGroupStatsService;
import com.calishealth.service.MuscleGroupStatsService.MuscleGroupStat;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Danh mục MUSCLE GROUP của Library (bảng {@code muscle_groups}) kèm số bài tập thực tế.
 * Trang Library dùng endpoint này để sidebar lọc nhóm cơ luôn khớp với Dashboard.
 */
@RestController
@RequestMapping("/api/v1/library/muscle-groups")
@RequiredArgsConstructor
public class MuscleGroupController {

    private final MuscleGroupStatsService muscleGroupStatsService;

    @GetMapping
    public List<MuscleGroupStat> getMuscleGroups() {
        return muscleGroupStatsService.findAll();
    }
}
