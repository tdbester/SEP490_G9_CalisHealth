package com.calishealth.controllers;

import com.calishealth.dtos.LibraryDtos.CreateMemberExerciseRequest;
import com.calishealth.dtos.LibraryDtos.ExerciseCounts;
import com.calishealth.dtos.LibraryDtos.ExerciseListItem;
import com.calishealth.dtos.LibraryDtos.LibrarySummaryResponse;
import com.calishealth.dtos.LibraryDtos.PagedExerciseListResponse;
import com.calishealth.service.LibraryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/library")
@RequiredArgsConstructor
public class LibraryController {
    private final LibraryService libraryService;

    @GetMapping("/summary")
    public LibrarySummaryResponse getSummary(Authentication authentication) {
        String email = authentication != null ? (String) authentication.getPrincipal() : null;
        return libraryService.getSummary(email);
    }

    @GetMapping("/counts")
    public ExerciseCounts getCounts(Authentication authentication) {
        String email = authentication != null ? (String) authentication.getPrincipal() : null;
        return libraryService.getExerciseCounts(email);
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
        String email = authentication != null ? (String) authentication.getPrincipal() : null;
        return libraryService.getExercises(type, source, level, muscleGroup, muscles, search, page, size, email);
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
        String email = authentication != null ? (String) authentication.getPrincipal() : null;
        return libraryService.getMemberExercises(level, muscleGroup, muscles, search, page, size, email);
    }

    @PostMapping("/member-exercises")
    @ResponseStatus(HttpStatus.CREATED)
    public ExerciseListItem createMemberExercise(
            @RequestBody CreateMemberExerciseRequest request,
            Authentication authentication
    ) {
        String email = authentication != null ? (String) authentication.getPrincipal() : null;
        return libraryService.createMemberExercise(request, email);
    }
}
