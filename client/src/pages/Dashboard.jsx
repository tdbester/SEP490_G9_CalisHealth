import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import workoutPlanImage from "../image/Daily_Workout_Plan.png";
import api from "../api/client";
import "./Dashboard.css";

const MUSCLE_ICONS = {
  fitness: FitnessCenterRoundedIcon,
  accessibility: AccessibilityNewRoundedIcon,
  walk: DirectionsWalkRoundedIcon,
  adjust: AdjustRoundedIcon,
  martial: SportsMartialArtsRoundedIcon,
  self: SelfImprovementRoundedIcon,
};

/** Carousel ngang: cuộn mảnh theo từng bước, dùng chung cho Muscle & Skills. */
function Carousel({ children, ariaLabel }) {
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
        aria-label="Scroll left"
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
        aria-label="Scroll right"
        disabled={!canScrollRight}
        onClick={() => scrollByStep(1)}
      >
        <ArrowForwardIosRoundedIcon />
      </button>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
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
    if (!token) return;

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
        localStorage.removeItem("user");
        setUser(null);
        setAuthStatus("guest");
      });
  }, []);

  const gotoLibrary = (params) => {
    navigate({ pathname: "/library", search: params });
  };

  return (
    <div className="dashboard">
      {/* ── Daily Workout Plan ─────────────────────────────────── */}
      <section className="dash-plan">
        <img
          className="dash-plan-image"
          src={workoutPlanImage}
          alt=""
          aria-hidden="true"
        />
        <div className="dash-plan-copy">
          <span className="dash-plan-eyebrow">DAILY WORKOUT PLAN</span>
          <h2 className="dash-plan-heading">Your training, planned for today</h2>
          <p className="dash-plan-description">
            Build strength with a focused calisthenics routine.
          </p>
        </div>

        {authStatus === "authed" && (
          <button
            type="button"
            className="dash-btn dash-btn-primary"
            onClick={() => navigate("/tracking")}
          >
            Start Workout
            <PlayArrowRoundedIcon />
          </button>
        )}
        {authStatus === "guest" && (
          <button
            type="button"
            className="dash-btn dash-btn-primary"
            onClick={() => navigate("/login")}
          >
            Log in
          </button>
        )}
      </section>

      {/* ── Explore ────────────────────────────────────────────── */}
      <section className="dash-explore">
        <header className="dash-section-head">
          <h2 className="dash-section-title">Explore</h2>
          <p className="dash-section-subtitle">
            Pick a muscle group or skill to start training.
          </p>
        </header>

        {/* Muscle focus */}
        <h3 className="dash-subsection-title">Muscle Focus</h3>
        <Carousel ariaLabel="Muscle groups">
          {(dashboardData?.muscleGroups ?? []).map((group) => {
            const Icon = MUSCLE_ICONS[group.icon] ?? FitnessCenterRoundedIcon;
            return (
              <button
                type="button"
                key={group.id}
                className={`dash-muscle-card tone-${group.tone}`}
                onClick={() => gotoLibrary(`?muscle=${group.id}`)}
              >
                <span className="dash-muscle-icon">
                  <Icon />
                </span>
                <span className="dash-muscle-name">{group.name}</span>
                <span className="dash-muscle-count">{group.count} exercises</span>
              </button>
            );
          })}
        </Carousel>

        {/* Skills */}
        <h3 className="dash-subsection-title">Skills</h3>
        <Carousel ariaLabel="Calisthenics skills">
          {(dashboardData?.skills ?? []).map((skill) => (
            <button
              type="button"
              key={skill.id}
              className={`dash-skill-card tone-${skill.tone}`}
              onClick={() => gotoLibrary(`?skill=${skill.id}`)}
            >
              <span className="dash-skill-head">
                <span className="dash-skill-icon">
                  <EmojiEventsRoundedIcon />
                </span>
                <span className="dash-skill-level">{skill.level}</span>
              </span>
              <span className="dash-skill-name">{skill.name}</span>
              <span className="dash-skill-steps">{skill.steps} steps</span>
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
            <h3 className="dash-panel-title">Health &amp; Progress</h3>
          </header>

          {authStatus === "authed" ? (
            <>
              {dashboardData?.healthMetrics &&
                (dashboardData.healthMetrics.weight != null || dashboardData.healthMetrics.bmi != null) ? (
                <>
                  <ul className="dash-metric-list">
                    {dashboardData.healthMetrics.weight != null && (
                      <li>
                        <span className="dash-metric-label">Weight</span>
                        <span className="dash-metric-value">{dashboardData.healthMetrics.weight} kg</span>
                      </li>
                    )}
                    {dashboardData.healthMetrics.bmi != null && (
                      <li>
                        <span className="dash-metric-label">BMI</span>
                        <span className="dash-metric-value">
                          {dashboardData.healthMetrics.bmi} ({dashboardData.healthMetrics.bmiLabel})
                        </span>
                      </li>
                    )}
                    {dashboardData.healthMetrics.weeklyGoal != null && (
                      <li>
                        <span className="dash-metric-label">Weekly goal</span>
                        <span className="dash-metric-value">
                          {dashboardData.healthMetrics.weeklyGoal}% reached
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
                    ? "Health measurements are currently unavailable."
                    : dashboardData
                      ? "No body measurements yet. Add your measurements to see your health progress."
                      : "Loading your health measurements..."}
                </p>
              )}
              <div className="dash-panel-actions">
                <button
                  type="button"
                  className="dash-btn dash-btn-ghost"
                  onClick={() => navigate("/tracking")}
                >
                  <InsightsRoundedIcon />
                  View Details
                </button>
              </div>
            </>
          ) : (
            <div className="dash-auth-gate">
              <p className="dash-auth-prompt">
                {authStatus === "loading"
                  ? "Loading your health and progress..."
                  : "Log in to view your health metrics and progress."}
              </p>
              {authStatus === "guest" && (
                <button
                  type="button"
                  className="dash-btn dash-btn-ghost"
                  onClick={() => navigate("/login")}
                >
                  Log in
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
            <h3 className="dash-panel-title">Community</h3>
          </header>

          <p className="dash-community-text">
            Discover exercises and workouts shared by the Calisthenics community
          </p>

          {dashboardData?.community && (
            <div className="dash-community-stats">
              <div>
                <span className="dash-community-number">
                  {Number(dashboardData.community.exercises || 0).toLocaleString()}
                </span>
                <span className="dash-community-label">Exercises</span>
              </div>
              <div>
                <span className="dash-community-number">
                  {dashboardData.community.workouts.toLocaleString()}
                </span>
                <span className="dash-community-label">Workouts</span>
              </div>
              <div>
                <span className="dash-community-number">
                  {dashboardData.community.athletes.toLocaleString()}
                </span>
                <span className="dash-community-label">Athletes</span>
              </div>
            </div>
          )}

          <div className="dash-panel-actions">
            <button
              type="button"
              className="dash-btn dash-btn-ghost"
              onClick={() => navigate("/library?tab=community")}
            >
              Explore →
            </button>
          </div>
        </article>
      </section>

      <p className="dash-greeting">
        {user?.fullName ? `Welcome back, ${user.fullName}` : "Welcome back"}
      </p>
    </div>
  );
}
