import { useEffect, useState } from "react";
import { Alert, Button, CircularProgress } from "@mui/material";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { avatarUrl, profileApi } from "../api/profile";
import "./LeaderboardPage.css";

const LEVELS = [
  { value: 1, label: "Beginner" },
  { value: 2, label: "Intermediate" },
  { value: 3, label: "Advanced" },
  { value: 4, label: "Expert" },
];

const MEDALS = ["🥇", "🥈", "🥉"];

function formatScore(score) {
  const value = Number(score);
  return Number.isFinite(value) ? value.toFixed(2) : "—";
}

function MemberAvatar({ memberName, source, className }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = (memberName || "?").charAt(0).toUpperCase();

  if (!source || imageFailed) {
    return <span className={`${className} ${className}--fallback`}>{initials}</span>;
  }

  return (
    <img
      src={avatarUrl(source)}
      alt=""
      className={className}
      onError={() => setImageFailed(true)}
    />
  );
}

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [myEntry, setMyEntry] = useState(null);
  const [totalMembers, setTotalMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Leaderboard chỉ lọc theo fitness level — không có lựa chọn "tất cả".
  // Mặc định là level của chính member đang đăng nhập.
  const [levelFilter, setLevelFilter] = useState(null);

  // Lấy level của member để đặt mặc định cho dropdown.
  useEffect(() => {
    let cancelled = false;

    profileApi.get()
      .then((profile) => {
        if (cancelled) return;
        const levelName = profile?.member?.levelName;
        const match = LEVELS.find((level) => level.label === levelName);
        if (match) setLevelFilter(match.value);
        else setLevelFilter(LEVELS[0].value);
      })
      .catch(() => {
        if (!cancelled) setLevelFilter(LEVELS[0].value);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (levelFilter == null) return undefined;
    let cancelled = false;

    async function fetchLeaderboard() {
      setLoading(true);
      try {
        const response = await client.get("/leaderboard/week/current", {
          params: { levelId: levelFilter },
        });
        if (!cancelled) {
          const nextEntries = response.data?.entries || [];
          const nextMyEntry = response.data?.myEntry || null;
          // Rank xếp theo thứ tự trong danh sách (1, 2, 3...) như cũ.
          setEntries(nextEntries.map((entry, index) => ({ ...entry, rank: index + 1 })));
          setMyEntry(nextMyEntry);
          setTotalMembers(response.data?.totalMembers ?? nextEntries.length);
          setError(null);
        }
      } catch (requestError) {
        if (!cancelled) {
          const message = requestError.response?.data?.message
            || (requestError.response
              ? `Server error: ${requestError.response.status}`
              : requestError.request
                ? "Unable to connect to the server."
                : requestError.message)
            || "Unable to load the leaderboard.";
          setError(message);
          setEntries([]);
          setMyEntry(null);
          setTotalMembers(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLeaderboard();
    return () => {
      cancelled = true;
    };
  }, [levelFilter]);

  if (loading) {
    return (
      <main className="leaderboard-page leaderboard-page--centered">
        <CircularProgress className="leaderboard-spinner" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="leaderboard-page">
        <div className="leaderboard-error">
          <Alert severity="error">{error}</Alert>
          <div className="leaderboard-error-actions">
            <Button variant="contained" onClick={() => window.location.reload()}>
              Try again
            </Button>
            <Button variant="outlined" onClick={() => navigate("/")}>
              Back to dashboard
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const podiumEntries = [entries[1], entries[0], entries[2]];
  const myEntryIsInTop50 = myEntry && entries.some((entry) => entry.memberId === myEntry.memberId);
  return (
    <main className="leaderboard-page">
      <header className="leaderboard-hero">
        <div className="leaderboard-hero-art" aria-hidden="true">
          <span className="leaderboard-hero-spark leaderboard-hero-spark--one">✦</span>
          <span className="leaderboard-hero-spark leaderboard-hero-spark--two">✧</span>
          <span className="leaderboard-hero-trophy">🏆</span>
        </div>
        <div className="leaderboard-hero-copy">
          <p className="leaderboard-eyebrow">COMMUNITY CHALLENGE</p>
          <h1>Weekly leaderboard</h1>
          <p className="leaderboard-subtitle">The top 50 members making the most progress this week.</p>
        </div>
        <div className="leaderboard-week-badge">
          <span className="leaderboard-week-dot" />
          Updated weekly
        </div>
      </header>

      {entries.length > 0 && (
        <section className="leaderboard-podium" aria-label="Top three members">
          {podiumEntries.map((row, slotIndex) => {
            if (!row) return (
              <div
                className={`leaderboard-podium-placeholder leaderboard-podium-placeholder--${slotIndex}`}
                key={`empty-${slotIndex}`}
              />
            );
            const rank = row.rank || slotIndex + 1;
            return (
              <article className={`podium-card podium-card--${rank} podium-card--slot-${slotIndex}`} key={row.memberId}>
                <div className="podium-medal">{MEDALS[rank - 1]}</div>
                <MemberAvatar
                  memberName={row.memberName}
                  source={row.avatarUrl}
                  className="podium-avatar"
                />
                <strong>{row.memberName || "Anonymous member"}</strong>
                <span className="podium-level">{row.fitnessLevel || "Global"}</span>
                <b>{formatScore(row.totalScore)}</b>
                <small>points</small>
                <span className="podium-rank">#{rank}</span>
              </article>
            );
          })}
        </section>
      )}

      <div className="leaderboard-list-heading">
        <div>
          <p className="leaderboard-section-label">Weekly rankings</p>
        </div>
        <div className="leaderboard-list-actions">
          <label className="leaderboard-select">
            <span>Fitness level</span>
            <select
              value={levelFilter ?? ""}
              onChange={(event) => setLevelFilter(Number(event.target.value))}
            >
              {LEVELS.map((level) => (
                <option key={level.value} value={level.value}>{level.label}</option>
              ))}
            </select>
          </label>
          <span className="leaderboard-count">{totalMembers} members</span>
        </div>
      </div>

      <section className="leaderboard-card" aria-label="Weekly member rankings">
        <div className="leaderboard-table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Member</th>
                <th scope="col">Level</th>
                <th scope="col" className="numeric">Total score</th>
                <th scope="col" className="numeric">Last week</th>
              </tr>
            </thead>
            <tbody>
              {entries.length > 0 ? entries.map((row, index) => (
                <tr className={index < 3 ? `leaderboard-row leaderboard-row--${index + 1}` : "leaderboard-row"} key={row.memberId}>
                  <td>
                    <span className={`leaderboard-rank ${index < 3 ? "leaderboard-rank--medal" : ""}`}>
                      {index < 3 ? MEDALS[index] : `#${row.rank || index + 1}`}
                    </span>
                  </td>
                  <td>
                    <div className="leaderboard-member">
                      <MemberAvatar
                        memberName={row.memberName}
                        source={row.avatarUrl}
                        className="leaderboard-avatar"
                      />
                      <span>
                        <strong>{row.memberName || "Anonymous member"}</strong>
                        <small>Member #{row.memberId}</small>
                      </span>
                    </div>
                  </td>
                  <td><span className="leaderboard-level">{row.fitnessLevel || "Global"}</span></td>
                  <td className="numeric"><strong className="leaderboard-score">{formatScore(row.totalScore)}</strong><small className="leaderboard-points"> pts</small></td>
                  <td className="numeric">
                    {row.previousRank ? (
                      <span className="leaderboard-previous-rank">
                        #{row.previousRank}
                        {row.rankChange ? (
                          <span className={row.rankChange > 0 ? "rank-change rank-change--up" : "rank-change rank-change--down"}>
                            {row.rankChange > 0 ? `↑ ${row.rankChange}` : `↓ ${Math.abs(row.rankChange)}`}
                          </span>
                        ) : null}
                      </span>
                    ) : <span className="leaderboard-muted">New</span>}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="leaderboard-empty">
                    <span className="leaderboard-empty-icon">📊</span>
                    <strong>No rankings yet</strong>
                    <span>Complete a workout to be the first member on the board.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {myEntry && !myEntryIsInTop50 && (
          <div className="leaderboard-self-row" aria-label="Your ranking">
            <span className="leaderboard-self-label">Your ranking</span>
            <span className="leaderboard-rank">#{myEntry.rank || "—"}</span>
            <div className="leaderboard-member">
              <MemberAvatar memberName={myEntry.memberName} source={myEntry.avatarUrl} className="leaderboard-avatar" />
              <span>
                <strong>{myEntry.memberName || "You"}</strong>
                <small>Member #{myEntry.memberId}</small>
              </span>
            </div>
            <span className="leaderboard-level">{myEntry.fitnessLevel || "Global"}</span>
            <span className="leaderboard-self-score">{formatScore(myEntry.totalScore)} <small>pts</small></span>
          </div>
        )}
      </section>

    </main>
  );
}
