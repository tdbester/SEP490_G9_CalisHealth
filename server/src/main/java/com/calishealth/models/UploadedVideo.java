package com.calishealth.models;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "uploaded_videos")
@Getter @Setter @NoArgsConstructor
public class UploadedVideo {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String fileUrl;

    private String format;

    private Double sizeMb;

    private Integer durationSeconds;

    @ManyToOne
    @JoinColumn(name = "workout_session_id")
    private WorkoutSession workoutSession;
}