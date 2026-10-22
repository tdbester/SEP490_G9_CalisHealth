package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "media_files")
@Getter
@Setter
@NoArgsConstructor
public class MediaFile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "file_url", nullable = false, length = 255)
    private String fileUrl;

    @Column(name = "file_type", length = 50)
    private String fileType;

    @Column(length = 50)
    private String format;

    @Column(name = "size_mb", precision = 10, scale = 2)
    private BigDecimal sizeMb;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Column(length = 100)
    private String purpose;

    @Column(length = 50)
    private String status;

    @Column(name = "uploaded_at")
    private LocalDateTime uploadedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploader_id")
    private User uploadedBy;
}
