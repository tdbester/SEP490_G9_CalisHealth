package com.calishealth.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.*;

/**
 * Message là KEY i18n, được tra trong messages_*.properties theo Accept-Language.
 */
@Documented
@Constraint(validatedBy = StrongPasswordValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface StrongPassword {
    String message() default "validation.password.strong";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
