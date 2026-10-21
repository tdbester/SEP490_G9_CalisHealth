package com.calishealth.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.lang.annotation.*;

/**
 * Message là KEY i18n, được tra trong messages_*.properties theo Accept-Language.
 */
@Documented
@NotBlank(message = "validation.email.required")
@Email(message = "validation.email.format")
@Pattern(
        regexp = "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
        message = "validation.email.format")
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = {})
public @interface ValidEmail {
    String message() default "validation.email.format";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
