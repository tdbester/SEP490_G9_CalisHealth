package com.calishealth.controllers;

import com.calishealth.dtos.ExerciseDtos.CreateExerciseRequest;
import com.calishealth.dtos.ExerciseDtos.ExerciseResponse;
import com.calishealth.dtos.ExerciseDtos.ExerciseModerationHistoryResponse;
import com.calishealth.dtos.ExerciseDtos.ExerciseStatusRequest;
import com.calishealth.service.ExerciseVideoStorageService;
import com.calishealth.service.ExerciseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/content/exercises")
@RequiredArgsConstructor
public class ExerciseController {
    private final ExerciseService exercises;
    private final ExerciseVideoStorageService videoStorage;

    @GetMapping
    public List<ExerciseResponse> list() {
        return exercises.findAll();
    }

    @GetMapping("/approval-history")
    public List<ExerciseModerationHistoryResponse> approvalHistory() {
        return exercises.findApprovalHistory();
    }

    @GetMapping("/pending-moderation")
    public List<ExerciseResponse> pendingModeration() {
        return exercises.findPendingModeration();
    }

    @GetMapping("/{code}")
    public ExerciseResponse get(@PathVariable String code) {
        return exercises.findByCode(code);
    }

    @PostMapping(consumes = "multipart/form-data")
    @ResponseStatus(HttpStatus.CREATED)
    public ExerciseResponse create(
            @RequestPart("data") CreateExerciseRequest request,
            @RequestPart(value = "demoVideo", required = false) MultipartFile demoVideo,
            @RequestPart(value = "anatomyImage", required = false) MultipartFile anatomyImage,
            Authentication authentication
    ) {
        String videoUrl = null;
        String anatomyImageUrl = null;
        try {
            videoUrl = demoVideo == null || demoVideo.isEmpty() ? null : videoStorage.store(demoVideo);
            anatomyImageUrl = anatomyImage == null || anatomyImage.isEmpty() ? null : videoStorage.storeAnatomyImage(anatomyImage);
            return exercises.create(request, videoUrl, anatomyImageUrl, authentication.getName());
        } catch (RuntimeException exception) {
            videoStorage.delete(videoUrl);
            videoStorage.deleteAnatomyImage(anatomyImageUrl);
            throw exception;
        }
    }

    @PutMapping(value = "/{code}", consumes = "multipart/form-data")
    public ExerciseResponse update(
            @PathVariable String code,
            @RequestPart("data") CreateExerciseRequest request,
            @RequestPart(value = "demoVideo", required = false) MultipartFile demoVideo,
            @RequestPart(value = "anatomyImage", required = false) MultipartFile anatomyImage
    ) {
        String videoUrl = null;
        String anatomyImageUrl = null;
        try {
            videoUrl = demoVideo == null || demoVideo.isEmpty() ? null : videoStorage.store(demoVideo);
            anatomyImageUrl = anatomyImage == null || anatomyImage.isEmpty() ? null : videoStorage.storeAnatomyImage(anatomyImage);
            return exercises.updateSystemExercise(code, request, videoUrl, anatomyImageUrl);
        } catch (RuntimeException exception) {
            videoStorage.delete(videoUrl);
            videoStorage.deleteAnatomyImage(anatomyImageUrl);
            throw exception;
        }
    }

    @DeleteMapping("/{code}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String code) {
        exercises.deleteByCode(code);
    }

    @PatchMapping("/{code}/status")
    public ExerciseResponse updateStatus(
            @PathVariable String code,
            @RequestBody ExerciseStatusRequest request
    ) {
        return exercises.updateStatus(code, request.active());
    }
}
