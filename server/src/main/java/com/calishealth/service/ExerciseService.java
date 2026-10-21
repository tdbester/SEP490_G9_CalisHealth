package com.calishealth.service;

import com.calishealth.dtos.ExerciseDtos.CreateExerciseRequest;
import com.calishealth.dtos.ExerciseDtos.ExerciseResponse;
import com.calishealth.models.Exercise;
import com.calishealth.models.ExerciseEntry;
import com.calishealth.models.ExerciseMuscleGroup;
import com.calishealth.models.MuscleGroup;
import com.calishealth.repository.ErdExerciseRepository;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.MuscleGroupRepository;
import com.calishealth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ExerciseService {
    // Index + 1 is the ERD exercises.difficulty_level (1 = Beginner ... 3 = Advanced).
    private static final List<String> EXERCISE_LEVELS = List.of("Beginner", "Intermediate", "Advanced");

    private final ExerciseRepository exercises;
    private final ErdExerciseRepository systemExercises;
    private final MuscleGroupRepository muscleGroups;
    private final UserRepository users;

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
        if (request.name() == null || request.name().isBlank() || request.name().length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Exercise title is required and must be at most 100 characters");
        }
        if (request.muscleGroup() == null || request.muscleGroup().isBlank() || request.muscleGroup().length() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select one or more muscle groups");
        }
        for (String muscleName : request.muscleGroup().split("\\s*·\\s*")) {
            if (muscleName.isBlank() || muscleName.trim().length() > 50) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Each muscle group name must be 1-50 characters");
            }
        }
        if (request.level() == null || !EXERCISE_LEVELS.contains(request.level())) {
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
        systemExercise.setType(type == ExerciseEntry.EntryType.SKILL ? Exercise.ExerciseType.SKILL : Exercise.ExerciseType.EXERCISE);
        systemExercise.setCategory(toErdCategory(request.category()));
        systemExercise.setDifficultyLevel(EXERCISE_LEVELS.indexOf(request.level().trim()) + 1);
        systemExercise.setInstructions(request.description());
        systemExercise.setExecutionSteps(request.guide());
        systemExercise.setVideoUrl(demoVideoUrl);
        systemExercise.setSource(Exercise.Source.SYSTEM);
        systemExercise.setStatus(Exercise.Status.ACTIVE);
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
        entry.setLevel(request.level().trim());
        entry.setGuide(request.guide());
        entry.setDemoVideoUrl(demoVideoUrl);
        entry.setAnatomyImageUrl(anatomyImageUrl);
        entry.setActive(true);
        entry.setCode((type == ExerciseEntry.EntryType.HEALTH ? "HE" : "SK")
                + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT));
        return toResponse(exercises.save(entry));
    }

    // ERD exercises.category only has STRENGTH / CARDIO; the free-text category is kept on exercise_entries.
    private static Exercise.Category toErdCategory(String category) {
        return category != null && category.trim().equalsIgnoreCase("cardio")
                ? Exercise.Category.CARDIO
                : Exercise.Category.STRENGTH;
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
                entry.getCategory(), entry.getMuscleGroup(), entry.getLevel(), entry.getGuide(),
                entry.getDemoVideoUrl(), entry.getAnatomyImageUrl(), entry.isActive(), entry.getUpdatedAt());
    }
}
