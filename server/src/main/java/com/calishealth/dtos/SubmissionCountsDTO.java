package com.calishealth.dtos;

public record SubmissionCountsDTO(
        long pendingCount,
        long rejectedCount,
        long acceptedCount
) {}
