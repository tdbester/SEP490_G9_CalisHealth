import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import BrandLogo from "../BrandLogo";
import { SUPPORTED_LANGUAGES, changeLanguage } from "../../i18n";
import { avatarUrl, profileApi } from "../../api/profile";
import "./StaffLayout.css";

/**
 * Thanh navigation dùng chung cho Admin và Content Manager.
 *
 * Bố cục giống hệt Member: topbar cố định full-width (logo bên trái) + sidebar
 * cố định bên trái nằm dưới topbar.
 *
 * Đổi ngôn ngữ chỉ còn ở menu tài khoản (bấm vào avatar) — giống Member —
 * nên không còn nút ngôn ngữ riêng ở đáy sidebar.
 */
export default function StaffTopbar({
  roleLabel,
  roleIcon = null,
  user,
  onOpenMenu,
  showDate = false,
  bell = null,
  profilePath = "/profile",
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const wrapRef = useRef(null);
  const [openPanel, setOpenPanel] = useState(false);
  const [accountUser, setAccountUser] = useState(user);
  const [language, setLanguage] = useState(
    () => localStorage.getItem("calishealth_lang") || "vi",
  );

  useEffect(() => {
    setAccountUser(user);
  }, [user]);

  // Đóng menu khi bấm ra ngoài hoặc nhấn Esc.
  useEffect(() => {
    if (!openPanel) return undefined;
    const close = (event) => {
      if (event.type === "keydown" && event.key === "Escape") {
        setOpenPanel(false);
      } else if (
        event.type === "pointerdown" &&
        !wrapRef.current?.contains(event.target)
      ) {
        setOpenPanel(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [openPanel]);

  const initials =
    accountUser?.fullName
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "HV";

  const refreshProfile = () => {
    profileApi
      .get()
      .then((profile) => {
        setAccountUser((current) => ({ ...current, ...profile }));
        localStorage.setItem(
          "user",
          JSON.stringify({
            email: profile.email,
            fullName: profile.fullName,
            role: profile.role,
            avatarUrl: profile.avatarUrl || null,
          }),
        );
      })
      .catch(() => {
        // Giữ dữ liệu cache khi API hồ sơ không sẵn sàng.
      });
  };

  return (
    <header className="staff-topbar">
      {onOpenMenu ? (
        <button
          type="button"
          className="staff-menu-btn"
          aria-label={t("common.ui.openAdminMenu")}
          onClick={onOpenMenu}
        >
          <MenuRoundedIcon />
        </button>
      ) : null}

      <button
        type="button"
        className="staff-topbar-logo"
        aria-label={t("common.ui.goToDashboard")}
        onClick={() => navigate("/")}
      >
        <span className="staff-topbar-logo-icon">
          <BrandLogo width={12} height={18} />
        </span>
        <span className="staff-topbar-logo-text">
          Calis<span className="staff-topbar-gradient">Health</span>
        </span>
      </button>

      <div className="staff-topbar-spacer" />

      <div className="staff-topbar-right">
        {showDate ? (
          <span className="staff-role-chip is-muted">
            {new Date().toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
        ) : null}

        {roleLabel ? (
          <span className="staff-role-chip">
            {roleIcon}
            {roleLabel}
          </span>
        ) : null}

        {bell}

        <div className="staff-avatar-wrap" ref={wrapRef}>
          <button
            type="button"
            className="staff-avatar"
            title={accountUser?.fullName || t("common.ui.account")}
            aria-label={t("common.ui.openAccountMenu")}
            aria-expanded={openPanel}
            onClick={() => {
              setOpenPanel((current) => !current);
              refreshProfile();
            }}
          >
            {accountUser?.avatarUrl ? (
              <img src={avatarUrl(accountUser.avatarUrl)} alt="" />
            ) : (
              initials
            )}
          </button>

          {openPanel ? (
            <div className="staff-popover" role="menu">
              <div className="staff-popover-heading">
                {t("common.ui.accountAndSettings")}
              </div>
              <button
                type="button"
                className="staff-menu-item"
                role="menuitem"
                onClick={() => {
                  setOpenPanel(false);
                  navigate(profilePath);
                }}
              >
                <PersonOutlineRoundedIcon />
                <span>{t("common.nav.profile")}</span>
              </button>
              <label className="staff-language">
                <span>{t("common.changeLanguage")}</span>
                <select
                  value={language}
                  aria-label={t("common.changeLanguage")}
                  onChange={(event) => {
                    const next = event.target.value;
                    setLanguage(next);
                    changeLanguage(next);
                  }}
                >
                  {SUPPORTED_LANGUAGES.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="staff-menu-item"
                role="menuitem"
                onClick={() => {
                  setOpenPanel(false);
                  navigate("/settings");
                }}
              >
                <SettingsOutlinedIcon />
                <span>{t("nav.settings")}</span>
              </button>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="staff-logout-btn"
          onClick={() => {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            navigate("/login");
          }}
        >
          <LogoutRoundedIcon />
          <span>{t("nav.logout")}</span>
        </button>
      </div>
    </header>
  );
}
