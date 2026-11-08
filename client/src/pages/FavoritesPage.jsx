import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FAVORITE_ITEM_TYPES } from "../api/favorites";
import FavoriteButton from "../components/favorites/FavoriteButton";
import { useFavorites } from "../context/FavoritesContext";
import { getLevelBadgeStyle } from "../utils/levelBadge";
import { getLevelLabel } from "../utils/levelLabel";
import { startLibraryExercise } from "../utils/libraryWorkout";

/**
 * Bốn nhóm nội dung yêu thích — tách rõ nội dung của hệ thống và của Member.
 */
const TABS = [
  {
    key: "systemExercises",
    itemType: FAVORITE_ITEM_TYPES.SYSTEM_EXERCISE,
    labelKey: "member.favorites.systemExercises",
    kind: "exercise",
  },
  {
    key: "memberExercises",
    itemType: FAVORITE_ITEM_TYPES.MEMBER_EXERCISE,
    labelKey: "member.favorites.memberExercises",
    kind: "exercise",
  },
  {
    key: "systemWorkouts",
    itemType: FAVORITE_ITEM_TYPES.SYSTEM_WORKOUT,
    labelKey: "member.favorites.systemWorkouts",
    kind: "workout",
  },
  {
    key: "memberWorkouts",
    itemType: FAVORITE_ITEM_TYPES.MEMBER_WORKOUT,
    labelKey: "member.favorites.memberWorkouts",
    kind: "workout",
  },
];

