package com.calishealth.models;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "workout_sessions")
@Getter @Setter @NoArgsConstructor
public class WorkoutSession {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String source;

    private LocalDateTime startedAt;

    private LocalDateTime endedAt;

    private Double accuracy;

    private String status;

    @ManyToOne
    @JoinColumn(name = "member_profile_id")
    private MemberProfile memberProfile;

    @ManyToOne
    @JoinColumn(name = "scheduled_workout_id")
    private ScheduledWorkout scheduledWorkout;
}