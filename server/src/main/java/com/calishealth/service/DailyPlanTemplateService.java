package com.calishealth.service;

import com.calishealth.dtos.DailyPlanDtos.DailyPlanDayRequest;
import com.calishealth.dtos.DailyPlanDtos.DailyPlanDayResponse;
import com.calishealth.dtos.DailyPlanDtos.DailyPlanTemplateRequest;
import com.calishealth.dtos.DailyPlanDtos.DailyPlanTemplateResponse;
import com.calishealth.models.DailyPlanDay;
import com.calishealth.models.DailyPlanTemplate;
import com.calishealth.models.Exercise;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.WorkoutEntry;
import com.calishealth.repository.DailyPlanTemplateRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Daily Training Plan Templates: the Content Manager schedules existing system workouts onto the
 * training days of a (level, days per week) combination.
 */
@Service
@RequiredArgsConstructor
public class DailyPlanTemplateService {
    private final DailyPlanTemplateRepository templates;
    private final WorkoutRepository workouts;
    private final FitnessLevelRepository fitnessLevels;
    private final UserRepository users;

    @Transactional(readOnly = true)
    public List<DailyPlanTemplateResponse> findAll() {
        return templates.findAll().stream()
                .sorted(Comparator.comparing(DailyPlanTemplate::getUpdatedAt).reversed())
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public DailyPlanTemplateResponse findByCode(String code) {
        return toResponse(load(code));
    }

    @Transactional
    public DailyPlanTemplateResponse create(DailyPlanTemplateRequest request, String creatorEmail) {
        DailyPlanTemplate template = new DailyPlanTemplate();
        template.setCode("DP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT));
        template.setCreatedBy(users.findByEmail(creatorEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Creator account not found")));
        apply(template, request, true);
        return toResponse(templates.save(template));
    }

    @Transactional
    public DailyPlanTemplateResponse update(String code, DailyPlanTemplateRequest request) {
        DailyPlanTemplate template = load(code);
        apply(template, request, !template.getLevel().equalsIgnoreCase(request == null ? "" : String.valueOf(request.level()).trim()));
        return toResponse(templates.saveAndFlush(template));
    }

    @Transactional
    public DailyPlanTemplateResponse updateStatus(String code, boolean active) {
        DailyPlanTemplate template = load(code);
        if (active) {
            assertLevelActive(template.getLevel());
            assertNoOtherActive(template, template.getLevel(), template.getDaysPerWeek());
            if (template.getDays().stream().anyMatch(day -> !day.getWorkout().isActive())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Replace the inactive workouts in this plan before activating it");
            }
        }
        template.setActive(active);
        return toResponse(templates.saveAndFlush(template));
    }

    @Transactional
    public void delete(String code) {
        templates.delete(load(code));
    }

    private DailyPlanTemplate load(String code) {
        return templates.findByCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Daily training plan template not found"));
    }

    /** Validates the request and copies it onto the template. {@code requireActiveLevel}: new or changed level. */
    private void apply(DailyPlanTemplate template, DailyPlanTemplateRequest request, boolean requireActiveLevel) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Template data is required");
        }
        String name = request.name() == null ? "" : request.name().trim();
        if (name.isEmpty() || name.length() > 60) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Template name is required and must be at most 60 characters");
        }
        String description = request.description() == null ? "" : request.description().trim();
        if (description.length() > 300) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Description must be at most 300 characters");
        }
        String level = resolveLevelName(request.level());
        if (requireActiveLevel) assertLevelActive(level);
        int daysPerWeek = request.daysPerWeek() == null ? 3 : request.daysPerWeek();
        if (daysPerWeek < 1 || daysPerWeek > 7) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Days per week must be between 1 and 7");
        }
        boolean active = request.active() == null || request.active();

        List<DailyPlanDay> days = buildDays(request.days(), daysPerWeek, level, active);
        if (active) {
            assertLevelActive(level);
            assertNoOtherActive(template, level, daysPerWeek);
        }

