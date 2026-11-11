import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import ArrowForwardIosRoundedIcon from "@mui/icons-material/ArrowForwardIosRounded";
import FitnessCenterRoundedIcon from "@mui/icons-material/FitnessCenterRounded";
import AccessibilityNewRoundedIcon from "@mui/icons-material/AccessibilityNewRounded";
import DirectionsWalkRoundedIcon from "@mui/icons-material/DirectionsWalkRounded";
import AdjustRoundedIcon from "@mui/icons-material/AdjustRounded";
import SportsMartialArtsRoundedIcon from "@mui/icons-material/SportsMartialArtsRounded";
import SelfImprovementRoundedIcon from "@mui/icons-material/SelfImprovementRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import MonitorWeightRoundedIcon from "@mui/icons-material/MonitorWeightRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import workoutPlanImage from "../image/Daily_Workout_Plan.png";
import api from "../api/client";
import { FAVORITE_ITEM_TYPES } from "../api/favorites";
import { useFavorites } from "../context/FavoritesContext";
import OnboardingRedirect from "../components/survey/OnboardingRedirect";
import { surveyApi, isMemberSession } from "../api/survey";
import "./MainDashboard.css";

const MUSCLE_ICONS = {
  fitness: FitnessCenterRoundedIcon,
  accessibility: AccessibilityNewRoundedIcon,
  walk: DirectionsWalkRoundedIcon,
  adjust: AdjustRoundedIcon,
  martial: SportsMartialArtsRoundedIcon,
  self: SelfImprovementRoundedIcon,
};

/** `BEGINNER` -> `Beginner`, để chip level không hiển thị chữ IN HOA toàn bộ. */
function levelLabel(value, allLevelsLabel = "All levels") {
  if (!value) return allLevelsLabel;
  const lowered = String(value).toLowerCase();
  return lowered.charAt(0).toUpperCase() + lowered.slice(1);
}

/** Carousel ngang: cuộn mảnh theo từng bước, dùng chung cho Muscle & Skills. */
function Carousel({ children, ariaLabel }) {
  const { t } = useTranslation();
  const trackRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanScrollLeft(track.scrollLeft > 1);
    setCanScrollRight(track.scrollLeft + track.clientWidth < track.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollButtons();
    window.addEventListener("resize", updateScrollButtons);
    return () => window.removeEventListener("resize", updateScrollButtons);
  }, [updateScrollButtons]);

  const scrollByStep = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="dash-carousel">
      <button
        type="button"
        className="dash-carousel-btn"
        aria-label={t("member.dashboard.scrollLeft")}
        disabled={!canScrollLeft}
        onClick={() => scrollByStep(-1)}
      >
        <ArrowBackIosNewRoundedIcon />
      </button>

      <div
        className="dash-carousel-track"
        ref={trackRef}
        aria-label={ariaLabel}
        onScroll={updateScrollButtons}
      >
        {children}
      </div>

      <button
        type="button"
        className="dash-carousel-btn"
        aria-label={t("member.dashboard.scrollRight")}
        disabled={!canScrollRight}
        onClick={() => scrollByStep(1)}
      >
        <ArrowForwardIosRoundedIcon />
      </button>
    </div>
  );
}

