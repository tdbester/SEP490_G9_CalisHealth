package com.calishealth.models;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "system_settings")
@Getter @Setter @NoArgsConstructor
public class SystemSetting {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String type;

    @Column(name = "setting_value", columnDefinition = "TEXT")
    private String value;

    private Integer priority;

    private String status;
}