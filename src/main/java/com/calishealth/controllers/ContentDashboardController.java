package com.calishealth.controllers;

import com.calishealth.dtos.MemberLevelStat;
import com.calishealth.repository.MemberLevelStatsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/content/dashboard")
@RequiredArgsConstructor
public class ContentDashboardController {
    private final MemberLevelStatsRepository memberLevelStats;

    @GetMapping("/member-levels")
    public List<MemberLevelStat> getMemberCountsByLevel() {
        return memberLevelStats.findMemberCountsByLevel();
    }
}
