package com.calishealth.config;

import com.calishealth.service.ExerciseVideoStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class ExerciseVideoResourceConfig implements WebMvcConfigurer {
    private final ExerciseVideoStorageService videoStorage;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String storageLocation = videoStorage.getStorageDirectory().toUri().toString();
        registry.addResourceHandler("/media/exercise-demos/**")
                .addResourceLocations(storageLocation.endsWith("/") ? storageLocation : storageLocation + "/");
        String anatomyLocation = videoStorage.getAnatomyImageDirectory().toUri().toString();
        registry.addResourceHandler("/media/exercise-anatomy/**")
                .addResourceLocations(anatomyLocation.endsWith("/") ? anatomyLocation : anatomyLocation + "/");
    }
}
