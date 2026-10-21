import { useNavigate, useLocation } from "react-router-dom";
import "./Sidebar.css";

// SVG Icons matching Figma design
function ExploreIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9.5" stroke="#A89BD0" strokeWidth="1.8" />
      <polygon points="16.2 7.8 14.1 14.1 7.8 16.2 9.9 9.9" fill="#A89BD0" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg width="15" height="13" viewBox="0 0 15 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0.675 0.675H4.425V11.925H0.675V0.675ZM5.175 0.675H8.925V11.925H5.175V0.675Z" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" stroke="#A89BD0"/>
      <path d="M10.425 1.425L13.425 2.175L11.175 11.925L8.175 11.175" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" stroke="#A89BD0"/>
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 20V10M12 20V4M6 20v-6" stroke="#A89BD0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const NAV_ITEMS = [
  { label: "Explore", path: "/explore", icon: ExploreIcon },
  { label: "Library", path: "/library", icon: LibraryIcon },
  { label: "Report",  path: "/report",  icon: ReportIcon },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.path);
          const Icon = item.icon;

          return (
            <div
              key={item.path}
              className={`sidebar-nav-item ${isActive ? "active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              <Icon />
              <span>{item.label}</span>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
