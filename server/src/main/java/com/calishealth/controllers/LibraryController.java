package com.calishealth.controllers;

import com.calishealth.dtos.LibraryDtos.CreateMemberExerciseRequest;
import com.calishealth.dtos.LibraryDtos.ExerciseCounts;
import com.calishealth.dtos.LibraryDtos.ExerciseListItem;
import com.calishealth.dtos.LibraryDtos.FitnessLevelOption;
import com.calishealth.dtos.LibraryDtos.LibrarySummaryResponse;
import com.calishealth.dtos.LibraryDtos.PagedExerciseListResponse;
import com.calishealth.security.SessionIdentity;
import com.calishealth.service.LibraryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/library")
@RequiredArgsConstructor
public class LibraryController {
    private final LibraryService libraryService;

    /**
     * Danh sách level của hệ thống. Level do Content Manager cấu hình động nên client lấy từ
     * đây thay vì hard-code Beginner / Intermediate / Advanced.
     */
    @GetMapping("/levels")
    public List<FitnessLevelOption> getLevels() {
        return libraryService.getFitnessLevels();
    }

    @GetMapping("/summary")
    public LibrarySummaryResponse getSummary(Authentication authentication) {
        return libraryService.getSummary(SessionIdentity.emailOf(authentication));
    }

    @GetMapping("/counts")
    public ExerciseCounts getCounts(Authentication authentication) {
        return libraryService.getExerciseCounts(SessionIdentity.emailOf(authentication));
    }

    @GetMapping("/exercises")
    public PagedExerciseListResponse getExercises(
            @RequestParam(required = false, defaultValue = "all") String type,
            @RequestParam(required = false, defaultValue = "all") String source,
            @RequestParam(required = false, defaultValue = "all") String level,
            @RequestParam(required = false, defaultValue = "all") String muscleGroup,
            @RequestParam(required = false) String muscles,
            @RequestParam(required = false) String search,
            @RequestParam(required = false, defaultValue = "1") int page,
            @RequestParam(required = false, defaultValue = "6") int size,
            Authentication authentication
    ) {
        return libraryService.getExercises(
                type, source, level, muscleGroup, muscles, search, page, size,
                SessionIdentity.emailOf(authentication));
    }

    @GetMapping("/exercises/{id}")
    public ExerciseListItem getExerciseById(@PathVariable String id) {
        return libraryService.getExerciseById(id);
    }

    @GetMapping("/member-exercises")
    public PagedExerciseListResponse getMemberExercises(
            @RequestParam(required = false, defaultValue = "all") String level,
            @RequestParam(required = false, defaultValue = "all") String muscleGroup,
            @RequestParam(required = false) String muscles,
            @RequestParam(required = false) String search,
            @RequestParam(required = false, defaultValue = "1") int page,
            @RequestParam(required = false, defaultValue = "6") int size,
            Authentication authentication
    ) {
        return libraryService.getMemberExercises(
                level, muscleGroup, muscles, search, page, size,
                SessionIdentity.emailOf(authentication));
    }

    @PostMapping("/member-exercises")
    @ResponseStatus(HttpStatus.CREATED)
    public ExerciseListItem createMemberExercise(
            @RequestBody CreateMemberExerciseRequest request,
            Authentication authentication
    ) {
        return libraryService.createMemberExercise(request, SessionIdentity.emailOf(authentication));
    }
}
