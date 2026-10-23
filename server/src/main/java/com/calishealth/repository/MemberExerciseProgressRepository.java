package com.calishealth.repository;

import com.calishealth.models.MemberExerciseProgress;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface MemberExerciseProgressRepository extends JpaRepository<MemberExerciseProgress, Long> {
    List<MemberExerciseProgress> findAllByMemberIdAndExerciseIdIn(Long memberId, Collection<Long> exerciseIds);
}
