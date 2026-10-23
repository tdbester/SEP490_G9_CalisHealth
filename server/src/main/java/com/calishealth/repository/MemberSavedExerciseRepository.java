package com.calishealth.repository;

import com.calishealth.models.MemberSavedExercise;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface MemberSavedExerciseRepository extends JpaRepository<MemberSavedExercise, Long> {
    List<MemberSavedExercise> findAllByMemberIdAndExerciseIdIn(Long memberId, Collection<Long> exerciseIds);
}
