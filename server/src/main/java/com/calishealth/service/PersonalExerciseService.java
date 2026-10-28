package com.calishealth.service;

import com.calishealth.dtos.CreatePersonalExerciseRequestDTO;
import com.calishealth.dtos.PageResponseDTO;
import com.calishealth.dtos.PersonalExerciseResponseDTO;
import com.calishealth.dtos.SubmissionCountsDTO;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.models.Exercise;
import com.calishealth.models.User;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.specification.PersonalExerciseSpecification;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
@Slf4j
public class PersonalExerciseService {
    private final ExerciseRepository exercises;
    private final UserRepository users;
    private final ContentModerationService moderation;
    private final ExerciseVideoStorageService videoStorage;

    @Transactional
    public PersonalExerciseResponseDTO createPersonalExercise(
            String memberEmail,
            CreatePersonalExerciseRequestDTO request,
            MultipartFile videoFile
    ) {
        User member = requireMember(memberEmail);
            videoStorage.validateVideoFile(videoFile, true);
            String textReason = moderation.checkText(request.title(), request.description(), request.guideSteps());
            String videoReason = moderation.checkVideo(videoFile);
            ContentModerationService.ModerationResult result = moderation.combine(textReason, videoReason);
            String videoUrl = videoReason == null ? videoStorage.store(videoFile) : null;
        try {
            Exercise exercise = new Exercise();
            exercise.setCode("PER-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase(Locale.ROOT));
            exercise.setName(request.title().trim());
            exercise.setDescription(request.description() == null ? "" : request.description().trim());
            exercise.setType(Exercise.EntryType.HEALTH);
            exercise.setSystem(false);
            exercise.setAuthor(member);
            exercise.setCreatedBy(member);
            exercise.setSource(ExerciseService.SOURCE_CUSTOM);
            exercise.setStatus(result.isPassed()
                    ? Exercise.EntryStatus.PENDING
                    : Exercise.EntryStatus.REJECTED);
            exercise.setActive(false);
            exercise.setRejectionReason(result.isPassed() ? null : result.rejectionReason());
            exercise.setMuscleGroup(request.targetMuscle().trim());
            exercise.setLevel(request.level());
            applyCountConfiguration(exercise, request);
            exercise.setGuideSteps(String.join("\n", request.guideSteps()));
            exercise.setGuide(exercise.getGuideSteps());
            exercise.setVideoUrl(videoUrl);
            exercise.setDemoVideoUrl(videoUrl);
            exercise.setShareWithCommunity(Boolean.TRUE.equals(request.shareWithCommunity()));
            exercise.setSaveCount(0);
            return toResponse(exercises.save(exercise));
        } catch (RuntimeException exception) {
            videoStorage.delete(videoUrl);
            throw exception;
        }
    }

    @Transactional(readOnly = true)
    public PageResponseDTO<PersonalExerciseResponseDTO> getMemberSubmissions(
            String memberEmail,
            Exercise.EntryStatus status,
            String search,
            Exercise.EntryLevel level,
            int page,
            int size
    ) {
        User member = requireMember(memberEmail);
        validatePage(page, size);
        if (status == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Submission status is required");
        }
        Page<Exercise> result = exercises.findAll(
                PersonalExerciseSpecification.withFilters(member.getId(), status, search, level),
                PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
        return new PageResponseDTO<>(
                result.getContent().stream().map(this::toResponse).toList(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.hasNext(),
                result.hasPrevious());
    }

    @Transactional(readOnly = true)
    public SubmissionCountsDTO getSubmissionCounts(String memberEmail) {
        Long memberId = requireMember(memberEmail).getId();
        return new SubmissionCountsDTO(
                exercises.countByAuthor_IdAndSystemFalseAndStatus(memberId, Exercise.EntryStatus.PENDING.name()),
                exercises.countByAuthor_IdAndSystemFalseAndStatus(memberId, Exercise.EntryStatus.REJECTED.name()),
                exercises.countByAuthor_IdAndSystemFalseAndStatus(memberId, Exercise.EntryStatus.ACCEPTED.name()));
    }

    @Transactional(readOnly = true)
    public PersonalExerciseResponseDTO getPersonalExercise(String memberEmail, Long exerciseId) {
        User member = requireMember(memberEmail);
        Exercise exercise = exercises.findByIdAndAuthor_IdAndSystemFalse(exerciseId, member.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Personal exercise not found"));
        return toResponse(exercise);
    }

    @Transactional
    public PersonalExerciseResponseDTO resubmitPersonalExercise(
            String memberEmail,
            Long exerciseId,
            CreatePersonalExerciseRequestDTO request,
            MultipartFile videoFile
    ) {
        User member = requireMember(memberEmail);
        Exercise exercise = exercises.findByIdAndAuthor_IdAndSystemFalse(exerciseId, member.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Personal exercise not found"));
        if (!"REJECTED".equals(exercise.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only rejected exercises can be resubmitted");
        }

        String textReason = moderation.checkText(request.title(), request.description(), request.guideSteps());
        boolean hasNewVideo = videoFile != null && !videoFile.isEmpty();
        if (hasNewVideo) {
            videoStorage.validateVideoFile(videoFile, true);
        }
        boolean keepCurrentVideo = Boolean.TRUE.equals(request.keepCurrentVideo()) && !hasNewVideo;
        String videoReason = hasNewVideo
                ? moderation.checkVideo(videoFile)
                : keepCurrentVideo && exercise.getVideoUrl() != null
                    ? null
                    : "Video check: we could not detect a full body in most frames. Re-record in better light with your whole body in frame.";
        String rejectionReason = Stream.of(textReason, videoReason)
                .filter(value -> value != null && !value.isBlank())
                .reduce((left, right) -> left + " " + right)
                .orElse(null);
        String replacementVideoUrl = null;
        if (hasNewVideo && videoReason == null) {
            replacementVideoUrl = videoStorage.store(videoFile);
        }

        String previousVideoUrl = exercise.getVideoUrl();
        try {
            exercise.setName(request.title().trim());
            exercise.setDescription(request.description() == null ? "" : request.description().trim());
            exercise.setLevel(request.level());
            exercise.setMuscleGroup(request.targetMuscle().trim());
            applyCountConfiguration(exercise, request);
            exercise.setGuideSteps(String.join("\n", request.guideSteps()));
            exercise.setGuide(exercise.getGuideSteps());
            if (replacementVideoUrl != null) {
                exercise.setVideoUrl(replacementVideoUrl);
                exercise.setDemoVideoUrl(replacementVideoUrl);
            }
            if (request.shareWithCommunity() != null) {
                exercise.setShareWithCommunity(request.shareWithCommunity());
            }
            exercise.setStatus(rejectionReason == null
                    ? Exercise.EntryStatus.PENDING
                    : Exercise.EntryStatus.REJECTED);
            exercise.setActive(false);
            exercise.setRejectionReason(rejectionReason);
            Exercise saved = exercises.save(exercise);
            if (replacementVideoUrl != null && previousVideoUrl != null) {
                deleteVideoAfterCommit(previousVideoUrl);
            }
            return toResponse(saved);
        } catch (RuntimeException exception) {
            videoStorage.delete(replacementVideoUrl);
            throw exception;
        }
    }

    @Transactional
    public PersonalExerciseResponseDTO updateAcceptedPersonalExercise(
            String memberEmail,
            Long exerciseId,
            CreatePersonalExerciseRequestDTO request,
            MultipartFile videoFile
    ) {
        User member = requireMember(memberEmail);
        Exercise exercise = exercises.findByIdAndAuthor_IdAndSystemFalse(exerciseId, member.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Personal exercise not found"));
        if (!"ACCEPTED".equals(exercise.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only accepted exercises can be edited here");
        }

        String textReason = moderation.checkText(request.title(), request.description(), request.guideSteps());
        boolean hasNewVideo = videoFile != null && !videoFile.isEmpty();
        if (hasNewVideo) {
            videoStorage.validateVideoFile(videoFile, true);
        }
        String videoReason = hasNewVideo ? moderation.checkVideo(videoFile) : null;
        String rejectionReason = Stream.of(textReason, videoReason)
                .filter(value -> value != null && !value.isBlank())
                .reduce((left, right) -> left + " " + right)
                .orElse(null);
        String replacementVideoUrl = null;
        if (hasNewVideo && videoReason == null) {
            replacementVideoUrl = videoStorage.store(videoFile);
        }

        String previousVideoUrl = exercise.getVideoUrl();
        try {
            exercise.setName(request.title().trim());
            exercise.setDescription(request.description() == null ? "" : request.description().trim());
            exercise.setLevel(request.level());
            exercise.setMuscleGroup(request.targetMuscle().trim());
            applyCountConfiguration(exercise, request);
            exercise.setGuideSteps(String.join("\n", request.guideSteps()));
            exercise.setGuide(exercise.getGuideSteps());
            if (replacementVideoUrl != null) {
                exercise.setVideoUrl(replacementVideoUrl);
                exercise.setDemoVideoUrl(replacementVideoUrl);
            }
            if (request.shareWithCommunity() != null) {
                exercise.setShareWithCommunity(request.shareWithCommunity());
            }
            exercise.setStatus(rejectionReason == null
                    ? Exercise.EntryStatus.PENDING
                    : Exercise.EntryStatus.REJECTED);
            exercise.setActive(false);
            exercise.setRejectionReason(rejectionReason);
            Exercise saved = exercises.save(exercise);
            if (replacementVideoUrl != null && previousVideoUrl != null) {
                deleteVideoAfterCommit(previousVideoUrl);
            }
            return toResponse(saved);
        } catch (RuntimeException exception) {
            videoStorage.delete(replacementVideoUrl);
            throw exception;
        }
    }

    @Transactional
    public void deletePersonalExercise(String memberEmail, Long exerciseId) {
        User member = requireMember(memberEmail);
        Exercise exercise = exercises.findByIdAndAuthor_IdAndSystemFalse(exerciseId, member.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Personal exercise not found"));
        exercises.delete(exercise);
        if (exercise.getVideoUrl() != null) {
            deleteVideoAfterCommit(exercise.getVideoUrl());
        }
    }

    private void applyCountConfiguration(
            Exercise exercise,
            CreatePersonalExerciseRequestDTO request
    ) {
        String countType = request.countType();
        if (countType == null) {
            countType = request.defaultDuration() != null && request.defaultReps() == null
                    ? "duration"
                    : "reps_sets";
        }
        if ("reps_sets".equals(countType)) {
            Integer sets = request.sets() != null ? request.sets() : request.defaultSets();
            Integer reps = request.reps() != null ? request.reps() : request.defaultReps();
            if (sets == null || reps == null || sets < 1 || sets > 20 || reps < 1 || reps > 1000) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sets and reps must be valid");
            }
            exercise.setDefaultSets(sets);
            exercise.setDefaultReps(reps);
            exercise.setDefaultDuration(null);
            return;
        }

        Integer duration = request.duration() != null ? request.duration() : request.defaultDuration();
        if (duration == null || duration < 1 || duration > 3600) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Duration must be between 1 and 3600 seconds");
        }
        exercise.setDefaultSets(1);
        exercise.setDefaultReps(null);
        exercise.setDefaultDuration(duration);
    }

    private User requireMember(String email) {
        return users.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated member not found"));
    }

    private void validatePage(int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Page must be non-negative and size must be between 1 and 100");
        }
    }

    private PersonalExerciseResponseDTO toResponse(Exercise exercise) {
        List<String> steps = exercise.getGuideSteps() == null || exercise.getGuideSteps().isBlank()
                ? List.of()
                : exercise.getGuideSteps().lines().map(String::trim).filter(step -> !step.isBlank()).toList();
        return new PersonalExerciseResponseDTO(
                exercise.getId(),
                exercise.getName(),
                exercise.getDescription(),
                exercise.getLevel() == null ? null : levelLabel(exercise.getLevel()),
                steps,
                exercise.getVideoUrl(),
                exercise.getStatus(),
                exercise.getRejectionReason(),
                exercise.getMuscleGroup(),
                exercise.getDefaultSets(),
                exercise.getDefaultReps(),
                exercise.getDefaultDuration(),
                exercise.getCreatedAt(),
                exercise.getUpdatedAt());
    }

    private String levelLabel(String level) {
        String value = level.toLowerCase(Locale.ROOT);
        return Character.toUpperCase(value.charAt(0)) + value.substring(1);
    }

    private void deleteVideoAfterCommit(String videoUrl) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                try {
                    videoStorage.delete(videoUrl);
                } catch (RuntimeException exception) {
                    log.error("Could not remove unused personal exercise video {}", videoUrl, exception);
                }
            }
        });
    }
}
