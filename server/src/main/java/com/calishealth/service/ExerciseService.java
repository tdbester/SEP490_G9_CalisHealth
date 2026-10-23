package com.calishealth.service;

import com.calishealth.dtos.ExerciseDtos.CreateExerciseRequest;
import com.calishealth.dtos.ExerciseDtos.ExerciseResponse;
import com.calishealth.dtos.ExerciseFilterRequestDTO;
import com.calishealth.dtos.ExerciseItemResponseDTO;
import com.calishealth.dtos.PageResponseDTO;
import com.calishealth.dtos.SystemExerciseDetailResponseDTO;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.models.Exercise;
import com.calishealth.models.ExerciseEntry;
import com.calishealth.models.ExerciseTreeEdge;
import com.calishealth.models.ExerciseMuscleGroup;
import com.calishealth.models.MuscleGroup;
import com.calishealth.repository.ErdExerciseRepository;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.ExerciseTreeEdgeRepository;
import com.calishealth.repository.MuscleGroupRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.specification.ExerciseSpecification;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.List;
import java.util.Locale;
import java.util.ArrayList;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExerciseService {
    private final ExerciseRepository exercises;
    private final ErdExerciseRepository systemExercises;
    private final MuscleGroupRepository muscleGroups;
    private final UserRepository users;
    private final ExerciseTreeEdgeRepository exerciseTreeEdges;

    @Transactional(readOnly = true)
    public PageResponseDTO<ExerciseItemResponseDTO> getSystemExercises(ExerciseFilterRequestDTO filterRequest) {
        if (filterRequest == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Exercise filters are required");
        }
        if (filterRequest.getType() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Exercise type must be HEALTH or SKILL");
        }
        if (filterRequest.getPage() < 0 || filterRequest.getSize() < 1 || filterRequest.getSize() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Page must be non-negative and size must be between 1 and 100");
        }

        Pageable pageable = PageRequest.of(
                filterRequest.getPage(),
                filterRequest.getSize(),
                Sort.by(Sort.Direction.DESC, "id"));
        Page<ExerciseEntry> exercisesPage = exercises.findAll(
                ExerciseSpecification.withFilters(filterRequest),
                pageable);

        return new PageResponseDTO<>(
                exercisesPage.getContent().stream().map(this::toListItem).toList(),
                exercisesPage.getNumber(),
                exercisesPage.getSize(),
                exercisesPage.getTotalElements(),
                exercisesPage.getTotalPages(),
                exercisesPage.hasNext(),
                exercisesPage.hasPrevious());
    }

    private ExerciseItemResponseDTO toListItem(ExerciseEntry exercise) {
        return new ExerciseItemResponseDTO(
                exercise.getId(),
                exercise.getName(),
                ExerciseFilterRequestDTO.ExerciseType.valueOf(exercise.getType().name()),
                exercise.getLevel() == null
                        ? null
                        : ExerciseFilterRequestDTO.ExerciseLevel.valueOf(exercise.getLevel().name()),
                exercise.getMuscleGroup(),
                exercise.getDefaultSets(),
                exercise.getDefaultReps(),
                exercise.getDefaultDuration(),
                exercise.getEquipment(),
                exercise.getGoal() == null
                        ? null
                        : ExerciseFilterRequestDTO.ExerciseGoal.valueOf(exercise.getGoal().name()),
                exercise.getTargetSkill() == null
                        ? null
                        : ExerciseFilterRequestDTO.TargetSkill.valueOf(exercise.getTargetSkill().name()),
                exercise.getIcon());
    }

    @Transactional(readOnly = true)
    public SystemExerciseDetailResponseDTO getSystemExerciseDetail(Long exerciseId) {
        ExerciseEntry exercise = exercises.findByIdAndIsSystemTrueAndStatus(
                        exerciseId,
                        ExerciseEntry.EntryStatus.ACCEPTED)
                .orElseThrow(() -> new ResourceNotFoundException("System exercise not found"));

        List<String> guideSteps = exercise.getGuide() == null || exercise.getGuide().isBlank()
                ? List.of()
                : exercise.getGuide().lines()
                        .map(String::trim)
                        .filter(step -> !step.isBlank())
                        .map(step -> step.replaceFirst("^\\d+[.)]\\s*", ""))
                        .toList();
        if (guideSteps.size() < 4) {
            guideSteps = List.of(
                    "Prepare a clear, stable space and set up for " + exercise.getName() + ".",
                    "Position your body with control and engage the " + exercise.getMuscleGroup() + " muscles.",
                    exercise.getGuide() == null || exercise.getGuide().isBlank()
                            ? "Perform " + exercise.getName() + " through a comfortable range of motion."
                            : exercise.getGuide().trim(),
                    "Return slowly to the starting position, keep breathing, and repeat with steady form.");
        } else if (guideSteps.size() > 5) {
            guideSteps = guideSteps.subList(0, 5);
        }

        List<String> previousExercises = new ArrayList<>();
        List<String> nextExercises = new ArrayList<>();
        List<ExerciseTreeEdge> connectedEdges = exerciseTreeEdges.findAllConnectedTo(List.of(exerciseId));
        List<Long> adjacentIds = connectedEdges.stream()
                .map(edge -> edge.getParentExerciseId().equals(exerciseId)
                        ? edge.getChildExerciseId()
                        : edge.getParentExerciseId())
                .distinct()
                .toList();
        Map<Long, String> adjacentNames = exercises.findAllById(adjacentIds).stream()
                .collect(Collectors.toMap(ExerciseEntry::getId, ExerciseEntry::getName));
        connectedEdges.stream()
                .filter(edge -> edge.getChildExerciseId().equals(exerciseId))
                .map(ExerciseTreeEdge::getParentExerciseId)
                .map(adjacentNames::get)
                .filter(Objects::nonNull)
                .forEach(previousExercises::add);
        connectedEdges.stream()
                .filter(edge -> edge.getParentExerciseId().equals(exerciseId))
                .map(ExerciseTreeEdge::getChildExerciseId)
                .map(adjacentNames::get)
                .filter(Objects::nonNull)
                .forEach(nextExercises::add);

        return new SystemExerciseDetailResponseDTO(
                exercise.getId(),
                exercise.getName(),
                exercise.getDescription(),
                exercise.getDemoVideoUrl(),
                guideSteps,
                exercise.getMuscleGroup(),
                exercise.getLevel() == null ? null : levelLabel(exercise.getLevel()),
                exercise.getDefaultSets(),
                exercise.getDefaultReps(),
                exercise.getDefaultDuration(),
                exercise.getEquipment(),
                exercise.getType() == null ? null : exercise.getType().name(),
                exercise.getGoal() == null ? null : exercise.getGoal().name(),
                exercise.getTargetSkill() == null ? null : exercise.getTargetSkill().name(),
                exercise.getExerciseTreeId(),
                exercise.getExerciseTreeId() != null && exercise.getMovementGroup() != null,
                exercise.getMovementGroup() == null ? null : exercise.getMovementGroup().name(),
                previousExercises,
                nextExercises);
    }

    @Transactional(readOnly = true)
    public List<ExerciseResponse> findAll() {
        return exercises.findAll().stream()
                .sorted((first, second) -> second.getUpdatedAt().compareTo(first.getUpdatedAt()))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ExerciseResponse findByCode(String code) {
        return exercises.findByCode(code)
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Exercise or skill not found"));
    }

    @Transactional
    public ExerciseResponse create(
            CreateExerciseRequest request,
            String demoVideoUrl,
            String anatomyImageUrl,
            String createdByEmail
    ) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Exercise data is required");
        }
        if (request.name() == null || request.name().isBlank() || request.name().length() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Exercise title is required and must be at most 120 characters");
        }
        if (request.muscleGroup() == null || request.muscleGroup().isBlank() || request.muscleGroup().length() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select one or more muscle groups");
        }
        if (request.level() == null || !List.of("Beginner", "Intermediate", "Advanced").contains(request.level())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid exercise level");
        }
        if (request.category() != null && request.category().length() > 80) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Exercise category must be at most 80 characters");
        }

        ExerciseEntry.EntryType type;
        if (request.type() == null || request.type().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Type must be Health or Skill");
        }
        try {
            type = ExerciseEntry.EntryType.valueOf(request.type().trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Type must be Health or Skill");
        }

        Exercise systemExercise = new Exercise();
        systemExercise.setName(request.name().trim());
        systemExercise.setType(type.name());
        systemExercise.setCategory(request.category());
        systemExercise.setDifficultyLevel(request.level().trim());
        systemExercise.setInstructions(request.description());
        systemExercise.setExecutionSteps(request.guide());
        systemExercise.setVideoUrl(demoVideoUrl);
        systemExercise.setSource("SYSTEM");
        systemExercise.setStatus("ACCEPTED");
        systemExercise.setCreatedBy(users.findByEmail(createdByEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "The signed-in user no longer exists")));
        systemExercise = systemExercises.save(systemExercise);

        for (String muscleName : request.muscleGroup().split("\\s*·\\s*")) {
            MuscleGroup muscleGroup = muscleGroups.findByNameIgnoreCase(muscleName)
                    .orElseGet(() -> {
                        MuscleGroup createdGroup = new MuscleGroup();
                        createdGroup.setName(muscleName.trim());
                        return muscleGroups.save(createdGroup);
                    });
            ExerciseMuscleGroup link = new ExerciseMuscleGroup();
            link.setExercise(systemExercise);
            link.setMuscleGroup(muscleGroup);
            systemExercise.getMuscleGroups().add(link);
        }
        systemExercises.save(systemExercise);

        // Keep the current content-management API projection compatible while the ERD exercise row is canonical.
        ExerciseEntry entry = new ExerciseEntry();
        entry.setName(request.name().trim());
        entry.setType(type);
        entry.setDescription(request.description());
        entry.setCategory(request.category());
        entry.setMuscleGroup(request.muscleGroup().trim());
        entry.setLevel(ExerciseEntry.EntryLevel.valueOf(request.level().trim().toUpperCase(Locale.ROOT)));
        entry.setGuide(request.guide());
        entry.setDemoVideoUrl(demoVideoUrl);
        entry.setAnatomyImageUrl(anatomyImageUrl);
        entry.setStatus(ExerciseEntry.EntryStatus.ACCEPTED);
        entry.setActive(true);
        entry.setCode((type == ExerciseEntry.EntryType.HEALTH ? "HE" : "SK")
                + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT));
        return toResponse(exercises.save(entry));
    }

    @Transactional
    public ExerciseResponse updateStatus(String code, boolean active) {
        ExerciseEntry entry = exercises.findByCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Exercise or skill not found"));
        entry.setActive(active);
        return toResponse(exercises.save(entry));
    }

    private ExerciseResponse toResponse(ExerciseEntry entry) {
        String type = entry.getType() == ExerciseEntry.EntryType.SKILL ? "Skill" : "Health";
        return new ExerciseResponse(entry.getCode(), entry.getName(), type, entry.getDescription(),
                entry.getCategory(), entry.getMuscleGroup(), levelLabel(entry.getLevel()), entry.getGuide(),
                entry.getDemoVideoUrl(), entry.getAnatomyImageUrl(), entry.isActive(), entry.getUpdatedAt());
    }

    private String levelLabel(ExerciseEntry.EntryLevel level) {
        if (level == null) {
            return null;
        }
        String normalized = level.name().toLowerCase(Locale.ROOT);
        return Character.toUpperCase(normalized.charAt(0)) + normalized.substring(1);
    }
}
