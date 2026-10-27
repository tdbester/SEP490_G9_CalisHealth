import { useNavigate, useLocation } from "react-router-dom";
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

function SurveyIcon({ isActive }) {
  const color = isActive ? "#c4b5fd" : "#A89BD0";
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="4" width="14" height="17" rx="2" stroke={color} strokeWidth="1.8" />
      <path d="M9 4.5V3h6v1.5M9 10h6M9 14h6M9 18h3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard", icon: DashboardIcon },
  { label: "Library", path: "/library", icon: LibraryIcon },
  { label: "Tracking",  path: "/tracking",  icon: TrackingIcon },
];

// Figma content_manager_dashboard: Dashboard, Survey, Library (Progression rules / Level criteria chưa có màn)
const CONTENT_MANAGER_NAV = [
  { label: "Dashboard", path: "/dashboard", icon: DashboardIcon },
  { label: "Survey", path: "/content/survey", icon: SurveyIcon },
  { label: "Library", path: "/library", icon: LibraryIcon },
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
  const items = currentRole() === "CONTENT_MANAGER" ? CONTENT_MANAGER_NAV : NAV_ITEMS;

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.path);
          const Icon = item.icon;

          return (
            <div
              key={item.path}
              className={`sidebar-nav-item ${isActive ? "active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              <Icon isActive={isActive} />
              <span>{item.label}</span>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
