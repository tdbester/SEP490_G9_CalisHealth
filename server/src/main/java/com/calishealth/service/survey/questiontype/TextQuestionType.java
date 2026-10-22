package com.calishealth.service.survey.questiontype;

import org.springframework.stereotype.Component;

/** TEXT: văn bản ngắn, mặc định tối đa 255 ký tự. */
@Component
public class TextQuestionType extends AbstractTextQuestionType {
    @Override
    public String type() {
        return "TEXT";
    }

    @Override
    protected int defaultMaxLength() {
        return 255;
    }
}
