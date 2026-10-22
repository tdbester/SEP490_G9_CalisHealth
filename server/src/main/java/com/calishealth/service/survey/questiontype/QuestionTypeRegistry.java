package com.calishealth.service.survey.questiontype;

import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;

/**
 * Danh bạ các loại câu hỏi được hỗ trợ. Spring tiêm mọi bean QuestionTypeHandler vào đây;
 * loại không có handler = không được hỗ trợ (cấu hình bị từ chối, không chấp nhận âm thầm).
 */
@Component
public class QuestionTypeRegistry {
    private final Map<String, QuestionTypeHandler> handlers;

    public QuestionTypeRegistry(List<QuestionTypeHandler> handlerBeans) {
        Map<String, QuestionTypeHandler> byType = new TreeMap<>();
        for (QuestionTypeHandler handler : handlerBeans) {
            QuestionTypeHandler previous = byType.putIfAbsent(handler.type(), handler);
            if (previous != null) {
                throw new IllegalStateException("Duplicate QuestionTypeHandler for type " + handler.type()
                        + ": " + previous.getClass().getName() + " and " + handler.getClass().getName());
            }
        }
        this.handlers = Collections.unmodifiableMap(byType);
    }

    public Optional<QuestionTypeHandler> find(String type) {
        return Optional.ofNullable(type == null ? null : handlers.get(type));
    }

    public boolean supports(String type) {
        return find(type).isPresent();
    }

    public Set<String> supportedTypes() {
        return handlers.keySet();
    }
}
