package com.calishealth.dtos;

import java.util.List;

public record PageResponseDTO<T>(
        List<T> content,
        int currentPage,
        int pageSize,
        long totalElements,
        int totalPages,
        boolean hasNext,
        boolean hasPrevious
) {}
