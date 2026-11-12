import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { aiSupportApi } from "../../api/aiSupport";

/**
 * Khối cảnh báo sinh lý (V76) cho một bài tập.
 *
 * Luật cảnh báo lấy từ `GET /api/v1/member/ai-support/alerts/{exerciseCode}` —
 * server chọn luật khớp với hồ sơ sinh lý của bài (VD: bài co tĩnh khớp luật
 * "Tích lũy bài giữ tĩnh trong một buổi").
 *
 * Bài không có hồ sơ sinh lý (bài do Member tải lên) -> không hiện khối này.
 */
export default function PhysiologyAlerts({ exerciseCode }) {
  const { t } = useTranslation(["member", "common"]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!exerciseCode) return undefined;
    let cancelled = false;
    aiSupportApi
      .getAlerts(exerciseCode)
      .then((items) => {
        if (cancelled) return;
        setAlerts(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        // Không lấy được cảnh báo -> ẩn khối, trang vẫn hoạt động bình thường.
      });
    return () => {
      cancelled = true;
    };
  }, [exerciseCode]);

  if (!alerts.length) return null;

  const severityLabel = {
    DANGER: t("member:aiSupport.physiologyAlertDanger"),
    WARN: t("member:aiSupport.physiologyAlertWarn"),
    INFO: t("member:aiSupport.physiologyAlertInfo"),
  };

  const severityClass = {
    DANGER: "border-red-800/70 bg-red-950/40 text-red-200",
    WARN: "border-amber-700/70 bg-amber-950/30 text-amber-200",
    INFO: "border-sky-800/70 bg-sky-950/30 text-sky-200",
  };

  return (
    <section className="rounded-2xl border border-[#382b68] bg-[#171133] p-5 mt-4 shadow-xl">
      <h2 className="text-sm font-bold text-[#c4b5fd]">
        {t("member:aiSupport.physiologyAlertsTitle")}
      </h2>

      <div className="mt-3 flex flex-col gap-3">
        {alerts.map((alert) => {
          const severity = String(alert.severity || "INFO").toUpperCase();
          return (
            <div
              key={alert.ruleCode}
              className={`rounded-xl border p-3 ${severityClass[severity] || severityClass.INFO}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {severityLabel[severity] || severity}
                </span>
                <span className="text-xs font-semibold text-white">{alert.title}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-200">
                {alert.messageTemplate}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
