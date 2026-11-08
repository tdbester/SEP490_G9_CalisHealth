package com.calishealth.repository;

import com.calishealth.models.MemberFavorite;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MemberFavoriteRepository extends JpaRepository<MemberFavorite, Long> {
    Optional<MemberFavorite> findByMemberIdAndItemTypeAndItemId(
            Long memberId,
            MemberFavorite.ItemType itemType,
            Long itemId);

    List<MemberFavorite> findAllByMemberId(Long memberId);

    List<MemberFavorite> findAllByMemberIdAndItemType(
            Long memberId,
            MemberFavorite.ItemType itemType);

    List<MemberFavorite> findAllByMemberIdAndItemTypeIn(
            Long memberId,
            Collection<MemberFavorite.ItemType> itemTypes);

    void deleteByMemberIdAndItemTypeAndItemId(
            Long memberId,
            MemberFavorite.ItemType itemType,
            Long itemId);

    boolean existsByMemberIdAndItemTypeAndItemId(
            Long memberId,
            MemberFavorite.ItemType itemType,
            Long itemId);
}
