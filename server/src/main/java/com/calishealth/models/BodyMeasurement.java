package com.calishealth.models;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "body_measurements")
@Getter @Setter @NoArgsConstructor
public class BodyMeasurement {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Double weight;

    private Double height;

    private Double bmi;

    private LocalDateTime measuredAt;

    @ManyToOne
    @JoinColumn(name = "member_profile_id")
    private MemberProfile memberProfile;
}