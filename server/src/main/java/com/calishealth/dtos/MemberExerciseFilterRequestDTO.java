package com.calishealth.dtos;

import com.calishealth.models.ExerciseEntry;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MemberExerciseFilterRequestDTO {
    @Pattern(regexp = "COMMUNITY|MY_SUBMISSIONS", message = "Tab must be COMMUNITY or MY_SUBMISSIONS")
    private String tab = "COMMUNITY";

    private String search;

    private ExerciseEntry.EntryLevel level;

    private ExerciseEntry.EntryStatus status;

    @Pattern(regexp = "NEWEST|MOST_SAVED|OLDEST", message = "sortBy must be NEWEST, OLDEST or MOST_SAVED")
    private String sortBy = "NEWEST";

    @Min(0)
    private int page = 0;

    @Min(1)
    @Max(100)
    private int size = 6;
}
