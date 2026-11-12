package com.calishealth.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Kiểm thử lớp bảo vệ red flag y tế.
 *
 * <p>Trọng tâm: câu hỏi tiếng Việt gõ KHÔNG DẤU (rất phổ biến khi member gõ
 * nhanh trên điện thoại) vẫn phải bị chặn, đồng thời KHÔNG được báo động giả
 * khi từ khoá chỉ là chuỗi con của một từ khác.
 */
class MedicalRedFlagDetectorTest {

    @Test
    @DisplayName("Câu hỏi không dấu vẫn bị chặn")
    void detectsRedFlagWithoutDiacritics() {
        assertNotNull(MedicalRedFlagDetector.detect("Toi bi chong mat khi lam plank"));
        assertNotNull(MedicalRedFlagDetector.detect("toi bi dau nguc khi tap"));
        assertNotNull(MedicalRedFlagDetector.detect("toi bi te chan sau buoi tap"));
        assertNotNull(MedicalRedFlagDetector.detect("toi bi ngat xiu khi tap"));
        assertNotNull(MedicalRedFlagDetector.detect("toi bi kho tho khi chay"));
        assertNotNull(MedicalRedFlagDetector.detect("toi bi sot khi tap"));
        assertNotNull(MedicalRedFlagDetector.detect("vai toi bi trat khop"));
    }

    @Test
    @DisplayName("Câu hỏi có dấu vẫn bị chặn")
    void detectsRedFlagWithDiacritics() {
        assertNotNull(MedicalRedFlagDetector.detect("Tôi bị chóng mặt khi đứng dậy nhanh"));
        assertNotNull(MedicalRedFlagDetector.detect("tôi bị đau ngực khi tập squat"));
        assertNotNull(MedicalRedFlagDetector.detect("tôi bị tê chân sau buổi tập"));
        assertNotNull(MedicalRedFlagDetector.detect("tôi bị khó thở khi chạy"));
    }

    @Test
    @DisplayName("Chữ 'đ' được chuẩn hoá đúng (không bị mất thành khoảng trắng)")
    void handlesVietnameseDLetter() {
        // Nếu "đ" không được xử lý riêng thì "đau ngực" -> "au nguc" và
        // không bao giờ khớp với câu hỏi gõ không dấu.
        assertEquals("dau nguc", MedicalRedFlagDetector.normalize("đau ngực"));
        assertEquals("toi bi dau nguc", MedicalRedFlagDetector.normalize("Toi bi đau ngực"));
    }

    @Test
    @DisplayName("Không báo động giả với từ chứa từ khoá")
    void doesNotFireOnSubstringKeywords() {
        // "tên" chứa "tê" -> trước đây bị báo động giả "neuro".
        assertNull(MedicalRedFlagDetector.detect("chọn tên bài tập phù hợp"));
        assertNull(MedicalRedFlagDetector.detect("làm sao để chọn tên bài tập"));
        assertNull(MedicalRedFlagDetector.detect("hướng dẫn plank đúng không"));
        // "tê" chỉ khớp khi đứng riêng là một từ.
        assertNull(MedicalRedFlagDetector.detect("tên bài tập của tôi là gì"));
    }

    @Test
    @DisplayName("Câu hỏi tiếng Anh vẫn bị chặn")
    void detectsEnglishRedFlags() {
        assertNotNull(MedicalRedFlagDetector.detect("I feel dizzy during plank"));
        assertNotNull(MedicalRedFlagDetector.detect("my chest hurts when I squat"));
        assertNotNull(MedicalRedFlagDetector.detect("I cannot breathe properly"));
    }

    @Test
    @DisplayName("Câu hỏi bình thường không bị chặn")
    void allowsNormalQuestions() {
        assertFalse(MedicalRedFlagDetector.containsRedFlag("Làm sao để giữ hông thẳng khi squat?"));
        assertFalse(MedicalRedFlagDetector.containsRedFlag("How many sets should I do?"));
        assertFalse(MedicalRedFlagDetector.containsRedFlag(null));
        assertFalse(MedicalRedFlagDetector.containsRedFlag("   "));
    }
}
