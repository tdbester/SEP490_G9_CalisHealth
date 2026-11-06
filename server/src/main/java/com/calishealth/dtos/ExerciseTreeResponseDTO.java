package com.calishealth.dtos;

import java.util.List;
import java.util.Map;

public record ExerciseTreeResponseDTO(
        String movementGroup,
        String order,
        List<ExerciseTreeNodeDTO> nodes,
        List<ExerciseTreeEdgeDTO> edges,
        Map<String, String> legend
) {}
