package com.calishealth.controllers;

import com.calishealth.dtos.DayStreakDtos.DayReportResponse;
import com.calishealth.dtos.DayStreakDtos.DayStreakResponse;
import com.calishealth.service.DayStreakService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.YearMonth;

@RestController
@RequestMapping("/api/member")
@RequiredArgsConstructor
public class DayStreakController {
    private final DayStreakService dayStreaks;

    @GetMapping("/day-streak")
    public DayStreakResponse getDayStreak(
            Authentication authentication,
            @RequestParam int year,
            @RequestParam int month
    ) {
        return dayStreaks.getDayStreak(authentication.getName(), year, month);
    }

    @GetMapping("/day-report")
    public DayReportResponse getDayReport(
            Authentication authentication,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return dayStreaks.getDayReport(authentication.getName(), date);
    }
}
