package com.calishealth.models;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

@Entity
@Table(name = "monthly_performances")
@Getter @Setter @NoArgsConstructor
public class MonthlyPerformance {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDate monthlyStart;

    private Double totalVolume;

    private Integer cleanReps;

    private Double healthScore;

    @ManyToOne
    @JoinColumn(name = "member_profile_id")
    private MemberProfile memberProfile;
}