import { useEffect, useMemo, useState } from "react";
import { Alert, Button, CircularProgress } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import { avatarUrl, profileApi } from "../api/profile";
import { getLevelLabel } from "../utils/levelLabel";
import "./LeaderboardPage.css";

/**
 * Các trình độ thể lực của hệ thống.
 *
 * `name` là tên gốc trong DB (bảng `fitness_levels`) — dùng để khớp với
 * `profile.member.levelName` và với `fitnessLevel` mà API trả về.
 * `labelKey` là key i18n để hiển thị nhãn đã dịch.
 */
const LEVELS = [
  { value: 1, name: "Beginner", labelKey: "member.catalog.beginner" },
  { value: 2, name: "Intermediate", labelKey: "member.catalog.intermediate" },
  { value: 3, name: "Advanced", labelKey: "member.catalog.advanced" },
  { value: 4, name: "Expert", labelKey: "member.catalog.expert" },
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
  const { t } = useTranslation();
  const [entries, setEntries] = useState([]);
  const [myEntry, setMyEntry] = useState(null);
  const [totalMembers, setTotalMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Leaderboard chỉ lọc theo fitness level — không có lựa chọn "tất cả".
  // Mặc định là level của chính member đang đăng nhập.
  const [levelFilter, setLevelFilter] = useState(null);

  /**
   * Nhãn trình độ đã dịch.
   *
   * API trả về tên level gốc trong DB ("Beginner", "Intermediate", ...) nên
   * dùng `getLevelLabel` để tra key i18n tương ứng.  Level "Global" là giá trị
   * mặc định khi member chưa có level, không nằm trong bảng tra nên dịch riêng.
   */
  const levelLabel = (value) => {
    const name = String(value || "").trim();
    if (!name || name.toLowerCase() === "global") {
      return t("member.leaderboard.globalLevel");
    }
    return getLevelLabel(name);
  };

  // Lấy level của member để đặt mặc định cho dropdown.
  useEffect(() => {
    let cancelled = false;

    profileApi.get()
      .then((profile) => {
        if (cancelled) return;
        const levelName = profile?.member?.levelName;
        const match = LEVELS.find((level) => level.name === levelName);
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

  // Đồng bộ tiêu đề tab khi người dùng đổi ngôn ngữ.
  useEffect(() => {
    document.title = t("member.leaderboard.documentTitle");
  }, [t]);

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
          // Lưu mô tả lỗi thay vì chuỗi đã dịch, để đổi ngôn ngữ không phải
          // gọi lại API.  Chuỗi được dịch lúc render.
          setError({
            // Message do backend trả về đã đúng ngôn ngữ nhờ header
            // Accept-Language -> dùng nguyên xi.
            message: requestError.response?.data?.message || null,
            status: requestError.response?.status || null,
            network: Boolean(requestError.request),
          });
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

  const podiumEntries = useMemo(
    () => [entries[1], entries[0], entries[2]],
    [entries],
  );
  const myEntryIsInTop50 = myEntry && entries.some((entry) => entry.memberId === myEntry.memberId);

  if (loading) {
    return (
      <main className="leaderboard-page leaderboard-page--centered">
        <CircularProgress className="leaderboard-spinner" />
      </main>
    );
  }

  if (error) {
    const errorMessage = error.message
      || (error.status
        ? t("member.leaderboard.serverError", { status: error.status })
        : error.network
          ? t("member.leaderboard.networkError")
          : t("member.leaderboard.loadFailed"));
    return (
      <main className="leaderboard-page">
        <div className="leaderboard-error">
          <Alert severity="error">{errorMessage}</Alert>
          <div className="leaderboard-error-actions">
            <Button variant="contained" onClick={() => window.location.reload()}>
              {t("member.leaderboard.tryAgain")}
            </Button>
            <Button variant="outlined" onClick={() => navigate("/")}>
              {t("member.leaderboard.backToDashboard")}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="leaderboard-page">
      <header className="leaderboard-hero">
        <div className="leaderboard-hero-art" aria-hidden="true">
          <span className="leaderboard-hero-spark leaderboard-hero-spark--one">✦</span>
          <span className="leaderboard-hero-spark leaderboard-hero-spark--two">✧</span>
          <span className="leaderboard-hero-trophy">🏆</span>
        </div>
        <div className="leaderboard-hero-copy">
          <p className="leaderboard-eyebrow">{t("member.leaderboard.eyebrow")}</p>
          <h1>{t("member.leaderboard.title")}</h1>
          <p className="leaderboard-subtitle">{t("member.leaderboard.subtitle")}</p>
        </div>
        <div className="leaderboard-week-badge">
          <span className="leaderboard-week-dot" />
          {t("member.leaderboard.updatedWeekly")}
        </div>
      </header>

      {entries.length > 0 && (
        <section className="leaderboard-podium" aria-label={t("member.leaderboard.podiumAria")}>
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
                <strong>{row.memberName || t("member.leaderboard.anonymousMember")}</strong>
                <span className="podium-level">{levelLabel(row.fitnessLevel)}</span>
                <b>{formatScore(row.totalScore)}</b>
                <small>{t("member.leaderboard.points")}</small>
                <span className="podium-rank">#{rank}</span>
              </article>
            );
          })}
        </section>
      )}

      <div className="leaderboard-list-heading">
        <div>
          <p className="leaderboard-section-label">{t("member.leaderboard.weeklyRankings")}</p>
        </div>
        <div className="leaderboard-list-actions">
          <label className="leaderboard-select">
            <span>{t("member.leaderboard.fitnessLevel")}</span>
            <select
              value={levelFilter ?? ""}
              onChange={(event) => setLevelFilter(Number(event.target.value))}
            >
              {LEVELS.map((level) => (
                <option key={level.value} value={level.value}>{t(level.labelKey)}</option>
              ))}
            </select>
          </label>
          <span className="leaderboard-count">
            {t("member.leaderboard.memberCount", { count: totalMembers })}
          </span>
        </div>
      </div>

      <section className="leaderboard-card" aria-label={t("member.leaderboard.rankingsAria")}>
        <div className="leaderboard-table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th scope="col">{t("member.leaderboard.colRank")}</th>
                <th scope="col">{t("member.leaderboard.colMember")}</th>
                <th scope="col">{t("member.leaderboard.colLevel")}</th>
                <th scope="col" className="numeric">{t("member.leaderboard.colTotalScore")}</th>
                <th scope="col" className="numeric">{t("member.leaderboard.colLastWeek")}</th>
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
                        <strong>{row.memberName || t("member.leaderboard.anonymousMember")}</strong>
                        <small>{t("member.leaderboard.memberNumber", { id: row.memberId })}</small>
                      </span>
                    </div>
                  </td>
                  <td><span className="leaderboard-level">{levelLabel(row.fitnessLevel)}</span></td>
                  <td className="numeric">
                    <strong className="leaderboard-score">{formatScore(row.totalScore)}</strong>
                    <small className="leaderboard-points"> {t("member.leaderboard.points")}</small>
                  </td>
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
                    ) : <span className="leaderboard-muted">{t("member.leaderboard.newRank")}</span>}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="leaderboard-empty">
                    <span className="leaderboard-empty-icon">📊</span>
                    <strong>{t("member.leaderboard.emptyTitle")}</strong>
                    <span>{t("member.leaderboard.emptyHint")}</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {myEntry && !myEntryIsInTop50 && (
          <div className="leaderboard-self-row" aria-label={t("member.leaderboard.yourRankingAria")}>
            <span className="leaderboard-self-label">{t("member.leaderboard.yourRanking")}</span>
            <span className="leaderboard-rank">#{myEntry.rank || "—"}</span>
            <div className="leaderboard-member">
              <MemberAvatar memberName={myEntry.memberName} source={myEntry.avatarUrl} className="leaderboard-avatar" />
              <span>
                <strong>{myEntry.memberName || t("member.leaderboard.you")}</strong>
                <small>{t("member.leaderboard.memberNumber", { id: myEntry.memberId })}</small>
              </span>
            </div>
            <span className="leaderboard-level">{levelLabel(myEntry.fitnessLevel)}</span>
            <span className="leaderboard-self-score">
              {formatScore(myEntry.totalScore)} <small>{t("member.leaderboard.points")}</small>
            </span>
          </div>
        )}
      </section>

    </main>
  );
}
