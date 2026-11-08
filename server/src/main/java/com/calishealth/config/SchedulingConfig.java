package com.calishealth.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Enables @Scheduled jobs (media auto-cleanup). */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
