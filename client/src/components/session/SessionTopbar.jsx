import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import BrandLogo from "../BrandLogo";
import "./SessionTopbar.css";

/**
 * Topbar dùng chung cho các màn trong luồng tập fullscreen
 * (Real-time AI Pose Tracking và Rest between sets).
 *
 * Gồm nút Back (quay lại màn trước) + logo CalisHealth — đồng bộ với
 * layout chính của app thay vì topbar riêng kiểu browser.
 *
 * `showBack={false}` ẩn nút back — dùng cho màn kết quả (Figma 549:1175).
 * `brandHref` là đích khi bấm logo (mặc định: dashboard của member).
 * `onBrand` ghi đè hành vi mặc định — dùng ở màn tracking để lưu kết quả
 * buổi tập trước khi rời đi.
 */
export default function SessionTopbar({
  onBack,
  right = null,
  showBack = true,
  brandHref = "/",
  onBrand = null,
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    navigate(-1);
  };

  const handleBrandClick = () => {
    if (onBrand) {
      onBrand();
      return;
    }
    // Trong phiên tập, member có thể muốn về dashboard để xem lại tổng quan.
    navigate(brandHref);
  };

  return (
    <header className="sb-topbar">
      {showBack ? (
        <button
          type="button"
          className="sb-back"
          aria-label={t("common.ui.goBack")}
          onClick={handleBack}
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M12.5 4.5L7 10l5.5 5.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}

      <button
        type="button"
        className="sb-brand"
        aria-label={t("common.ui.goToDashboard")}
        title={t("common.ui.goToDashboard")}
        onClick={handleBrandClick}
      >
        <span className="sb-brand-icon">
          <BrandLogo width={12} height={18} />
        </span>
        <span className="sb-brand-text">
          Calis<span className="sb-brand-text-accent">Health</span>
        </span>
      </button>

      {right ? <div className="sb-topbar-right">{right}</div> : null}
    </header>
  );
}
