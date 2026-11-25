package com.calishealth.dtos;

import java.util.List;

/**
 * Hồ sơ sinh lý vận động của một bài tập hệ thống.
 *
 * <p>Chỉ chứa dữ liệu vận động học để hệ thống dùng và hiển thị: kiểu co cơ,
 * đòn cân bằng, tải tim mạch, dải nhịp tim, tác động huyết áp, rủi ro Valsalva,
 * rủi ro dạ dày, tải gân, khớp chính, câu nhắc thở và các chống chỉ định.
 *
 * @param contractionType    DYNAMIC | ISOMETRIC | STATIC
 * @param leverGrade        độ dài đòn cân bằng 1..5
 * @param cardiovascularLoad tải tim mạch 1..5
 * @param hrZoneLow         dải %HRmax thấp
 * @param hrZoneHigh        dải %HRmax cao
 * @param bloodPressureEffect LOWERS | NEUTRAL | RAISES | SPIKE_RISK
 * @param valsalvaRisk      NONE | LOW | MODERATE | HIGH
 * @param giRisk            NONE | LOW | MODERATE | HIGH
 * @param tendonLoad        tải gân 1..5
 * @param primaryJoint      khớp chính chịu lực
 * @param breathingCue      câu nhắc thở cho voice coach / AI Support
 * @param contraindications danh sách mã số bệnh nên tránh
 * @param physiologyNote    ghi chú tổng quan hiển thị cho member
 */
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
        String physiologyNote) {
}
