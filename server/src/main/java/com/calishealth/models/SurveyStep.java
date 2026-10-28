package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "survey_steps")
@Getter
@Setter
@NoArgsConstructor
public class SurveyStep {
    /** DRAFT: mới tạo, member chưa thấy. ACTIVE: member thấy. INACTIVE: đã tắt (không xóa vì có thể đã có câu trả lời). */
    public enum Status { DRAFT, ACTIVE, INACTIVE }

    /** QUESTIONS: bước có câu hỏi. RESULT: bước kết quả do hệ thống sinh, không có câu hỏi, tối đa 1 / survey. */
    public enum Type { QUESTIONS, RESULT }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "survey_id", nullable = false)
    private Survey survey;

    @Column(name = "step_code", nullable = false, length = 64)
    private String stepCode;

    @Column(name = "step_name", nullable = false)
    private String stepName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "step_type", nullable = false, length = 16)
    private Type stepType = Type.QUESTIONS;

    /** JSON thô của SurveyDtos.ResultConfig; chỉ có ở bước RESULT. */
    @Column(name = "result_config", columnDefinition = "json")
    private String resultConfig;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status = Status.DRAFT;

    /** Tăng mỗi lần nội dung bước đổi; dùng để chặn ghi đè khi 2 người cùng sửa (409 STEP_MODIFIED). */
    @Column(nullable = false)
    private int revision;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    /** Service tự đặt khi nội dung bước đổi; đổi thứ tự không cập nhật cột này. */
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by")
    private User updatedBy;

    public boolean isResult() {
        return stepType == Type.RESULT;
    }
}
