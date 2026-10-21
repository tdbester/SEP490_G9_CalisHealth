package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "exercise_entries")
@Getter
@Setter
@NoArgsConstructor
public class ExerciseEntry {
    public enum EntryType { HEALTH, SKILL }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EntryType type;

    @Column(length = 80)
    private String category;

    @Column(name = "muscle_group", nullable = false, length = 120)
    private String muscleGroup;

    @Column(nullable = false, length = 30)
    private String level;

    @Column(nullable = false)
    private boolean active = true;

    @Column(columnDefinition = "TEXT")
    private String guide;

    @Column(name = "demo_video_url", length = 1000)
    private String demoVideoUrl;

    @Column(name = "anatomy_image_url", length = 1000)
    private String anatomyImageUrl;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void updateTimestamp() {
        updatedAt = LocalDateTime.now();
    }
}
