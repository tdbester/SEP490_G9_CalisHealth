package com.calishealth.controllers;

import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkConfiguration;
import com.calishealth.dtos.LevelBenchmarkDtos.CreateLevelRequest;
import com.calishealth.dtos.LevelBenchmarkDtos.UpdateBenchmarkConfiguration;
import com.calishealth.service.LevelBenchmarkService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/content/level-benchmarks")
@RequiredArgsConstructor
public class LevelBenchmarkController {
    private final LevelBenchmarkService benchmarks;

    @GetMapping
    public BenchmarkConfiguration getConfiguration() {
        return benchmarks.getConfiguration();
    }

    @PostMapping
    public BenchmarkConfiguration createLevel(@RequestBody CreateLevelRequest request, Authentication authentication) {
        return benchmarks.createLevel(request, authentication.getName());
    }

    @PutMapping
    public BenchmarkConfiguration updateConfiguration(
            @RequestBody UpdateBenchmarkConfiguration request,
            Authentication authentication
    ) {
        return benchmarks.updateConfiguration(request, authentication.getName());
    }

    @DeleteMapping("/levels/{id}")
    public BenchmarkConfiguration deleteLevel(@PathVariable Long id, Authentication authentication) {
        return benchmarks.deleteLevel(id, authentication.getName());
    }

    @PatchMapping("/levels/{level}/status")
    public BenchmarkConfiguration updateStatus(
            @PathVariable String level,
            @RequestParam String status,
            Authentication authentication
    ) {
        return benchmarks.updateLevelStatus(level, status, authentication.getName());
    }
}
