package com.calishealth.dtos;

import java.util.List;

public record ContentTextCheckResponseDTO(List<String> flaggedWords) {
    public boolean passed() {
        return flaggedWords.isEmpty();
    }
}
