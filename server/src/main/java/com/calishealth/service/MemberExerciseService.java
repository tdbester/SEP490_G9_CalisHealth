package com.calishealth.service;

import com.calishealth.dtos.MemberExerciseFilterRequestDTO;
import com.calishealth.dtos.MemberExerciseDetailResponseDTO;
import com.calishealth.dtos.MemberExerciseItemResponseDTO;
import com.calishealth.dtos.PageResponseDTO;
import com.calishealth.models.ExerciseEntry;
import com.calishealth.models.MemberSavedExercise;
import com.calishealth.models.User;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.MemberSavedExerciseRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.specification.MemberExerciseSpecification;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import com.calishealth.exception.ResourceNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class MemberExerciseService {
    private final ExerciseRepository exercises;
    private final MemberSavedExerciseRepository savedExercises;
    private final UserRepository users;

    @Transactional(readOnly = true)
    public MemberExerciseDetailResponseDTO getMemberExerciseDetail(Long exerciseId, String memberEmail) {
        User member = users.findByEmail(memberEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated member not found"));
        ExerciseEntry exercise = exercises.findById(exerciseId)
                .filter(item -> !item.isSystem())
                .filter(item -> item.getStatus() == ExerciseEntry.EntryStatus.ACCEPTED)
                .filter(item -> item.isShareWithCommunity()
                        || (item.getAuthor() != null && member.getId().equals(item.getAuthor().getId())))
                .orElseThrow(() -> new ResourceNotFoundException("Community exercise not found"));

        boolean isSaved = savedExercises.findAllByMemberIdAndExerciseIdIn(member.getId(), List.of(exerciseId))
                .stream()
                .findAny()
                .isPresent();
        String guide = exercise.getGuideSteps();
        if (guide == null || guide.isBlank()) {
            guide = exercise.getGuide();
        }
        List<String> steps = guide == null || guide.isBlank()
                ? List.of()
                : guide.lines().map(String::trim).filter(line -> !line.isBlank()).toList();

        return new MemberExerciseDetailResponseDTO(
                exercise.getId(),
                exercise.getName(),
                exercise.getDescription(),
                levelLabel(exercise.getLevel()),
                exercise.getMuscleGroup(),
                exercise.getDefaultSets(),
                exercise.getDefaultReps(),
                exercise.getDefaultDuration(),
                exercise.getEquipment(),
                exercise.getVideoUrl(),
                steps,
                exercise.getAuthor() == null ? null : exercise.getAuthor().getFullName(),
                timeAgo(exercise.getCreatedAt()),
                exercise.getSaveCount() == null ? 0 : exercise.getSaveCount(),
                isSaved,
                exercise.getStatus().name());
    }

    @Transactional(readOnly = true)
    public PageResponseDTO<MemberExerciseItemResponseDTO> getMemberExercises(
            MemberExerciseFilterRequestDTO filter,
            String memberEmail
    ) {
        if (filter == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Member exercise filters are required");
        }
        if (!"COMMUNITY".equals(filter.getTab()) && !"MY_SUBMISSIONS".equals(filter.getTab())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tab must be COMMUNITY or MY_SUBMISSIONS");
        }
        if (!"NEWEST".equals(filter.getSortBy())
                && !"MOST_SAVED".equals(filter.getSortBy())
                && !"OLDEST".equals(filter.getSortBy())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sortBy must be NEWEST, OLDEST or MOST_SAVED");
        }
        if (filter.getPage() < 0 || filter.getSize() < 1 || filter.getSize() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Page must be non-negative and size must be between 1 and 100");
        }

        User member = users.findByEmail(memberEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated member not found"));
        Sort sort = switch (filter.getSortBy()) {
            case "MOST_SAVED" -> Sort.by(Sort.Order.desc("saveCount"), Sort.Order.desc("createdAt"));
            case "OLDEST" -> Sort.by(Sort.Order.asc("createdAt"));
            default -> Sort.by(Sort.Order.desc("createdAt"));
        };
        Page<ExerciseEntry> result = exercises.findAll(
                MemberExerciseSpecification.withFilters(filter, member.getId()),
                PageRequest.of(filter.getPage(), filter.getSize(), sort));

        List<Long> ids = result.getContent().stream().map(ExerciseEntry::getId).toList();
        Set<Long> savedIds = new HashSet<>();
        if (!ids.isEmpty()) {
            savedExercises.findAllByMemberIdAndExerciseIdIn(member.getId(), ids)
                    .stream()
                    .map(MemberSavedExercise::getExerciseId)
                    .forEach(savedIds::add);
        }

        List<MemberExerciseItemResponseDTO> content = result.getContent().stream()
                .map(exercise -> new MemberExerciseItemResponseDTO(
                        exercise.getId(),
                        exercise.getName(),
                        levelLabel(exercise.getLevel()),
                        exercise.getMuscleGroup(),
                        exercise.getDefaultSets(),
                        exercise.getDefaultReps(),
                        exercise.getDefaultDuration(),
                        exercise.getAuthor() == null ? null : exercise.getAuthor().getFullName(),
                        null,
                        timeAgo(exercise.getCreatedAt()),
                        exercise.getSaveCount() == null ? 0 : exercise.getSaveCount(),
                        savedIds.contains(exercise.getId()),
                        exercise.getStatus().name()))
                .toList();

        return new PageResponseDTO<>(
                content,
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.hasNext(),
                result.hasPrevious());
    }

    private String levelLabel(ExerciseEntry.EntryLevel level) {
        if (level == null) return null;
        String normalized = level.name().toLowerCase(Locale.ROOT);
        return Character.toUpperCase(normalized.charAt(0)) + normalized.substring(1);
    }

    private String timeAgo(LocalDateTime createdAt) {
        if (createdAt == null) return "Unknown";
        Duration elapsed = Duration.between(createdAt, LocalDateTime.now());
        if (elapsed.isNegative() || elapsed.toMinutes() < 1) return "Just now";
        if (elapsed.toHours() < 1) {
            long minutes = elapsed.toMinutes();
            return minutes + (minutes == 1 ? " minute ago" : " minutes ago");
        }
        if (elapsed.toDays() < 1) {
            long hours = elapsed.toHours();
            return hours + (hours == 1 ? " hour ago" : " hours ago");
        }
        long days = elapsed.toDays();
        if (days < 7) return days + (days == 1 ? " day ago" : " days ago");
        long weeks = days / 7;
        if (days < 30) return weeks + (weeks == 1 ? " week ago" : " weeks ago");
        long months = days / 30;
        if (days < 365) return months + (months == 1 ? " month ago" : " months ago");
        long years = days / 365;
        return years + (years == 1 ? " year ago" : " years ago");
    }
}
