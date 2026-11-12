package com.calishealth.dtos;

import java.util.List;

/**
 * Input của hồ sơ sinh lý do Content Manager nhập ở màn Create/Update System Exercise.
 *
 * <p>Không chứa {@code evidences} vì phần trích dẫn chi tiết luôn được server
 * nạp lại từ bảng {@code physiology_evidence} theo {@code evidenceRefs}.
 */
public record ExercisePhysiologyInputDTO(
        /** DYNAMIC | ISOMETRIC | STATIC */
        String contractionType,
        /** Độ dài đòn cân bằng 1..5 (1 = gần điểm đổi trục, 5 = xa nhất). */
        Integer leverGrade,
        /** Tải tim mạch 1..5. */
        Integer cardiovascularLoad,
        /** Dải %HRmax thấp (30..95). */
        Integer hrZoneLow,
        /** Dải %HRmax cao (>= hrZoneLow, <= 100). */
        Integer hrZoneHigh,
        /** LOWERS | NEUTRAL | RAISES | SPIKE_RISK */
        String bloodPressureEffect,
        /** NONE | LOW | MODERATE | HIGH */
        String valsalvaRisk,
        /** NONE | LOW | MODERATE | HIGH */
        String giRisk,
        /** Tải gân 1..5. */
        Integer tendonLoad,
        /** WRIST | ELBOW | SHOULDER | SPINE | HIP | KNEE | ANKLE */
        String primaryJoint,
        /** Câu nhắc thở cho voice coach / AI Support. */
        String breathingCue,
        /** Danh sách mã số bệnh nên tránh: hypertension, glaucoma, knee_pain... */
        List<String> contraindications,
        /** Ghi chú tổng quan hiển thị cho member ở màn chi tiết bài tập. */
        String physiologyNote,
        /** Danh sách mã nguồn trích dẫn (physiology_evidence.code). */
        List<String> evidenceRefs
) {
}
