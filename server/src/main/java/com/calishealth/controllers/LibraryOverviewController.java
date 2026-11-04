package com.calishealth.controllers;

import com.calishealth.dtos.LibraryOverviewDTO;
import com.calishealth.service.LibraryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/library")
@RequiredArgsConstructor
public class LibraryOverviewController {
    private final LibraryService libraryService;

    @GetMapping("/overview")
    public ResponseEntity<LibraryOverviewDTO> getOverview(Authentication authentication) {
        return ResponseEntity.ok(libraryService.getOverview(authentication.getName()));
    }
}
