package com.calishealth.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Bo sung coverage cho {@link ProfileService#normaliseGender(String)}: cac ma gioi tinh cua
 * khauo sat (MALE / FEMALE / OTHER) va {@link MedicalRedFlagDetector}.
 */
class GenderAndRedFlagExtraCoverageTest {

    @Test
    @DisplayName("normaliseGender: 'MALE' -> Male")
    void normaliseGenderMapsMaleCode() {
        assertEquals("Male", ProfileService.normaliseGender("MALE"));
    }

    @Test
    @DisplayName("normaliseGender: 'FEMALE' -> Female")
    void normaliseGenderMapsFemaleCode() {
        assertEquals("Female", ProfileService.normaliseGender("FEMALE"));
    }

    @Test
    @DisplayName("normaliseGender: 'OTHER' -> Other")
    void normaliseGenderMapsOtherCode() {
        assertEquals("Other", ProfileService.normaliseGender("OTHER"));
    }

    @Test
    @DisplayName("normaliseGender: null -> null")
    void normaliseGenderRejectsNull() {
        assertNull(ProfileService.normaliseGender(null));
    }

    @Test
    @DisplayName("normaliseGender: chuoi rong -> null")
    void normaliseGenderRejectsBlank() {
        assertNull(ProfileService.normaliseGender("   "));
    }

    // ----------------------------------------------------- MedicalRedFlagDetector

    @Test
    @DisplayName("detect: cau hoi chi co dau cach -> khong co canh bao")
    void detectIgnoresPunctuationOnlyQuestion() {
        assertNull(MedicalRedFlagDetector.detect("???!!!"));
    }

    @Test
    @DisplayName("detect: cau hoi rong -> khong co canh bao")
    void detectIgnoresBlankQuestion() {
        assertNull(MedicalRedFlagDetector.detect("   "));
        assertNull(MedicalRedFlagDetector.detect(null));
    }

    @Test
    @DisplayName("normalize: null -> chuoi rong")
    void normalizeHandlesNull() {
        assertEquals("", MedicalRedFlagDetector.normalize(null));
    }

    @Test
    @DisplayName("normalize: bo dau, viet thuong, gom khoang trang")
    void normalizeStripsDiacriticsAndPunctuation() {
        assertEquals("toi bi dau that lung", MedicalRedFlagDetector.normalize("Tôi bị đau thắt lưng!"));
    }

    @Test
    @DisplayName("detect: trieu chung nguy hiem -> tra ve canh bao")
    void detectFindsRedFlagSymptom() {
        String[] found = MedicalRedFlagDetector.detect("Toi bi chong mat khi dang tap");

        org.junit.jupiter.api.Assertions.assertNotNull(found);
        assertEquals(2, found.length);
        assertEquals("neuro", found[0]);
    }
}