function StarBadgeIcon({ className = "h-6 w-6" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function DumbbellIcon({ className = "h-6 w-6" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 7v10M18 7v10M3 10v4M21 10v4M3 12h18" />
    </svg>
  );
}

/**
 * Màn "Favorites" của Member.
 *
 * Gom lại mọi bài tập / workout đã đánh dấu sao trong thư viện, tách rõ:
 *  - Exercise của hệ thống  |  Exercise do Member cung cấp
 *  - Workout của hệ thống   |  Workout do Member cung cấp
 * Từ đây member có thể mở lại buổi tập ngay.
 */
export default function FavoritesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { groups, loading, error } = useFavorites();
  const [activeTab, setActiveTab] = useState("systemExercises");
  const [startError, setStartError] = useState("");

  const tabs = useMemo(
    () => TABS.map((tab) => ({ ...tab, items: groups[tab.key] || [] })),
    [groups]
  );

  const currentTab = tabs.find((tab) => tab.key === activeTab) || tabs[0];
  const totalCount = tabs.reduce((sum, tab) => sum + tab.items.length, 0);

  /** Mở lại buổi tập cho một bài tập đã yêu thích. */
  const startExercise = (item) => {
    setStartError("");
    const started = startLibraryExercise(navigate, {
      code: item.code,
      category: item.category,
      defaultSets: item.defaultSets,
      defaultReps: item.defaultReps,
      defaultDuration: item.defaultDuration,
    });
    if (!started) {
      setStartError(t("member.favorites.couldNotStart"));
    }
  };

  /**
   * Mở lại buổi tập cho một workout đã yêu thích.
   * Workout cần danh sách bài nên ta mở màn chi tiết trước — nơi có nút "Start workout"
   * dùng chung luồng với thư viện.
   */
  const openWorkout = (item) => {
    setStartError("");
    const isSystem = item.itemType === FAVORITE_ITEM_TYPES.SYSTEM_WORKOUT;
    navigate(
      isSystem
        ? `/library/workouts/system/${item.itemId}`
        : `/library/custom/${item.itemId}`,
      { state: { backPath: "/library/favorites" } }
    );
  };

  const openExerciseDetail = (item) => {
    setStartError("");
    const isSystem = item.itemType === FAVORITE_ITEM_TYPES.SYSTEM_EXERCISE;
    navigate(
      isSystem
        ? `/library/exercises/system/${item.itemId}`
        : `/library/member/${item.itemId}`,
      { state: { backPath: "/library/favorites" } }
    );
  };

  return (
    <div className="favorites-page w-full max-w-6xl mx-auto text-white pb-16">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
              <StarBadgeIcon className="h-5 w-5" />
            </span>
            {t("member.favorites.title")}
          </h1>
          <p className="mt-1 text-xs text-slate-400">{t("member.favorites.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/library")}
          className="rounded-xl border border-[#3b2d68] bg-[#1a1436] px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-purple-500/50 hover:text-white"
        >
          {t("member.favorites.browseLibrary")}
        </button>
      </header>

      {error ? (
        <div role="alert" className="mb-5 rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {startError ? (
        <div role="alert" className="mb-5 rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-200">
          {startError}
        </div>
      ) : null}

      {/* ── TABS: phân biệt rõ System / Member provided ─────────── */}
      <div
        className="mb-5 flex flex-wrap items-center gap-2 border-b border-[#2a224b]"
        role="tablist"
        aria-label={t("member.favorites.groupsAria")}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-t-lg border-b-2 px-3.5 py-3 text-sm transition-colors ${
              activeTab === tab.key
                ? "border-[#8b6cff] bg-[#17112f] font-semibold text-white"
                : "border-transparent font-medium text-slate-400 hover:bg-[#120d29] hover:text-slate-200"
            }`}
          >
            <span>{t(tab.labelKey)}</span>
            <span
              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none ${
                activeTab === tab.key
                  ? "bg-purple-500/25 text-purple-200"
                  : "bg-[#22184c] text-slate-400"
              }`}
            >
              {tab.items.length}
            </span>
          </button>
        ))}
      </div>

      {/* ── DANH SÁCH ───────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-2xl border border-[#22184c] bg-[#130d2e]"
            />
          ))}
        </div>
      ) : currentTab.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#231b46] bg-[#120d29] px-6 py-14 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center text-amber-300/70">
            <StarBadgeIcon className="h-7 w-7" />
          </div>
          <h3 className="mb-1 text-base font-bold text-white">
            {t("member.favorites.emptyTitle")}
          </h3>
          <p className="text-xs text-slate-400">{t("member.favorites.emptyDesc")}</p>
          <button
            type="button"
            onClick={() => navigate("/library")}
            className="mt-4 rounded-xl bg-[#643bf6] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#7554ff]"
          >
            {t("member.favorites.browseLibrary")}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {currentTab.items.map((item) => (
            <article
              key={`${item.itemType}-${item.itemId}`}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#33285f] bg-[#15102e] p-5 transition-all hover:border-[#6046a6]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#5b4696] bg-[#2a2057]">
                <DumbbellIcon className="h-7 w-7 text-[#c4b5fd]" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold tracking-tight text-white">
                    {item.title}
                  </h3>
                  {item.level ? (
                    <span
                      className={`rounded-full px-3 py-0.5 text-[11px] font-semibold capitalize ${getLevelBadgeStyle(item.level)}`}
                    >
                      {getLevelLabel(item.level)}
                    </span>
                  ) : null}
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      item.source === "SYSTEM"
                        ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                        : "border-violet-500/40 bg-violet-500/10 text-violet-300"
                    }`}
                  >
                    {item.source === "SYSTEM"
                      ? t("member.favorites.systemBadge")
                      : t("member.favorites.memberBadge")}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-400">
                  {[
                    item.meta,
                    currentTab.kind === "workout"
                      ? t("member.catalog.totalExercises", { count: item.totalItems })
                      : null,
                    currentTab.kind === "workout" && item.estimatedDuration
                      ? t("member.favorites.minutes", { count: item.estimatedDuration })
                      : null,
                    item.authorName
                      ? t("member.favorites.byAuthor", { name: item.authorName })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <FavoriteButton
                  itemType={item.itemType}
                  itemId={item.itemId}
                  label={item.title}
                  size="lg"
                />
                {currentTab.kind === "exercise" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => openExerciseDetail(item)}
                      className="rounded-xl border border-[#59477f] bg-[#201a3b] px-4 py-2 text-xs font-semibold text-slate-100 transition-colors hover:border-purple-500/50"
                    >
                      {t("member.favorites.viewDetails")}
                    </button>
                    <button
                      type="button"
                      onClick={() => startExercise(item)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600/80 bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-600"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      {t("member.favorites.startTraining")}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => openWorkout(item)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600/80 bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-600"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    {t("member.favorites.openWorkout")}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {totalCount > 0 ? (
        <p className="mt-6 text-xs text-slate-500">
          {t("member.favorites.totalCount", { count: totalCount })}
        </p>
      ) : null}
    </div>
  );
}
