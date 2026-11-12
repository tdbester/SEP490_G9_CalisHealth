package com.calishealth.service;

import com.calishealth.events.MemberFitnessLevelChangedEvent;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.MemberProfile;
import com.calishealth.models.MemberWeeklyScore;
import com.calishealth.models.User;
import com.calishealth.repository.MemberProfileRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Đổi level giữa tuần phải báo lại để tính lại điểm leaderboard từ đầu.
 */
class MemberFitnessLevelServiceTest {

    private final MemberProfileRepository memberProfiles = mock(MemberProfileRepository.class);
    private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    private final MemberFitnessLevelService service =
            new MemberFitnessLevelService(memberProfiles, events);

    private static MemberProfile profile(Long levelId) {
        MemberProfile profile = new MemberProfile();
        profile.setId(7L);
        profile.setUser(new User());
        profile.getUser().setId(1007L);
        if (levelId != null) {
            FitnessLevel level = new FitnessLevel();
            level.setId(levelId);
            level.setName("Beginner");
            profile.setFitnessLevel(level);
        }
        return profile;
    }

    private static FitnessLevel level(Long id, String name) {
        FitnessLevel level = new FitnessLevel();
        level.setId(id);
        level.setName(name);
        return level;
    }

    @Test
    void changingLevelPublishesAnEventSoTheWeeklyScoreCanBeRecomputed() {
        MemberProfile profile = profile(1L);

        service.changeLevel(profile, level(2L, "Intermediate"));

        ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
        verify(events).publishEvent(captor.capture());
        assertThat(captor.getValue()).isInstanceOf(MemberFitnessLevelChangedEvent.class);
        assertThat(((MemberFitnessLevelChangedEvent) captor.getValue()).memberProfileId()).isEqualTo(7L);
        assertThat(profile.getFitnessLevel().getId()).isEqualTo(2L);
    }

    @Test
    void keepingTheSameLevelDoesNotPublishAnEvent() {
        MemberProfile profile = profile(1L);

        service.changeLevel(profile, level(1L, "Beginner"));

        verify(events, never()).publishEvent(any(Object.class));
    }

    @Test
    void aMemberWithoutLevelGetsTheNewOneAndTheScoreIsRecomputed() {
        MemberProfile profile = profile(null);

        service.changeLevel(profile, level(1L, "Beginner"));

        // Từ "chưa có level" sang có level cũng là một lần đổi level, nên
        // điểm tuần cũng phải được tính lại dưới level mới.
        ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
        verify(events).publishEvent(captor.capture());
        assertThat(captor.getValue()).isInstanceOf(MemberFitnessLevelChangedEvent.class);
        assertThat(profile.getFitnessLevel().getId()).isEqualTo(1L);
    }
}
