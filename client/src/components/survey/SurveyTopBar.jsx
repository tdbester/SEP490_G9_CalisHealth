import { Link as RouterLink } from "react-router-dom";
import BrandLogo from "../BrandLogo";
import LanguageSwitcher from "../LanguageSwitcher";
import "./SurveyTopBar.css";

/**
 * Thanh trên cùng của màn khảo sát: logo CalisHealth + nút đổi ngôn ngữ.
 *
 * Member trả lời khảo sát ở nhiều màn (body information, goals and motivation,
 * current training routine, level test, result) — nút đổi ngôn ngữ nằm ở đây
 * để đổi được ngay giữa lúc đang làm khảo sát, không phải quay lại sidebar.
 */
export default function SurveyTopBar({ brand = "CalisHealth" }) {
  return (
    <div className="survey-topbar">
      <RouterLink to="/" className="survey-topbar-brand">
        <BrandLogo width={12} height={18} className="survey-topbar-logo" />
        <span className="survey-topbar-name">{brand}</span>
      </RouterLink>
      <LanguageSwitcher />
    </div>
  );
}
