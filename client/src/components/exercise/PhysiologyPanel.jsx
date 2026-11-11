import { useTranslation } from "react-i18next";

/**
 * Panel sinh lý vận động (V76) gắn vào trang chi tiết bài tập có sẵn.
 * Dữ liệu lấy từ GET /api/v1/library/exercises/{id} -> field `physiology`.
 * Không có hồ sơ -> ẩn panel, không vỡ trang cũ.
 */
function Dots({ value = 0, max = 5 }) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${i < (value || 0) ? "bg-[#a855f7]" : "bg-[#2a2055]"}`}
        />
      ))}
    </span>
  );
}

function RiskBadge({ level }) {
  const v = String(level || "").toUpperCase();
  const color =
    v === "HIGH" || v === "SPIKE_RISK"
      ? "border-red-700/70 bg-red-950/50 text-red-200"
      : v === "MODERATE" || v === "RAISES"
        ? "border-amber-700/70 bg-amber-950/40 text-amber-200"
        : v === "LOW" || v === "NEUTRAL" || v === "LOWERS"
          ? "border-emerald-700/70 bg-emerald-950/40 text-emerald-200"
          : "border-slate-700 bg-slate-800/50 text-slate-300";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${color}`}>
      {level || "—"}
    </span>
  );
}

export default function PhysiologyPanel({ physiology }) {
  const { t, i18n } = useTranslation();
  if (!physiology) return null;

  const p = physiology;
  const rawContra = Array.isArray(p.contraindications) ? p.contraindications : [];
  // Tương thích ngược: dữ liệu cũ lưu mã code (hypertension, knee_pain...),
  // dữ liệu mới là tên bệnh do CM tự nhập. Mã cũ được dịch sang nhãn hiển thị.
  const contra = rawContra.map((entry) => {
    const text = String(entry ?? "").trim();
    if (!text) return "";
    const key = text.toLowerCase();
    const labelKeyMap = {
      hypertension: "contentManager.form.physiology.contraindicationsList.hypertension",
      glaucoma: "contentManager.form.physiology.contraindicationsList.glaucoma",
      asthma: "contentManager.form.physiology.contraindicationsList.asthma",
      pregnancy: "contentManager.form.physiology.contraindicationsList.pregnancy",
      osteoporosis: "contentManager.form.physiology.contraindicationsList.osteoporosis",
      cardiac_condition: "contentManager.form.physiology.contraindicationsList.cardiac_condition",
      wrist_pain: "contentManager.form.physiology.contraindicationsList.wrist_pain",
      elbow_pain: "contentManager.form.physiology.contraindicationsList.elbow_pain",
      shoulder_pain: "contentManager.form.physiology.contraindicationsList.shoulder_pain",
      shoulder_impingement: "contentManager.form.physiology.contraindicationsList.shoulder_impingement",
      knee_pain: "contentManager.form.physiology.contraindicationsList.knee_pain",
      lower_back_pain: "contentManager.form.physiology.contraindicationsList.lower_back_pain",
    };
    if (labelKeyMap[key]) return t(labelKeyMap[key], text);
    return text;
  }).filter(Boolean);
  const isVi = String(i18n.language || "vi").toLowerCase().startsWith("vi");
  const tr = (vi, en) => (isVi ? vi : en);

  const contractionLabel =
    p.contractionType === "ISOMETRIC"
      ? tr("Co tĩnh đẳng trường (giữ, không đổi chiều dài cơ)", "Isometric (hold, constant muscle length)")
      : p.contractionType === "STATIC"
        ? tr("Giữ tĩnh (không nhúc nhích)", "Static hold (motionless)")
        : tr("Co giãn liên tục", "Dynamic (continuous contraction)");

  const bpLabel =
    p.bloodPressureEffect === "SPIKE_RISK"
      ? tr("Nguy cơ tăng vọt", "Spike risk")
      : p.bloodPressureEffect === "RAISES"
        ? tr("Tăng trong lúc giữ", "Rises during hold")
        : p.bloodPressureEffect === "LOWERS"
          ? tr("Hạ nhẹ huyết áp tĩnh", "Slightly lowers resting BP")
          : tr("Trung tính", "Neutral");

  const jointLabel = {
    WRIST: tr("Cổ tay", "Wrist"),
    ELBOW: tr("Khuỷu tay", "Elbow"),
    SHOULDER: tr("Vai", "Shoulder"),
    SPINE: tr("Cột sống / core", "Spine / core"),
    HIP: tr("Hông", "Hip"),
    KNEE: tr("Gối", "Knee"),
    ANKLE: tr("Cổ chân", "Ankle"),
  }[String(p.primaryJoint || "").toUpperCase()] || p.primaryJoint;

  return (
    <section className="rounded-2xl border border-[#382b68] bg-[#171133] p-5 mt-4 shadow-xl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-bold text-[#c4b5fd]">
          {t("member.exerciseDetail.physiology.title", "Sinh lý vận động")}
        </h2>
        <span className="rounded-full border border-violet-700/70 bg-violet-950/50 px-2.5 py-0.5 text-[10px] font-medium text-violet-200">
          {t("member.exerciseDetail.physiology.estimated", "Ước tính — không phải số đo thiết bị")}
        </span>
      </div>

      {p.physiologyNote && (
        <p className="mt-3 text-xs text-slate-300 leading-relaxed">{p.physiologyNote}</p>
      )}

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl border border-[#2d2254] bg-[#100b26] p-3">
          <div className="text-[11px] text-slate-400">{t("member.exerciseDetail.physiology.contraction", "Kiểu co cơ")}</div>
          <div className="mt-1 font-semibold text-white">{contractionLabel}</div>
          <div className="mt-2 text-[11px] text-slate-400">{t("member.exerciseDetail.physiology.lever", "Đòn cân bằng")}</div>
          <div className="mt-1 flex items-center gap-2">
            <Dots value={p.leverGrade} />
            <span className="font-semibold text-white">{p.leverGrade ?? "—"}/5</span>
          </div>
        </div>

        <div className="rounded-xl border border-[#2d2254] bg-[#100b26] p-3">
          <div className="text-[11px] text-slate-400">{t("member.exerciseDetail.physiology.cardio", "Tải tim mạch")}</div>
          <div className="mt-1 flex items-center gap-2">
            <Dots value={p.cardiovascularLoad} />
            <span className="font-semibold text-white">{p.cardiovascularLoad ?? "—"}/5</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">{t("member.exerciseDetail.physiology.hrZone", "Vùng nhịp tim ước tính (%HRmax)")}</div>
          <div className="mt-1 font-semibold text-white">
            {p.hrZoneLow ?? "—"}–{p.hrZoneHigh ?? "—"}%
          </div>
        </div>

        <div className="rounded-xl border border-[#2d2254] bg-[#100b26] p-3">
          <div className="text-[11px] text-slate-400">{t("member.exerciseDetail.physiology.bp", "Huyết áp")}</div>
          <div className="mt-1 flex items-center gap-2">
            <RiskBadge level={bpLabel} />
          </div>
          <div className="mt-2 text-[11px] text-slate-400">{t("member.exerciseDetail.physiology.valsalva", "Nguy cơ nín thở (Valsalva)")}</div>
          <div className="mt-1"><RiskBadge level={p.valsalvaRisk} /></div>
        </div>

        <div className="rounded-xl border border-[#2d2254] bg-[#100b26] p-3">
          <div className="text-[11px] text-slate-400">{t("member.exerciseDetail.physiology.tendon", "Tải gân / khớp chịu tải")}</div>
          <div className="mt-1 flex items-center gap-2">
            <Dots value={p.tendonLoad} />
            <span className="font-semibold text-white">{p.tendonLoad ?? "—"}/5 · {jointLabel || "—"}</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">{t("member.exerciseDetail.physiology.gi", "Rủi ro tiêu hoá")}</div>
          <div className="mt-1"><RiskBadge level={p.giRisk} /></div>
        </div>
      </div>

      {p.breathingCue && (
        <div className="mt-3 rounded-xl border border-sky-900/60 bg-sky-950/20 p-3 text-xs text-sky-100">
          <span className="font-semibold">🫁 {t("member.exerciseDetail.physiology.breathing", "Nhịp thở")}: </span>
          {p.breathingCue}
        </div>
      )}

      {contra.length > 0 && (
        <div className="mt-3 rounded-xl border border-red-900/60 bg-red-950/20 p-3 text-xs">
          <span className="font-semibold text-red-200">⚠️ {t("member.exerciseDetail.physiology.caution", "Thận trọng nếu có")}: </span>
          <span className="text-slate-300">{contra.join(" · ")}</span>
        </div>
      )}
    </section>
  );
}
