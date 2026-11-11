package com.calishealth.dtos;

import java.util.List;

public record ExercisePhysiologyDTO(
        String contractionType,
        Integer leverGrade,
        Integer cardiovascularLoad,
        Integer hrZoneLow,
        Integer hrZoneHigh,
        String bloodPressureEffect,
        String valsalvaRisk,
        String giRisk,
        Integer tendonLoad,
        String primaryJoint,
        String breathingCue,
        List<String> contraindications,
        String physiologyNote,
        List<String> evidenceRefs,
        List<PhysiologyEvidenceDTO> evidences) {
}
