package com.calishealth.repository;

import com.calishealth.models.ProfanityWord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProfanityWordRepository extends JpaRepository<ProfanityWord, Long> {
    List<ProfanityWord> findByActiveTrueOrderByIdAsc();
}
