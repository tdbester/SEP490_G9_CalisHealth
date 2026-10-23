package com.calishealth.service.survey.definition;

public record OptionDefinition(String code, String label, String value, int sortOrder, boolean active) {
}
