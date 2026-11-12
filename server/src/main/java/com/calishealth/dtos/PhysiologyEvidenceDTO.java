package com.calishealth.dtos;

import java.util.List;

public record PhysiologyEvidenceDTO(
        String code,
        String title,
        String authors,
        String journal,
        Integer year,
        String doi,
        String url,
        String evidenceGrade,
        String studyType,
        String summary) {
}
