package com.calishealth.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.lang.annotation.*;

@Documented
@NotBlank(message = "Vui lòng nhập email")
@Email(message = "Email không đúng định dạng")
@Size(max = 100, message = "Email tối đa 100 ký tự")
@Pattern(
        regexp = "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
        message = "Email không đúng định dạng")
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = {})
public @interface ValidEmail {
    String message() default "Email không đúng định dạng";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
