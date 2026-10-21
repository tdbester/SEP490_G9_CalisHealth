package com.calishealth.models;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "surveys")
@Getter @Setter @NoArgsConstructor
public class Survey {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    private String type;

    private String status;
}