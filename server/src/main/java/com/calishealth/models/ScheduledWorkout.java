package com.calishealth.models;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

@Entity
@Table(name = "scheduled_workouts")
@Getter @Setter @NoArgsConstructor
public class ScheduledWorkout {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDate scheduledDate;

    private String status;

    @ManyToOne
    @JoinColumn(name = "member_profile_id")
    private MemberProfile memberProfile;

    @ManyToOne
    @JoinColumn(name = "trainning_plan_id")
    private TrainningPlan trainningPlan;
}