import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FEEDBACK_CATEGORY,
  FEEDBACK_STATUS,
  getMyFeedback,
} from "../api/feedback";

/** Bộ lọc trạng thái trên màn của Member. */
const STATUS_FILTERS = [
  { key: "ALL", labelKey: "member.feedback.filterAll" },
  { key: FEEDBACK_STATUS.PENDING, labelKey: "member.feedback.statusPending" },
  { key: FEEDBACK_STATUS.IN_REVIEW, labelKey: "member.feedback.statusInReview" },
  { key: FEEDBACK_STATUS.ESCALATED, labelKey: "member.feedback.statusEscalated" },
  { key: FEEDBACK_STATUS.RESOLVED, labelKey: "member.feedback.statusResolved" },
  { key: FEEDBACK_STATUS.REJECTED, labelKey: "member.feedback.statusRejected" },
];

/** Nhãn hiển thị cho từng trạng thái. */
const STATUS_LABEL = {
  [FEEDBACK_STATUS.PENDING]: "member.feedback.statusPending",
  [FEEDBACK_STATUS.IN_REVIEW]: "member.feedback.statusInReview",
  [FEEDBACK_STATUS.ESCALATED]: "member.feedback.statusEscalated",
  [FEEDBACK_STATUS.RESOLVED]: "member.feedback.statusResolved",
  [FEEDBACK_STATUS.REJECTED]: "member.feedback.statusRejected",
};

/** Nhãn hiển thị cho từng nhóm nội dung. */
const CATEGORY_LABEL = {
  [FEEDBACK_CATEGORY.GENERAL]: "member.feedback.categoryGeneral",
  [FEEDBACK_CATEGORY.EXERCISE_CONTENT]: "member.feedback.categoryExercise",
  [FEEDBACK_CATEGORY.WORKOUT_CONTENT]: "member.feedback.categoryWorkout",
  [FEEDBACK_CATEGORY.TECHNICAL]: "member.feedback.categoryTechnical",
  [FEEDBACK_CATEGORY.OTHER]: "member.feedback.categoryOther",
};

/** Màu viền + nền cho từng trạng thái. */
const STATUS_STYLE = {
  [FEEDBACK_STATUS.PENDING]:
    "border-amber-500/40 bg-amber-500/10 text-amber-300",
  [FEEDBACK_STATUS.IN_REVIEW]:
    "border-sky-500/40 bg-sky-500/10 text-sky-300",
  [FEEDBACK_STATUS.ESCALATED]:
    "border-violet-500/40 bg-violet-500/10 text-violet-300",
  [FEEDBACK_STATUS.RESOLVED]:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  [FEEDBACK_STATUS.REJECTED]:
    "border-rose-500/40 bg-rose-500/10 text-rose-300",
};

function ChatIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  );
}

function PlusIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function formatDate(value, locale = "vi-VN") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Màn danh sách "Góp ý & Khiếu nại" của Member.
 *
 * Member xem lại các phiếu đã gửi và theo dõi trạng thái xử lý. Việc tạo phiếu
 * mới nằm ở màn riêng (/library/feedback/new) để màn này tập trung vào việc
 * theo dõi.
 */
export default function MemberFeedbackListPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");

  const loadFeedback = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await getMyFeedback();
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Could not load member feedback:", error);
      setLoadError(t("member.feedback.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = `${t("member.feedback.pageTitle")} | CalisHealth`;
  }, [t]);

  const visibleItems = useMemo(
    () =>
      activeFilter === "ALL"
        ? items
        : items.filter((item) => item.status === activeFilter),
    [items, activeFilter]
  );

  return (
    <div className="mx-auto max-w-4xl pb-16 text-white">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                <ChatIcon className="h-5 w-5" />
              </span>
              {t("member.feedback.title")}
            </h1>
            <p className="mt-1 text-xs text-slate-400">{t("member.feedback.subtitle")}</p>
          </div>

          <RouterLink
            to="/library/feedback/new"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#643bf6] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#7554ff]"
          >
            <PlusIcon />
            {t("member.feedback.createNew")}
          </RouterLink>
        </div>
      </header>

      {/* ── LỊCH SỬ ĐƠN ────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-base font-semibold">{t("member.feedback.historyTitle")}</h2>

        <div
          className="mb-4 flex flex-wrap items-center gap-2 border-b border-[#2a224b]"
          role="tablist"
          aria-label={t("member.feedback.filtersAria")}
        >
          {STATUS_FILTERS.map((filter) => {
            const count =
              filter.key === "ALL"
                ? items.length
                : items.filter((item) => item.status === filter.key).length;
            return (
              <button
                key={filter.key}
                type="button"
                role="tab"
                aria-selected={activeFilter === filter.key}
                onClick={() => setActiveFilter(filter.key)}
                className={`flex items-center gap-2 rounded-t-lg border-b-2 px-3.5 py-2.5 text-xs transition-colors ${
                  activeFilter === filter.key
                    ? "border-[#8b6cff] bg-[#17112f] font-semibold text-white"
                    : "border-transparent font-medium text-slate-400 hover:bg-[#120d29] hover:text-slate-200"
                }`}
              >
                <span>{t(filter.labelKey)}</span>
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none ${
                    activeFilter === filter.key
                      ? "bg-purple-500/25 text-purple-200"
                      : "bg-[#22184c] text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {loadError ? (
          <div role="alert" className="rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200">
            {loadError}
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-2xl border border-[#22184c] bg-[#130d2e]"
              />
            ))}
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#231b46] bg-[#120d29] px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center text-violet-300/70">
              <ChatIcon className="h-7 w-7" />
            </div>
            <h3 className="mb-1 text-base font-bold text-white">
              {t("member.feedback.emptyTitle")}
            </h3>
            <p className="text-xs text-slate-400">{t("member.feedback.emptyDesc")}</p>
            <RouterLink
              to="/library/feedback/new"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#643bf6] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#7554ff]"
            >
              <PlusIcon />
              {t("member.feedback.createNew")}
            </RouterLink>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleItems.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-[#33285f] bg-[#15102e] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 text-xs text-slate-400">
                      {t(CATEGORY_LABEL[item.category] || "member.feedback.categoryOther")}
                      {" • "}
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold ${
                      STATUS_STYLE[item.status] || STATUS_STYLE[FEEDBACK_STATUS.PENDING]
                    }`}
                  >
                    {t(STATUS_LABEL[item.status] || "member.feedback.statusPending")}
                  </span>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                  {item.content}
                </p>

                {item.resolutionNote ? (
                  <div className="mt-4 rounded-xl border border-[#3b2d68] bg-[#1a1436] p-4">
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-violet-300">
                      {t("member.feedback.resolutionTitle")}
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-slate-200">
                      {item.resolutionNote}
                    </p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
