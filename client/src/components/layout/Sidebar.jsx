import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./Sidebar.css";

// SVG Icons matching Figma design
function DashboardIcon({ isActive }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9.5" stroke={isActive ? "#c4b5fd" : "#A89BD0"} strokeWidth="1.8" />
      <polygon points="16.2 7.8 14.1 14.1 7.8 16.2 9.9 9.9" fill={isActive ? "#a855f7" : "#A89BD0"} />
    </svg>
  );
}

function LibraryIcon({ isActive }) {
  const color = isActive ? "#c4b5fd" : "#A89BD0";
  return (
    <svg width="17" height="15" viewBox="0 0 15 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0.675 0.675H4.425V11.925H0.675V0.675ZM5.175 0.675H8.925V11.925H5.175V0.675Z" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" stroke={color}/>
      <path d="M10.425 1.425L13.425 2.175L11.175 11.925L8.175 11.175" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" stroke={color}/>
    </svg>
  );
}

function TrackingIcon({ isActive }) {
  const color = isActive ? "#c4b5fd" : "#A89BD0";
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 20V10M12 20V4M6 20v-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** Ngôi sao — mục Favorites của member. */
function FavoriteIcon({ isActive }) {
  const color = isActive ? "#fbbf24" : "#A89BD0";
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <polygon
        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
        fill={isActive ? color : "none"}
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SurveyIcon({ isActive }) {
  const color = isActive ? "#c4b5fd" : "#A89BD0";
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="4" width="14" height="17" rx="2" stroke={color} strokeWidth="1.8" />
      <path d="M9 4.5V3h6v1.5M9 10h6M9 14h6M9 18h3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Bóng nói chuyện — mục Góp ý & Khiếu nại của member. */
function FeedbackIcon({ isActive }) {
  const color = isActive ? "#c4b5fd" : "#A89BD0";
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.5 8.5 0 018 8v.5z"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Các URL độc lập — mục cha ("/library") không được sáng khi đang ở các URL này.
 * Ví dụ "/library/favorites" là mục riêng nên không sáng đè lên mục "Thư viện".
 */
const EXCLUSIVE_PATHS = new Set([
  "/library/favorites",
  "/favorites",
  "/library/feedback",
  "/library/feedback/new",
  "/feedback",
  "/feedback/new",
]);

/** Các mục điều hướng của member — nhãn lấy từ file i18n. */
const NAV_ITEMS = [
  { labelKey: "nav.dashboard", path: "/",        icon: DashboardIcon },
  { labelKey: "nav.library",   path: "/library", icon: LibraryIcon },
  { labelKey: "nav.favorites", path: "/library/favorites", icon: FavoriteIcon },
  { labelKey: "nav.feedback",  path: "/library/feedback", icon: FeedbackIcon },
  { labelKey: "nav.tracking",  path: "/tracking", icon: TrackingIcon },
];

// Figma content_manager_dashboard: Dashboard, Survey, Library (Progression rules / Level criteria chưa có màn)
const CONTENT_MANAGER_NAV = [
  { labelKey: "nav.dashboard", path: "/dashboard", icon: DashboardIcon },
  { labelKey: "nav.dailyTrainingPlans", path: "/content/daily-training-plans", icon: SurveyIcon },
  { labelKey: "nav.contentLibrary", path: "/library", icon: LibraryIcon },
];

function currentRole() {
  try {
    return JSON.parse(localStorage.getItem("user"))?.role;
  } catch {
    return null;
  }
}

export default function Sidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const role = currentRole();
  const isMember = role === "MEMBER";
  const baseItems = role === "CONTENT_MANAGER" ? CONTENT_MANAGER_NAV : NAV_ITEMS;
  // Favorites là tính năng riêng của MEMBER — các role khác không gọi được API.
  const items = isMember
    ? baseItems
    : baseItems.filter((item) => item.labelKey !== "nav.favorites");

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {items.map((item) => {
          // "/library" là tiền tố của "/library/favorites", nên phải so khớp chính xác
          // để không làm sáng cả hai mục cùng lúc.
          // Mục "Góp ý" vẫn sáng ở màn tạo đơn ("/library/feedback/new") vì đó là
          // màn con của cùng một chức năng.
          const isFeedback = item.labelKey === "nav.feedback";
          const isActive = item.path === "/"
            ? pathname === "/"
            : pathname === item.path
              || (isFeedback && pathname.startsWith(`${item.path}/`))
              || (!EXCLUSIVE_PATHS.has(item.path)
                && pathname.startsWith(`${item.path}/`)
                && !EXCLUSIVE_PATHS.has(pathname));
          const Icon = item.icon;

          return (
            <div
              key={item.path}
              className={`sidebar-nav-item ${isActive ? "active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              <Icon isActive={isActive} />
              <span>{t(item.labelKey)}</span>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
