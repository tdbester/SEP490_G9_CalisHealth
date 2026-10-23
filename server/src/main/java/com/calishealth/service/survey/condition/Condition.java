package com.calishealth.service.survey.condition;

import tools.jackson.databind.JsonNode;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Điều kiện hiển thị/được phép trả lời, dựng từ JSON cấu hình bởi ConditionParser.
 * Chỉ là cây dữ liệu + so sánh cố định, không thực thi biểu thức hay code nào.
 */
public sealed interface Condition permits Condition.Compare, Condition.Group {

    enum Operator {
        EQ, NE, IN, NOT_IN, GT, GTE, LT, LTE, AND, OR;

        boolean isGroup() {
            return this == AND || this == OR;
        }
    }

    /** answers: questionCode -> giá trị đã chuẩn hóa (không chứa câu chưa trả lời). */
    boolean test(Map<String, JsonNode> answers);

    Set<String> referencedQuestions();

    /**
     * So sánh với câu trả lời của 1 câu hỏi khác. Câu nguồn chưa trả lời -> luôn false (kể cả NE/NOT_IN).
     * Nguồn là mảng (MULTIPLE_SELECT): EQ = có chứa value, IN = giao nhau khác rỗng.
     */
    record Compare(Operator operator, String questionCode, JsonNode value) implements Condition {
        @Override
        public boolean test(Map<String, JsonNode> answers) {
            JsonNode actual = answers.get(questionCode);
            if (actual == null || actual.isNull()) {
                return false;
            }
            return switch (operator) {
                case EQ -> matchesAny(actual, value);
                case NE -> !matchesAny(actual, value);
                case IN -> anyIn(actual, value);
                case NOT_IN -> !anyIn(actual, value);
                case GT, GTE, LT, LTE -> compareNumbers(actual);
                case AND, OR -> throw new IllegalStateException("Group operator in Compare");
            };
        }

        /** Chỉ so sánh khi cả hai là số; không phải số -> false. */
        private boolean compareNumbers(JsonNode actual) {
            if (!actual.isNumber() || !value.isNumber()) {
                return false;
            }
            int cmp = actual.decimalValue().compareTo(value.decimalValue());
            return switch (operator) {
                case GT -> cmp > 0;
                case GTE -> cmp >= 0;
                case LT -> cmp < 0;
                default -> cmp <= 0;
            };
        }

        @Override
        public Set<String> referencedQuestions() {
            return Set.of(questionCode);
        }

        private static boolean matchesAny(JsonNode actual, JsonNode expected) {
            if (actual.isArray()) {
                for (int i = 0; i < actual.size(); i++) {
                    if (scalarEquals(actual.get(i), expected)) {
                        return true;
                    }
                }
                return false;
            }
            return scalarEquals(actual, expected);
        }

        private static boolean anyIn(JsonNode actual, JsonNode expectedList) {
            for (int i = 0; i < expectedList.size(); i++) {
                if (matchesAny(actual, expectedList.get(i))) {
                    return true;
                }
            }
            return false;
        }

        private static boolean scalarEquals(JsonNode a, JsonNode b) {
            if (a.isNumber() && b.isNumber()) {
                return a.decimalValue().compareTo(b.decimalValue()) == 0;
            }
            return a.equals(b);
        }
    }

    record Group(Operator operator, List<Condition> conditions) implements Condition {
        public Group {
            conditions = List.copyOf(conditions);
        }

        @Override
        public boolean test(Map<String, JsonNode> answers) {
            return operator == Operator.AND
                    ? conditions.stream().allMatch(c -> c.test(answers))
                    : conditions.stream().anyMatch(c -> c.test(answers));
        }

        @Override
        public Set<String> referencedQuestions() {
            Set<String> codes = new LinkedHashSet<>();
            conditions.forEach(c -> codes.addAll(c.referencedQuestions()));
            return codes;
        }
    }
}
