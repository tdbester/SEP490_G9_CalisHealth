import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./StaffLayout.css";

/**
 * Sidebar dùng chung cho Admin và Content Manager.
 *
 * Giống Member: danh sách mục điều hướng dọc theo cạnh trái, mục đang xem
 * được tô sáng. Không có nút đổi ngôn ngữ ở đáy — việc đổi ngôn ngữ nằm
 * trong menu tài khoản trên topbar.
 */
export default function StaffSidebar({ links, open = false, onNavigate }) {
  const { pathname } = useLocation();
  const { t } = useTranslation();

  return (
    <aside
      className={`staff-sidebar${open ? " is-open" : ""}`}
      aria-label={t("nav.home")}
    >
      <nav className="staff-nav">
        {links.map(({ to, labelKey, label, icon: Icon }) => {
          const active =
            to === "/"
              ? pathname === "/"
              : pathname === to || pathname.startsWith(`${to}/`);
          return (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={`staff-nav-item${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon sx={{ fontSize: 18 }} />
              <span>{labelKey ? t(labelKey) : label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
