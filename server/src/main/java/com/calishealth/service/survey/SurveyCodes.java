package com.calishealth.service.survey;

import java.text.Normalizer;
import java.util.Locale;
import java.util.function.Predicate;

/** Sinh mã (step_code, question_code, option_code) từ tên người dùng nhập: "Mục tiêu & động lực" -> MUC_TIEU_DONG_LUC. */
public final class SurveyCodes {
    /** Mã tối đa 64 ký tự; chừa chỗ cho hậu tố "_NN" khi bị trùng. */
    private static final int BASE_LENGTH = 56;

    private SurveyCodes() {
    }

    /**
     * fallback: tiền tố khi tên không cho ra mã hợp lệ (rỗng, ngắn hoặc bắt đầu bằng số), vd "STEP" -> STEP_3_DAYS.
     * taken: mã đã dùng; trùng thì thêm hậu tố _2, _3...
     */
    public static String generate(String name, String fallback, Predicate<String> taken) {
        String base = Normalizer.normalize(name, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('đ', 'd')
                .replace('Đ', 'D')
                .toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
        if (base.length() < 2 || !Character.isLetter(base.charAt(0))) {
            base = base.isEmpty() ? fallback : fallback + "_" + base;
        }
        if (base.length() > BASE_LENGTH) {
            base = base.substring(0, BASE_LENGTH).replaceAll("_+$", "");
        }
        String code = base;
        for (int suffix = 2; taken.test(code); suffix++) {
            code = base + "_" + suffix;
        }
        return code;
    }
}
