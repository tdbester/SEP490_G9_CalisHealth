package com.calishealth.service.survey.questiontype;

import org.springframework.stereotype.Component;

/** TEXTAREA: văn bản nhiều dòng, mặc định tối đa 2000 ký tự. */
@Component
public class TextareaQuestionType extends AbstractTextQuestionType {
    @Override
    public String type() {
        return "TEXTAREA";
    }

    @Override
    protected int defaultMaxLength() {
        return 2000;
    }
}
