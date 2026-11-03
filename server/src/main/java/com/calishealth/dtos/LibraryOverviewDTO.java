package com.calishealth.dtos;

public record LibraryOverviewDTO(
        long healthExercisesCount,
        long skillExercisesCount,
        long memberExercisesCount,
        long healthWorkoutsCount,
        long skillWorkoutsCount,
        long customWorkoutsCount
) {}
