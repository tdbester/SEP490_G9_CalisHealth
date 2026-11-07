import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { surveyApi } from "../../api/survey";
import { ArrowRight } from "./SurveyIcons";
import { useTranslation } from "react-i18next";
import "./SurveyReminder.css";

/**
 * Nút làm survey onboarding trên trang Tracking cho member chưa hoàn thành (đã bỏ qua lần đầu đăng nhập,
 * hoặc làm dở): làm để được xếp level và nhận kế hoạch gợi ý. Ẩn khi đã hoàn thành hoặc không gọi được API.
 */
export default function SurveyReminder() {
  const navigate = useNavigate();
  const { t } = useTranslation("member");
  const [status, setStatus] = useState(null); // null | "NONE" | "IN_PROGRESS" | "SKIPPED"

  useEffect(() => {
    let active = true;
    surveyApi
      .sessions()
      .then((sessions) => {
        if (!active || sessions.some((s) => s.status === "COMPLETED")) return;
        setStatus(sessions[0]?.status ?? "NONE");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!status) return null;

  return (
    <section className="survey-reminder">
      <div>
        <h2 className="survey-reminder-title">{t("survey.reminder.title")}</h2>
        <p className="survey-reminder-text">{t("survey.reminder.text")}</p>
      </div>
      <button type="button" className="survey-reminder-btn" onClick={() => navigate("/survey")}>
        {status === "IN_PROGRESS" ? t("survey.reminder.continue") : t("survey.reminder.take")}
        <ArrowRight />
      </button>
    </section>
  );
}
