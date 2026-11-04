package com.calishealth.controllers;

import com.calishealth.dtos.MemberExerciseFilterRequestDTO;
import com.calishealth.dtos.MemberExerciseDetailResponseDTO;
import com.calishealth.dtos.MemberExerciseItemResponseDTO;
import com.calishealth.dtos.PageResponseDTO;
import com.calishealth.service.MemberExerciseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/library/member-exercises")
@RequiredArgsConstructor
public class MemberExerciseController {
    private final MemberExerciseService memberExerciseService;

    @GetMapping
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<PageResponseDTO<MemberExerciseItemResponseDTO>> getMemberExercises(
            @Valid @ModelAttribute MemberExerciseFilterRequestDTO filter,
            Authentication authentication
    ) {
        return ResponseEntity.ok(memberExerciseService.getMemberExercises(filter, authentication.getName()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<MemberExerciseDetailResponseDTO> getMemberExerciseDetail(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(memberExerciseService.getMemberExerciseDetail(id, authentication.getName()));
    }
}
