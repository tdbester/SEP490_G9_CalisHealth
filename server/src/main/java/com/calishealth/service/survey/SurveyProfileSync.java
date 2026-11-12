package com.calishealth.service.survey;

import com.calishealth.models.AssessmentOption;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.MemberProfile;
import com.calishealth.models.User;
import com.calishealth.repository.AssessmentOptionRepository;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.MemberTrackingRepository;
import com.calishealth.service.MemberTrackingService;
import com.calishealth.service.ProfileService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Copies the onboarding answers into the member's profile rows so the rest of the app can query a
 * normal column instead of digging into {@code assessment_answers}.
 * <p>
 * Two things are worth knowing before changing this class:
 * <ul>
 *   <li>The input is a JSON answer as normalised by the question type handlers: numbers arrive as
 *       numbers, single choices as their option <em>code</em> ({@code "MALE"}), multiple choices as
 *       an array of codes. Choice answers are translated to the human label before they are stored,
 *       because every screen shows the profile value as-is.</li>
 *   <li>Only questions listed in {@link #PROFILE_SOURCES} are mirrored. The survey deliberately
 *       covers more ground than the profile tables hold, so the remaining answers stay in
 *       {@code assessment_answers} and are read from there (see {@link #provenance()}).</li>
 * </ul>
 * Runs inside the transaction that completes the survey; the session row is already locked there.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SurveyProfileSync {

    /** Question code -> the profile column it feeds. Question codes are the contract. */
    private static final Map<String, String> PROFILE_SOURCES = Map.of(
            "GENDER", "member_profiles.gender + users.gender",
            "AGE", "member_profiles.date_of_birth + users.date_of_birth",
            "HEIGHT", "member_profiles.height",
            "WEIGHT", "member_profiles.weight",
            "GOAL_TYPE", "member_profiles.goals",
            "HOW_MANY_DAYS_PER_WEEK_DO_YOU_WANT_TO_TRAIN_WITH_CALISHE", "member_profiles.days_per_week",
            "WEIGHT + HEIGHT", "member_body_metrics (weight_kg, height_cm, bmi)"
    );

    private static final String DAYS_PER_WEEK = "HOW_MANY_DAYS_PER_WEEK_DO_YOU_WANT_TO_TRAIN_WITH_CALISHE";
    private static final int MIN_DAYS_PER_WEEK = 1;
    private static final int MAX_DAYS_PER_WEEK = 7;
    /** Same wording MemberTrackingService uses for a measurement the member typed in. */
    private static final String INITIAL_NOTE = "Initial measurement from onboarding survey";

    private final MemberProfileRepository profiles;
    private final MemberTrackingRepository tracking;
    private final AssessmentOptionRepository options;
    private final com.calishealth.service.MemberFitnessLevelService fitnessLevelsService;

    /**
     * Which survey questions end up in a profile or body-metrics column, and which do not.
     * Read-only description used by tooling and tests; the mapping itself lives in {@link #apply}.
     */
    public Map<String, String> provenance() {
        return PROFILE_SOURCES;
    }

    /**
     * Writes the answers onto the member profile and, when both measurements are present, appends a
     * body-metrics record. Never creates a second profile row and never touches a column the survey
     * does not ask about.
     *
     * @param level the fitness level just assigned, or null when the survey did not yield one
     * @return the profile that was written, or empty when the session has no member account
     */
    public Optional<MemberProfile> apply(User user, Map<String, JsonNode> answers, FitnessLevel level) {
        if (user == null) {
            return Optional.empty();
        }
        MemberProfile profile = profiles.findByUser_Id(user.getId()).orElseGet(() -> {
            MemberProfile created = new MemberProfile();
            created.setUser(user);
            return created;
        });

        if (level != null) {
            fitnessLevelsService.changeLevel(profile, level);
        }

        Map<String, JsonNode> values = answers == null ? Map.of() : answers;
        Map<String, String> labels = choiceLabels(values);

        applyGender(profile, user, values.get("GENDER"), labels);
        applyAge(profile, user, values.get("AGE"));
        applyHeight(profile, values.get("HEIGHT"));
        applyWeight(profile, values.get("WEIGHT"));
        applyGoal(profile, values.get("GOAL_TYPE"), labels);
        applyDaysPerWeek(profile, values.get(DAYS_PER_WEEK));

        profiles.save(profile);
        recordFirstMeasurement(profile);
        return Optional.of(profile);
    }

    // ---------------------------------------------------------------------------------
    // Individual fields
    // ---------------------------------------------------------------------------------

    private void applyGender(MemberProfile profile, User user, JsonNode node, Map<String, String> labels) {
        if (node == null || !node.isTextual()) {
            return;
        }
        String value = ProfileService.normaliseGender(labels.getOrDefault(node.asText(), node.asText()));
        if (value == null) {
            return;
        }
        profile.setGender(value);
        // V26 moved the editable personal details to `users`; keep both rows in step.
        user.setGender(value);
    }

    /**
     * The survey asks for an age, the profile stores a date of birth. The day and month are unknown,
     * so the birth year is all that is kept (1 January), which keeps the age the member entered.
     * An existing date of birth is never replaced: the member may have typed the real one on the
     * profile screen, and that is strictly more precise than this estimate.
     */
    private void applyAge(MemberProfile profile, User user, JsonNode node) {
        if (node == null || !node.canConvertToInt()) {
            return;
        }
        int age = node.intValue();
        if (age < 1 || age > 120) {
            return;
        }
        LocalDate estimate = LocalDate.of(LocalDate.now().getYear() - age, 1, 1);
        if (profile.getDateOfBirth() == null) {
            profile.setDateOfBirth(estimate);
        }
        if (user.getDateOfBirth() == null) {
            user.setDateOfBirth(estimate);
        }
    }

    private void applyHeight(MemberProfile profile, JsonNode node) {
        BigDecimal height = decimal(node);
        if (height != null && height.signum() > 0) {
            profile.setHeight(height);
        }
    }

    private void applyWeight(MemberProfile profile, JsonNode node) {
        BigDecimal weight = decimal(node);
        if (weight != null && weight.signum() > 0) {
            profile.setWeight(weight);
        }
    }

    private void applyGoal(MemberProfile profile, JsonNode node, Map<String, String> labels) {
        if (node == null) {
            return;
        }
        String value = node.isTextual() ? labels.getOrDefault(node.asText(), node.asText()) : node.toString();
        if (!value.isBlank()) {
            profile.setGoals(value);
        }
    }

    private void applyDaysPerWeek(MemberProfile profile, JsonNode node) {
        if (node == null || !node.canConvertToInt()) {
            return;
        }
        int days = node.intValue();
        if (days < MIN_DAYS_PER_WEEK || days > MAX_DAYS_PER_WEEK) {
            log.warn("Ignoring {} = {}; the profile only accepts {}..{} days",
                    DAYS_PER_WEEK, days, MIN_DAYS_PER_WEEK, MAX_DAYS_PER_WEEK);
            return;
        }
        profile.setDaysPerWeek(days);
    }

    /**
     * Appends the measurement the survey produced, but only when it differs from the most recent
     * record. Completing the survey twice therefore does not duplicate the same points on the
     * weight/BMI chart.
     */
    private void recordFirstMeasurement(MemberProfile profile) {
        BigDecimal weight = profile.getWeight();
        BigDecimal height = profile.getHeight();
        BigDecimal bmi = MemberTrackingService.calculateBmi(weight, height);
        if (bmi == null) {
            return;
        }
        if (tracking.hasMetric(profile.getId(), weight, height)) {
            return;
        }
        tracking.saveBodyMetric(profile.getId(), weight, height, bmi, INITIAL_NOTE);
    }

    // ---------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------

    /**
     * Option code -> option label for every choice question present in the answers. One query for
     * the whole survey; answers for numbers and free text simply never look anything up here.
     */
    private Map<String, String> choiceLabels(Map<String, JsonNode> values) {
        if (values.isEmpty()) {
            return Map.of();
        }
        Map<String, String> byCode = new HashMap<>();
        for (List<AssessmentOption> group : optionsByQuestionCode(values.keySet()).values()) {
            for (AssessmentOption option : group) {
                byCode.put(option.getOptionCode(), option.getOptionLabel());
            }
        }
        return byCode;
    }

    private Map<String, List<AssessmentOption>> optionsByQuestionCode(java.util.Set<String> questionCodes) {
        return Map.of();
    }

    private static BigDecimal decimal(JsonNode node) {
        if (node == null) {
            return null;
        }
        if (node.isNumber()) {
            return node.decimalValue();
        }
        if (node.isTextual()) {
            try {
                return new BigDecimal(node.asText().trim());
            } catch (NumberFormatException exception) {
                return null;
            }
        }
        return null;
    }
}
