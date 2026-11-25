package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * Ngưỡng chấm form cho 1 khớp của 1 bài tập.
 *
 * <p>Cấu trúc hỗ trợ 2 kiểu đo:
 * <ul>
 *   <li><b>2 ngưỡng</b> ({@code angleThreshold} = trên cùng, {@code romDepth} = đáy):
 *       dùng cho bài đếm rep — so góc khớp khi ở đỉnh và khi ở đáy.</li>
 *   <li><b>Dải</b> ({@code minAngle}..{@code maxAngle}): dùng cho bài giữ (plank)
 *       — góc phải nằm trong dải thì mới tính là đúng tư thế.</li>
 * </ul>
 *
 * <p>Rule cũ (chỉ có {@code angleThreshold}/{@code romDepth}) vẫn đọc được như cũ —
 * client tự fallback về 2 cột cũ khi {@code minAngle}/{@code maxAngle} rỗng.
 */
@Entity
@Table(name = "form_rules")
@Getter
@Setter
@NoArgsConstructor
public class FormRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Khớp cần theo dõi: KNEE | HIP | ELBOW | SHOULDER | WRIST | ANKLE. */
    @Column(length = 80)
    private String joint;

    /** Góc tối đa (độ) ở vị trí trên cùng — vượt ngưỡng này là đã duỗi hết. */
    @Column(name = "angle_threshold", precision = 7, scale = 3)
    private BigDecimal angleThreshold;

    /** Góc (độ) ở vị trí đáy — xuống tới ngưỡng này mới tính là đủ sâu. */
    @Column(name = "rom_depth", precision = 7, scale = 3)
    private BigDecimal romDepth;

    /** Biên dưới của dải góc "đạt" (dùng cho bài giữ — plank). */
    @Column(name = "min_angle", precision = 7, scale = 3)
    private BigDecimal minAngle;

    /** Biên trên của dải góc "đạt" (dùng cho bài giữ — plank). */
    @Column(name = "max_angle", precision = 7, scale = 3)
    private BigDecimal maxAngle;

    /** Trọng số thành phần này trong tổng điểm rep (0..1). */
    @Column(name = "weight", precision = 5, scale = 2)
    private BigDecimal weight;

    /** Dung sai cho phép (độ) — bán kính vùng dung quanh ngưỡng. */
    @Column(name = "tolerance", precision = 7, scale = 3)
    private BigDecimal tolerance;

    /** Nguồn gốc rule: DEFAULT | CONTENT_MANAGER | MEMBER. */
    @Column(name = "source", length = 20)
    private String source;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exercise_id", nullable = false)
    private Exercise exercise;
}
