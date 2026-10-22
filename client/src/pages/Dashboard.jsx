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
import ShowChartRoundedIcon from "@mui/icons-material/ShowChartRounded";
import api from "../api/client";
import {
  TODAY_PLAN,
  MUSCLE_GROUPS,
  SKILLS,
  HEALTH_METRICS,
  COMMUNITY_STATS,
} from "../data/dashboard";
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

function WorkoutIllustration() {
  return (
    <div className="dash-plan-illustration" aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none">
        <path d="M15 47h34M22 43l7-13 9 5 8-11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="39" cy="18" r="4" fill="currentColor" />
        <path d="m36 22-8 9-10-3m11 2-1 12m10-10 8 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m13 21 8 1 3 7" stroke="#F472B6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const cached = localStorage.getItem("token")
      ? localStorage.getItem("user")
      : null;
    if (cached) setUser(JSON.parse(cached));

    api.get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => setUser(null));
  }, []);

  const gotoLibrary = (params) => {
    navigate({ pathname: "/library", search: params });
  };

  return (
    <div className="dashboard">
      {/* ── Daily Workout Plan ─────────────────────────────────── */}
      {user && (
        <section className="dash-plan">
          <WorkoutIllustration />
          <div className="dash-plan-info">
            <span className="dash-plan-label">Daily Workout Plan</span>
            <h2 className="dash-plan-title">
              {TODAY_PLAN.day} · {TODAY_PLAN.focus}
            </h2>
            <p className="dash-plan-meta">
              <span className="dash-plan-duration">{TODAY_PLAN.duration}</span>
              <span className="dash-plan-sep">•</span>
              <span>{TODAY_PLAN.status}</span>
            </p>

            <ul className="dash-plan-exercises">
              {TODAY_PLAN.exercises.map((ex) => (
                <li key={ex.name}>
                  {ex.name}
                  <span className="dash-plan-reps">
                    {ex.sets} × {ex.reps}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            className="dash-btn dash-btn-primary"
            onClick={() => navigate("/tracking")}
          >
            Start Workout
            <PlayArrowRoundedIcon />
          </button>
        </section>
      )}

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
          {MUSCLE_GROUPS.map((group) => {
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
          {SKILLS.map((skill) => (
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

          <ul className="dash-metric-list">
            <li>
              <span className="dash-metric-label">Weight</span>
              <span className="dash-metric-value">{HEALTH_METRICS.weight} kg</span>
            </li>
            <li>
              <span className="dash-metric-label">BMI</span>
              <span className="dash-metric-value">
                {HEALTH_METRICS.bmi} ({HEALTH_METRICS.bmiLabel})
              </span>
            </li>
            <li>
              <span className="dash-metric-label">Weekly goal</span>
              <span className="dash-metric-value">
                {HEALTH_METRICS.weeklyGoal}% reached
              </span>
            </li>
          </ul>

          <div className="dash-progress">
            <div className="dash-progress-bar">
              <div
                className="dash-progress-fill"
                style={{ width: `${HEALTH_METRICS.weeklyGoal}%` }}
              />
            </div>
            <span className="dash-progress-value">{HEALTH_METRICS.weeklyGoal}%</span>
          </div>

          <div className="dash-panel-actions">
            <button
              type="button"
              className="dash-btn dash-btn-ghost"
              onClick={() => navigate("/tracking")}
            >
              <InsightsRoundedIcon />
              View Details
            </button>
            <button
              type="button"
              className="dash-link"
              onClick={() => navigate("/tracking")}
            >
              <ShowChartRoundedIcon />
              View detailed body metrics chart →
            </button>
          </div>
        </article>

        <article className="dash-panel dash-community">
          <header className="dash-panel-head">
            <span className="dash-panel-icon">
              <GroupsRoundedIcon />
            </span>
            <h3 className="dash-panel-title">Community</h3>
          </header>

          <p className="dash-community-text">{COMMUNITY_STATS.headline}</p>

          <div className="dash-community-stats">
            <div>
              <span className="dash-community-number">
                {COMMUNITY_STATS.workouts.toLocaleString()}
              </span>
              <span className="dash-community-label">Workouts</span>
            </div>
            <div>
              <span className="dash-community-number">
                {COMMUNITY_STATS.athletes.toLocaleString()}
              </span>
              <span className="dash-community-label">Athletes</span>
            </div>
          </div>

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