        template.setName(name);
        template.setDescription(description);
        template.setLevel(level);
        template.setDaysPerWeek(daysPerWeek);
        template.setActive(active);
        template.getDays().clear();
        template.getDays().addAll(days);
    }

    /** Every training day 1..daysPerWeek needs exactly one active system workout of the same level. */
    private List<DailyPlanDay> buildDays(List<DailyPlanDayRequest> requests, int daysPerWeek, String level, boolean active) {
        if (requests == null || requests.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assign a workout to each training day");
        }
        Set<Integer> seen = new HashSet<>();
        List<DailyPlanDay> days = new ArrayList<>();
        for (DailyPlanDayRequest request : requests) {
            if (request == null || request.dayNumber() == null || request.dayNumber() < 1 || request.dayNumber() > daysPerWeek) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Training days must be between Day 1 and Day " + daysPerWeek);
            }
            if (!seen.add(request.dayNumber())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Each training day can only have one workout");
            }
            if (request.workoutCode() == null || request.workoutCode().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a workout for Day " + request.dayNumber());
            }
            WorkoutEntry workout = workouts.findByCode(request.workoutCode().trim())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "The workout for Day " + request.dayNumber() + " no longer exists"));
            // Workout types are HEALTH / SKILL / FLEX / WORKOUT; only weekly plans and non-system workouts are rejected.
            if ("DAILY_TRAINING_PLAN".equals(workout.getType()) || !"SYSTEM".equalsIgnoreCase(workout.getSource())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only system workouts can be scheduled");
            }
            if (!level.equalsIgnoreCase(workout.getLevel())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "\"" + workout.getName() + "\" is a " + workout.getLevel() + " workout. Choose a " + level + " workout");
            }
            if (active && !workout.isActive()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "\"" + workout.getName() + "\" is inactive. Choose an active workout or save the plan as Inactive");
            }
            DailyPlanDay day = new DailyPlanDay();
            day.setDayNumber(request.dayNumber());
            day.setWorkout(workout);
            days.add(day);
        }
        if (days.size() != daysPerWeek) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assign a workout to all " + daysPerWeek + " training days");
        }
        days.sort(Comparator.comparingInt(DailyPlanDay::getDayNumber));
        return days;
    }

    /** One active plan per (level, days per week), so a member always maps to a single plan. */
    private void assertNoOtherActive(DailyPlanTemplate self, String level, int daysPerWeek) {
        boolean conflict = templates.findAll().stream().anyMatch(other ->
                other.isActive()
                        && !other.getCode().equals(self.getCode())
                        && other.getLevel().equalsIgnoreCase(level)
                        && other.getDaysPerWeek() == daysPerWeek);
        if (conflict) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "An active plan already exists for " + level + " · " + daysPerWeek
                            + " days/week. Set it inactive first or save this plan as Inactive");
        }
    }

    private String resolveLevelName(String level) {
        if (level == null || level.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid level");
        }
        return fitnessLevels.findByNameIgnoreCase(level.trim())
                .map(FitnessLevel::getName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid level"));
    }

    private void assertLevelActive(String level) {
        boolean active = fitnessLevels.findByNameIgnoreCase(level)
                .map(item -> "ACTIVE".equalsIgnoreCase(item.getStatus()))
                .orElse(true);
        if (!active) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Level " + level + " is inactive. Activate it in Level & Benchmark Criteria first");
        }
    }

    private DailyPlanTemplateResponse toResponse(DailyPlanTemplate template) {
        List<DailyPlanDayResponse> days = template.getDays().stream()
                .sorted(Comparator.comparingInt(DailyPlanDay::getDayNumber))
                .map(day -> new DailyPlanDayResponse(
                        day.getDayNumber(),
                        day.getWorkout().getCode(),
                        day.getWorkout().getName(),
                        day.getWorkout().getLevel(),
                        day.getWorkout().getExercises().size(),
                        day.getWorkout().isActive(),
                        workoutTypes(day.getWorkout()),
                        targetMuscles(day.getWorkout())))
                .toList();
        return new DailyPlanTemplateResponse(
                template.getId(), template.getCode(), template.getName(), template.getDescription(), template.getLevel(),
                template.getDaysPerWeek(), template.isActive(), template.getUpdatedAt(),
                template.getCreatedBy() == null ? null : template.getCreatedBy().getFullName(),
                days);
    }

    private List<String> workoutTypes(WorkoutEntry workout) {
        return exercises(workout).stream()
                .map(Exercise::getType)
                .filter(type -> type != null && !type.isBlank())
                .map(String::toUpperCase)
                .distinct()
                .sorted()
                .toList();
    }

    private List<String> targetMuscles(WorkoutEntry workout) {
        return exercises(workout).stream()
                .flatMap(exercise -> exercise.getMuscleGroups().stream())
                .map(link -> link.getMuscleGroup().getName())
                .filter(name -> name != null && !name.isBlank())
                .distinct()
                .sorted()
                .toList();
    }

    private List<Exercise> exercises(WorkoutEntry workout) {
        if ("DAILY_TRAINING_PLAN".equals(workout.getType())) {
            return workout.getPlanItems().stream().map(item -> item.getExercise()).distinct().toList();
        }
        return workout.getExercises().stream().map(item -> item.getExercise()).distinct().toList();
    }
}
