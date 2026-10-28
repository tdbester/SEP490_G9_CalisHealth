package com.calishealth.controllers;

import com.calishealth.dtos.CreatePersonalExerciseRequestDTO;
import com.calishealth.dtos.PageResponseDTO;
import com.calishealth.dtos.PersonalExerciseResponseDTO;
import com.calishealth.dtos.SubmissionCountsDTO;
import com.calishealth.models.ExerciseEntry;
import com.calishealth.service.PersonalExerciseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/library/personal-exercises")
@RequiredArgsConstructor
@PreAuthorize("hasRole('MEMBER')")
public class PersonalExerciseController {
    private final PersonalExerciseService personalExercises;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PersonalExerciseResponseDTO> create(
            @Valid @RequestPart("data") CreatePersonalExerciseRequestDTO request,
            @RequestPart("videoFile") MultipartFile videoFile,
            Authentication authentication
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(personalExercises.createPersonalExercise(authentication.getName(), request, videoFile));
    }

    @GetMapping
    public ResponseEntity<PageResponseDTO<PersonalExerciseResponseDTO>> list(
            @RequestParam(defaultValue = "PENDING") ExerciseEntry.EntryStatus status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) ExerciseEntry.EntryLevel level,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "6") int size,
            Authentication authentication
    ) {
        return ResponseEntity.ok(personalExercises.getMemberSubmissions(
                authentication.getName(), status, search, level, page, size));
    }

    @GetMapping("/counts")
    public ResponseEntity<SubmissionCountsDTO> counts(Authentication authentication) {
        return ResponseEntity.ok(personalExercises.getSubmissionCounts(authentication.getName()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PersonalExerciseResponseDTO> detail(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(personalExercises.getPersonalExercise(authentication.getName(), id));
    }

    @PutMapping(path = {"/{id}", "/{id}/resubmit"}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PersonalExerciseResponseDTO> resubmit(
            @PathVariable Long id,
            @Valid @RequestPart("data") CreatePersonalExerciseRequestDTO request,
            @RequestPart(value = "videoFile", required = false) MultipartFile videoFile,
            Authentication authentication
    ) {
        return ResponseEntity.ok(personalExercises.resubmitPersonalExercise(
                authentication.getName(), id, request, videoFile));
    }

    @PutMapping(path = "/{id}/edit", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PersonalExerciseResponseDTO> editAccepted(
            @PathVariable Long id,
            @Valid @RequestPart("data") CreatePersonalExerciseRequestDTO request,
            @RequestPart(value = "videoFile", required = false) MultipartFile videoFile,
            Authentication authentication
    ) {
        return ResponseEntity.ok(personalExercises.updateAcceptedPersonalExercise(
                authentication.getName(), id, request, videoFile));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
        personalExercises.deletePersonalExercise(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }
}
