import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { readWorkoutResults } from '../utils/workoutResults';
import './DailyPlanCongrats.css';

/** Icon hình tròn kèm dấu tích — biểu tượng "đã hoàn thành". */
function CheckBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12.5l4.5 4.5L20 7.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Icon mở thư viện — nút gợi ý tập thêm. */
function LibraryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5h4v14H4zM10 5h4v14h-4zM16.5 5.6l3.3 13.1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Icon dashboard — nút về trang chủ. */
function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="8" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="3" width="8" height="6" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3" y="15" width="8" height="6" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="11" width="8" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

/** Icon lịch — nút xem lại kế hoạch hôm nay. */
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** Icon lửa — chuỗi ngày tập liên tục. */
function StreakIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2c1 4 5 5.5 5 10a5 5 0 01-10 0c0-2 1-3.5 2-5 0 2 1 3 2 3 0-3-1-5 1-8z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Màn chúc mừng — hiện sau khi member hoàn thành xong kế hoạch tập hôm nay.
 *
 * Member có thể:
 *  - Về dashboard để xem tổng quan tiến độ.
 *  - Bấm nút gợi ý để sang thư viện tập thêm nếu còn muốn tập.
 */
export default function DailyPlanCongrats({ onReviewPlan }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  /** Số bài tập / độ chính xác của buổi tập vừa hoàn thành. */
  const [summary, setSummary] = useState({ exerciseCount: 0, accuracy: 0 });
  /** Chuỗi ngày tập liên tục (streak) — lấy từ API streak. */
  const [streak, setStreak] = useState(0);

  // Tổng hợp số liệu buổi tập vừa rồi từ phiên tập trong sessionStorage.
  useEffect(() => {
    const results = readWorkoutResults();
    const valid = results.reduce((sum, item) => sum + (item.validCount || 0), 0);
    const total = results.reduce(
      (sum, item) => sum + (item.validCount || 0) + (item.invalidCount || 0),
      0,
    );
    setSummary({
      exerciseCount: results.length,
      accuracy: total > 0 ? Math.round((valid / total) * 100) : 0,
    });
  }, []);

  // Lấy streak hiện tại — lỗi thì bỏ qua, màn chúc mừng vẫn hiển thị.
  useEffect(() => {
    const now = new Date();
    api
      .get('/member/day-streak', { params: { year: now.getFullYear(), month: now.getMonth() + 1 } })
      .then((res) => setStreak(res.data?.currentStreak ?? 0))
      .catch(() => setStreak(0));
  }, []);

  const goDashboard = useCallback(() => navigate('/'), [navigate]);
  const goLibrary = useCallback(() => navigate('/library'), [navigate]);

  return (
    <section className="dp-congrats" aria-live="polite">
      <div className="dp-congrats__glow" aria-hidden="true" />

      <div className="dp-congrats__badge">
        <CheckBadgeIcon />
      </div>

      <span className="dp-congrats__eyebrow">{t('member.plan.congratsEyebrow')}</span>
      <h2 className="dp-congrats__title">{t('member.plan.congratsTitle')}</h2>
      <p className="dp-congrats__text">{t('member.plan.congratsText')}</p>

      <div className="dp-congrats__stats">
        <div className="dp-congrats__stat">
          <p className="dp-congrats__stat-value">{summary.exerciseCount}</p>
          <p className="dp-congrats__stat-label">{t('member.plan.congratsExercises')}</p>
        </div>
        <div className="dp-congrats__stat">
          <p className="dp-congrats__stat-value">{summary.accuracy}%</p>
          <p className="dp-congrats__stat-label">{t('member.plan.congratsAccuracy')}</p>
        </div>
        <div className="dp-congrats__stat">
          <p className="dp-congrats__stat-value">
            <StreakIcon />
            {streak}
          </p>
          <p className="dp-congrats__stat-label">{t('member.plan.congratsStreak')}</p>
        </div>
      </div>

      <div className="dp-congrats__actions">
        <button
          type="button"
          className="dp-congrats__btn dp-congrats__btn--primary"
          onClick={goDashboard}
        >
          <DashboardIcon />
          {t('member.plan.congratsBackDashboard')}
        </button>

        {/* Gợi ý tập thêm — member vẫn muốn tập thêm trong ngày. */}
        <button
          type="button"
          className="dp-congrats__btn dp-congrats__btn--ghost"
          onClick={goLibrary}
        >
          <LibraryIcon />
          {t('member.plan.congratsGoLibrary')}
        </button>

        {onReviewPlan && (
          <button
            type="button"
            className="dp-congrats__btn dp-congrats__btn--ghost"
            onClick={onReviewPlan}
          >
            <CalendarIcon />
            {t('member.plan.congratsReviewPlan')}
          </button>
        )}
      </div>
    </section>
  );
}
