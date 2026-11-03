package com.calishealth.service;

import com.calishealth.models.Exercise;
import com.calishealth.models.ExerciseMuscleGroup;
import com.calishealth.models.ExerciseMuscleGroupId;
import com.calishealth.models.MuscleGroup;
import com.calishealth.repository.MuscleGroupRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class ExerciseMuscleGroupCatalog {
    private final MuscleGroupRepository muscleGroups;

    public void validate(String labels) {
        resolve(labels);
    }

    public void assign(Exercise exercise, String labels) {
        List<MuscleGroup> resolved = resolve(labels);
        Set<Long> desiredIds = resolved.stream()
                .map(MuscleGroup::getId)
                .collect(java.util.stream.Collectors.toSet());
        exercise.getMuscleGroups().removeIf(link -> link.getMuscleGroup() == null
                || !desiredIds.contains(link.getMuscleGroup().getId()));
        Set<Long> assignedIds = new HashSet<>();
        exercise.getMuscleGroups().stream()
                .map(link -> link.getMuscleGroup().getId())
                .forEach(assignedIds::add);
        for (MuscleGroup muscleGroup : resolved) {
            if (assignedIds.contains(muscleGroup.getId())) {
                continue;
            }
            ExerciseMuscleGroup link = new ExerciseMuscleGroup();
            link.setId(new ExerciseMuscleGroupId());
            link.setExercise(exercise);
            link.setMuscleGroup(muscleGroup);
            exercise.getMuscleGroups().add(link);
            assignedIds.add(muscleGroup.getId());
        }
    }

    private List<MuscleGroup> resolve(String labels) {
        if (labels == null || labels.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select at least one existing muscle group");
        }
        Map<String, MuscleGroup> resolved = new LinkedHashMap<>();
        for (String token : labels.split("(?i)\\s*(?:[,;/·&]|\\band\\b)\\s*", -1)) {
            if (token.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Muscle group list contains an empty value");
            }
            String name = canonicalName(token);
            String key = name.toLowerCase(Locale.ROOT);
            if (resolved.containsKey(key)) {
                continue;
            }
            MuscleGroup group = muscleGroups.findByNameIgnoreCase(name)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "Unknown muscle group: " + token.trim()));
            resolved.put(key, group);
        }
        if (resolved.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select at least one existing muscle group");
        }
        return new ArrayList<>(resolved.values());
    }

    private String canonicalName(String value) {
        String normalized = value.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "arm", "triceps", "biceps", "forearm", "forearms" -> "Arms";
            case "lat", "lats" -> "Back";
            case "leg", "quadriceps", "quad", "quads", "hamstrings", "hip flexors" -> "Legs";
            case "glute" -> "Glutes";
            case "pectoral", "pectorals", "pecs" -> "Chest";
            case "abs", "abdominal", "abdominals" -> "Core";
            case "full-body", "whole body" -> "Full body";
            default -> switch (normalized) {
                case "chest" -> "Chest";
                case "back" -> "Back";
                case "legs" -> "Legs";
                case "core" -> "Core";
                case "arms" -> "Arms";
                case "shoulder", "shoulders" -> "Shoulders";
                case "glutes" -> "Glutes";
                case "full body" -> "Full body";
                default -> value.trim();
            };
        };
    }
}
