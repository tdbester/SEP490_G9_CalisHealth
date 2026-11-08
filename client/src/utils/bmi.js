// Tính và phân loại BMI theo chuẩn WHO (người trưởng thành).

import i18n from "../i18n";

export const BMI_HEALTHY_MIN = 18.5;
export const BMI_HEALTHY_MAX = 24.9;

export function calculateBmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function classifyBmi(bmi) {
  const t = (key) => i18n.t(key);
  if (bmi < BMI_HEALTHY_MIN) return { label: t("member.healthTracking.bmiUnderweight"), tone: "warning" };
  if (bmi < 25) return { label: t("member.healthTracking.bmiHealthy"), tone: "healthy" };
  if (bmi < 30) return { label: t("member.healthTracking.bmiOverweight"), tone: "warning" };
  return { label: t("member.healthTracking.bmiObese"), tone: "danger" };
}
