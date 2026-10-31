package com.calishealth.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateNotificationRequestDto(
        @NotBlank(message = "Title is required")
        @Size(max = 255, message = "Title must not exceed 255 characters")
        String title,

        @NotBlank(message = "Message is required")
        String message,

        @NotBlank(message = "Type is required")
        @Pattern(regexp = "ANNOUNCEMENT|UPDATE", message = "Type must be ANNOUNCEMENT or UPDATE")
        String type,

        @NotBlank(message = "Status is required")
        @Pattern(regexp = "PUBLISHED|DRAFT", message = "Status must be PUBLISHED or DRAFT")
        String status
) {}