export default function MainDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { items: favoriteItems } = useFavorites();
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState(() =>
    localStorage.getItem("token") ? "loading" : "guest",
  );
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardError, setDashboardError] = useState(false);

  useEffect(() => {
    api.get("/dashboard")
      .then((response) => setDashboardData(response.data))
      .catch(() => setDashboardError(true));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUser(null);
      setAuthStatus("guest");
      return;
    }

    const cached = localStorage.getItem("user");
    if (cached) {
      try {
        setUser(JSON.parse(cached));
      } catch {
        localStorage.removeItem("user");
      }
    }

    api.get("/auth/me")
      .then((res) => {
        setUser(res.data);
        setAuthStatus("authed");
      })
      .catch(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("jwt");
        localStorage.removeItem("user");
        setUser(null);
        setAuthStatus("guest");
      });
  }, []);

  const gotoLibrary = (params) => {
    navigate({ pathname: "/library/exercises", search: params });
  };

  /** Nút Start workout: member chưa từng hoàn thành survey (kể cả đã skip lúc
   * đầu) thì đưa sang Health & Progress để thực hiện survey, thay vì vào
   * thẳng lịch tập khi chưa có level/kế hoạch gợi ý.
   */
  const [startingWorkout, setStartingWorkout] = useState(false);
  const handleStartWorkout = useCallback(() => {
    if (!isMemberSession() || startingWorkout) {
      if (!isMemberSession()) navigate("/schedule");
      return;
    }
    setStartingWorkout(true);
    surveyApi
      .sessions()
      .then((sessions) => {
        const done = (sessions ?? []).some((s) => s.status === "COMPLETED");
        navigate(done ? "/schedule" : "/tracking");
      })
      .catch(() => {
        // Lỗi API thì vẫn cho vào lịch tập, không chặn member.
        navigate("/schedule");
      })
      .finally(() => setStartingWorkout(false));
  }, [navigate, startingWorkout]);

  // Đếm nhanh số bài tập / workout đã đánh dấu sao cho thẻ Favorites trên dashboard.
  const favoriteCounts = useMemo(
    () => ({
      exercises: favoriteItems.filter((item) =>
        [FAVORITE_ITEM_TYPES.SYSTEM_EXERCISE, FAVORITE_ITEM_TYPES.MEMBER_EXERCISE].includes(
          item.itemType
        )
      ).length,
      workouts: favoriteItems.filter((item) =>
        [FAVORITE_ITEM_TYPES.SYSTEM_WORKOUT, FAVORITE_ITEM_TYPES.MEMBER_WORKOUT].includes(
          item.itemType
        )
      ).length,
    }),
    [favoriteItems]
  );

  return (
    <div className="dashboard">
      {user?.role === "MEMBER" && <OnboardingRedirect />}

      {/* ── Daily Workout Plan ─────────────────────────────────── */}
      <section className="dash-plan">
        <img
          className="dash-plan-image"
          src={workoutPlanImage}
          alt=""
          aria-hidden="true"
        />
        <div className="dash-plan-copy">
          <span className="dash-plan-eyebrow">{t("member.dashboard.planEyebrow")}</span>
          <h2 className="dash-plan-heading">{t("member.dashboard.planHeading")}</h2>
          <p className="dash-plan-description">
            {t("member.dashboard.planDescription")}
          </p>
        </div>

        {authStatus === "authed" && (
          <button
            type="button"
            className="dash-btn dash-btn-primary"
            onClick={handleStartWorkout}
            disabled={startingWorkout}
          >
            {t("member.dashboard.startWorkout")}
            <PlayArrowRoundedIcon />
          </button>
        )}
        {authStatus === "guest" && (
          <button
            type="button"
            className="dash-btn dash-btn-primary"
            onClick={() => navigate("/login")}
          >
            {t("member.dashboard.logIn")}
          </button>
        )}
      </section>

      {/* ── Explore ────────────────────────────────────────────── */}
      <section className="dash-explore">
        <header className="dash-section-head">
          <h2 className="dash-section-title">{t("member.dashboard.exploreTitle")}</h2>
          <p className="dash-section-subtitle">
            {t("member.dashboard.exploreSubtitle")}
          </p>
        </header>

        {/* Muscle focus */}
        <h3 className="dash-subsection-title">{t("member.dashboard.muscleFocus")}</h3>
        <Carousel ariaLabel={t("member.dashboard.muscleFocus")}>
          {(dashboardData?.muscleGroups ?? []).map((group) => {
            const Icon = MUSCLE_ICONS[group.icon] ?? FitnessCenterRoundedIcon;
            return (
              <button
                type="button"
                key={group.id}
                className={`dash-muscle-card tone-${group.tone}`}
                onClick={() =>
                  gotoLibrary(
                    `?type=health&muscle=${encodeURIComponent(group.name)}`,
                  )
                }
              >
                <span className="dash-muscle-icon">
                  <Icon />
                </span>
                <span className="dash-muscle-name">{group.name}</span>
                <span className="dash-muscle-count">
                  {t("member.dashboard.exerciseCount", { count: group.count })}
                </span>
              </button>
            );
          })}
        </Carousel>

        {/* Skills */}
        <h3 className="dash-subsection-title">{t("member.dashboard.skills")}</h3>
        <Carousel ariaLabel={t("member.dashboard.skills")}>
          {(dashboardData?.skills ?? []).map((skill) => (
            <button
              type="button"
              key={skill.id}
              className={`dash-skill-card tone-${skill.tone}`}
              onClick={() =>
                navigate(`/library/exercises/system/${skill.exerciseId}`)
              }
            >
              <span className="dash-skill-head">
                <span className="dash-skill-icon">
                  <EmojiEventsRoundedIcon />
                </span>
              </span>
              <span className="dash-skill-name">{skill.name}</span>
              <span className="dash-skill-meta">
                <span className="dash-skill-steps">
                  {skill.steps > 0
                    ? t("member.dashboard.steps", { count: skill.steps })
                    : t("member.dashboard.viewTechnique")}
                </span>
                <span className="dash-skill-level">
                  {levelLabel(skill.level, t("member.dashboard.allLevels"))}
                </span>
              </span>
            </button>
          ))}
        </Carousel>
      </section>

      {/* ── Progress & Community ───────────────────────────────── */}
      <section className="dash-bottom-grid">
        <article className="dash-panel dash-health">
          <header className="dash-panel-head">
            <span className="dash-panel-icon">
              <MonitorWeightRoundedIcon />
            </span>
            <h3 className="dash-panel-title">{t("member.dashboard.healthProgress")}</h3>
          </header>

          {authStatus === "authed" ? (
            <>
              {dashboardData?.healthMetrics &&
              (dashboardData.healthMetrics.weight != null
                || dashboardData.healthMetrics.bmi != null
                || dashboardData.healthMetrics.weeklyGoal != null) ? (
                <>
                  <ul className="dash-metric-list">
                    {dashboardData.healthMetrics.weight != null && (
                      <li>
                        <span className="dash-metric-label">{t("member.dashboard.weight")}</span>
                        <span className="dash-metric-value">{dashboardData.healthMetrics.weight} kg</span>
                      </li>
                    )}
                    {dashboardData.healthMetrics.bmi != null && (
                      <li>
                        <span className="dash-metric-label">{t("member.dashboard.bmi")}</span>
                        <span className="dash-metric-value">
                          {dashboardData.healthMetrics.bmi} ({dashboardData.healthMetrics.bmiLabel})
                        </span>
                      </li>
                    )}
                    {dashboardData.healthMetrics.weeklyGoal != null && (
                      <li>
                        <span className="dash-metric-label">{t("member.dashboard.weeklyGoal")}</span>
                        <span className="dash-metric-value">
                          {t("member.dashboard.weeklyGoalReached", {
                            percent: dashboardData.healthMetrics.weeklyGoal,
                          })}
                        </span>
                      </li>
                    )}
                  </ul>
                  {dashboardData.healthMetrics.weeklyGoal != null && (
                    <div className="dash-progress">
                      <div className="dash-progress-bar">
                        <div
                          className="dash-progress-fill"
                          style={{ width: `${dashboardData.healthMetrics.weeklyGoal}%` }}
                        />
                      </div>
                      <span className="dash-progress-value">{dashboardData.healthMetrics.weeklyGoal}%</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="dash-auth-prompt">
                  {dashboardError
                    ? t("member.dashboard.healthUnavailable")
                    : dashboardData
                      ? t("member.dashboard.healthEmpty")
                      : t("member.dashboard.healthLoading")}
                </p>
              )}
              <div className="dash-panel-actions">
                <button
                  type="button"
                  className="dash-btn dash-btn-ghost"
                  onClick={() => navigate("/tracking")}
                >
                  <InsightsRoundedIcon />
                  {t("member.dashboard.viewDetails")}
                </button>
              </div>
            </>
          ) : (
            <div className="dash-auth-gate">
              <p className="dash-auth-prompt">
                {authStatus === "loading"
                  ? t("member.dashboard.healthAuthLoading")
                  : t("member.dashboard.healthAuthPrompt")}
              </p>
              {authStatus === "guest" && (
                <button
                  type="button"
                  className="dash-btn dash-btn-ghost"
                  onClick={() => navigate("/login")}
                >
                  {t("member.dashboard.logIn")}
                </button>
              )}
            </div>
          )}
        </article>

        <article className="dash-panel dash-community">
          <header className="dash-panel-head">
            <span className="dash-panel-icon">
              <GroupsRoundedIcon />
            </span>
            <h3 className="dash-panel-title">{t("member.dashboard.community")}</h3>
          </header>

          <p className="dash-community-text">
            {t("member.dashboard.communityText")}
          </p>

          {dashboardData?.community && (
            <div className="dash-community-stats">
              <div>
                <span className="dash-community-number">
                  {Number(dashboardData.community.exercises || 0).toLocaleString()}
                </span>
                <span className="dash-community-label">{t("member.dashboard.exercises")}</span>
              </div>
              <div>
                <span className="dash-community-number">
                  {dashboardData.community.workouts.toLocaleString()}
                </span>
                <span className="dash-community-label">{t("member.dashboard.workouts")}</span>
              </div>
              <div>
                <span className="dash-community-number">
                  {dashboardData.community.athletes.toLocaleString()}
                </span>
                <span className="dash-community-label">{t("member.dashboard.athletes")}</span>
              </div>
            </div>
          )}

          <div className="dash-panel-actions">
            <button
              type="button"
              className="dash-btn dash-btn-ghost"
              onClick={() => navigate("/library?tab=community")}
            >
              {t("member.dashboard.explore")}
            </button>
          </div>
        </article>

        {/* ── Favorites: mục đánh dấu sao của member ─────────────── */}
        <article className="dash-panel dash-favorites">
          <header className="dash-panel-head">
            <span className="dash-panel-icon dash-panel-icon-star">
              <StarRoundedIcon />
            </span>
            <h3 className="dash-panel-title">{t("member.dashboard.favorites")}</h3>
          </header>

          <p className="dash-community-text">
            {t("member.dashboard.favoritesText")}
          </p>

          {authStatus === "authed" ? (
            <>
              <div className="dash-community-stats">
                <div>
                  <span className="dash-community-number">
                    {favoriteCounts.exercises.toLocaleString()}
                  </span>
                  <span className="dash-community-label">{t("member.dashboard.exercises")}</span>
                </div>
                <div>
                  <span className="dash-community-number">
                    {favoriteCounts.workouts.toLocaleString()}
                  </span>
                  <span className="dash-community-label">{t("member.dashboard.workouts")}</span>
                </div>
              </div>
              <div className="dash-panel-actions">
                <button
                  type="button"
                  className="dash-btn dash-btn-ghost"
                  onClick={() => navigate("/library/favorites")}
                >
                  <StarRoundedIcon />
                  {t("member.dashboard.openFavorites")}
                </button>
              </div>
            </>
          ) : (
            <div className="dash-auth-gate">
              <p className="dash-auth-prompt">
                {authStatus === "loading"
                  ? t("member.dashboard.healthAuthLoading")
                  : t("member.dashboard.favoritesAuthPrompt")}
              </p>
              {authStatus === "guest" && (
                <button
                  type="button"
                  className="dash-btn dash-btn-ghost"
                  onClick={() => navigate("/login")}
                >
                  {t("member.dashboard.logIn")}
                </button>
              )}
            </div>
          )}
        </article>
      </section>

      <p className="dash-greeting">
        {user?.fullName
          ? t("member.dashboard.welcomeBack", { name: user.fullName })
          : t("member.dashboard.welcomeBackShort")}
      </p>
    </div>
  );
}
