package com.calishealth.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;

/** DTO cho tính năng AI Support (member hỏi AI về lỗi form sau buổi tập). */
public class AiSupportDtos {

    /**
     * Body khi member đặt câu hỏi.
     *
     * @param exerciseCode bài tập member đang hỏi (bắt buộc để AI bám đúng ngưỡng form)
     * @param question     câu hỏi của member
     * @param sessionId    id phiên chat do client sinh khi mở popup — dùng đếm số câu
     *                     trong phiên (giới hạn 5 câu/phiên) và khôi phục hội thoại
     * @param formIssues   các lỗi form AI phát hiện trong buổi tập (nếu có)
     * @param accuracy     accuracy của bài đó (0-100), nếu có
     */
    public record AskQuestionRequest(
            @NotBlank(message = "exerciseCode is required")
            @Size(max = 64, message = "exerciseCode is too long")
            String exerciseCode,

            @NotBlank(message = "question is required")
            @Size(max = 1000, message = "question must be at most 1000 characters")
            String question,

            @Size(max = 64, message = "sessionId is too long")
            String sessionId,

            List<@Size(max = 200, message = "form issue is too long") String> formIssues,

            Double accuracy
    ) {}

    /**
     * Một nguyên nhân có thể gây lỗi form.
     *
     * @param title   tiêu đề ngắn (vd: "Core fatigue")
     * @param detail  giải thích (vd: "Abs and glutes tire before your chest, so hips drop.")
     */
    public record LikelyCause(
            String title,
            String detail
    ) {}

    /**
     * Câu trả lời của AI cho một câu hỏi.
     *
     * @param causes      các nguyên nhân có thể (Figma hiển thị "3 likely causes")
     * @param tip         mẹo sửa form (1 dòng cuối, ngăn cách bởi divider)
     * @param followUps   câu hỏi gợi ý tiếp theo cho member
     */
    public record AnswerResponse(
            List<LikelyCause> causes,
            String tip,
            List<String> followUps
    ) {}

    /**
     * Kết quả trả về cho client.
     *
     * @param answer        nội dung AI trả lời
     * @param questionCount số câu đã hỏi hôm nay (sau khi tính câu này)
     * @param dailyLimit    hạn mức câu/ngày
     * @param remaining     số câu còn lại hôm nay
     * @param sessionIndex  số thứ tự câu hỏi trong phiên chat
     * @param sessionLimit  hạn mức câu/phiên chat
     * @param provider      nguồn câu trả lời ("gpt-4o-mini" khi dùng API thật,
     *                     "local-rules" khi server chưa cấu hình API key)
     * @param totalTokens   số token đã dùng cho lượt hỏi này
     * @param notice        mã lý do server phải trả lời bằng rule nội bộ
     *                     (null khi câu trả lời đến từ AI thật) — frontend
     *                     dùng để hiện cảnh báo demo/offline
     */
    public record AskQuestionResponse(
            AnswerResponse answer,
            int questionCount,
            int dailyLimit,
            int remaining,
            int sessionIndex,
            int sessionLimit,
            String provider,
            int totalTokens,
            String notice
    ) {}

    /**
     * Trạng thái quota của member hôm nay — dùng để mở popup mà không cần hỏi trước.
     *
     * @param questionCount số câu đã hỏi hôm nay
     * @param dailyLimit   hạn mức câu/ngày
     * @param remaining    số câu còn lại hôm nay
     * @param sessionLimit hạn mức câu/phiên chat
     * @param sessionUsed  số câu đã hỏi trong phiên chat hiện tại
     * @param aiEnabled    server đã cấu hình API thật (gpt-4o-mini) hay chưa
     * @param model        model AI đang dùng (null khi chưa cấu hình)
     * @param demoFallback server có bật chế độ demo (trả lời bằng rule nội bộ
     *                    khi API lỗi) hay không
     */
    public record QuotaResponse(
            int questionCount,
            int dailyLimit,
            int remaining,
            int sessionLimit,
            int sessionUsed,
            boolean aiEnabled,
            String model,
            boolean demoFallback
    ) {}

    /**
     * Một cặp hỏi/đáp trong lịch sử hôm nay.
     *
     * @param exerciseName tên bài tập đã hỏi (null nếu hỏi chung)
     * @param sessionId    id phiên chat của câu hỏi đó
     * @param answerJson   câu trả lời dạng JSON (causes + tip + followUps)
     * @param createdAt    thời điểm hỏi
     */
    public record HistoryItem(
            String exerciseName,
            String question,
            String answerJson,
            String sessionId,
            LocalDateTime createdAt
    ) {}
}
