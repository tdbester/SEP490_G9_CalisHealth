package com.calishealth.dtos;

public record ExerciseTreeEdgeDTO(
        Long ruleId,
        String status,
        String prerequisiteCode,
        String exerciseCode
) {}
