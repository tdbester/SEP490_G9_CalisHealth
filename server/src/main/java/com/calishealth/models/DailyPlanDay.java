package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One row of daily_plan_template_days: the workout a member follows on a given training day. */
@Embeddable
@Getter
@Setter
@NoArgsConstructor
public class DailyPlanDay {
    @Column(name = "day_number", nullable = false)
    private int dayNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workout_id", nullable = false)
    private WorkoutEntry workout;
}
