import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { markOnboardingPrompted, needsOnboarding, onboardingPrompted } from "../../api/survey";

/**
 * Đặt trên dashboard của member: member chưa từng hoàn thành / bỏ qua survey onboarding mà vào thẳng dashboard
 * (vd token cũ còn hạn, không qua màn Login) được đưa vào survey 1 lần mỗi phiên trình duyệt.
 * Không hiển thị gì; nút làm survey sau khi bỏ qua nằm ở trang Tracking (SurveyReminder).
 */
export default function OnboardingRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    if (onboardingPrompted()) return undefined;
    let active = true;
    needsOnboarding().then((needed) => {
      if (!active || !needed) return;
      markOnboardingPrompted();
      navigate("/survey", { replace: true });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  return null;
}
