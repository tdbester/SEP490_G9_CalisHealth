// Tính và phân loại BMI theo chuẩn WHO (người trưởng thành).

export const BMI_HEALTHY_MIN = 18.5;
export const BMI_HEALTHY_MAX = 24.9;

export function calculateBmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function classifyBmi(bmi) {
  if (bmi < BMI_HEALTHY_MIN) return { label: "Underweight", tone: "warning" };
  if (bmi < 25) return { label: "Healthy", tone: "healthy" };
  if (bmi < 30) return { label: "Overweight", tone: "warning" };
  return { label: "Obese", tone: "danger" };
}
