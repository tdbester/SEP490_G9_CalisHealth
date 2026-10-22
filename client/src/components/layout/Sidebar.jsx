import { useNavigate, useLocation } from "react-router-dom";
import "./Sidebar.css";

// Inline SVG icons matching Figma vectors
function DashboardIcon() {
  // Grid pattern (3x3) matching Figma nav-dashboard vectors
  return (
    <svg width="15" height="8" viewBox="0 0 15 8" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M0.674999 3.675H14.175" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" stroke="#A89BD0"/>
<path d="M2.925 0.675003V6.675" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" stroke="#A89BD0"/>
<path d="M11.925 0.675003V6.675" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" stroke="#A89BD0"/>
</svg>

  );
}

function TrackingIcon() {
  // Three-column tracking icon
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.25 6V12.75M7.5 1.5V12.75M12.75 4.5V12.75" stroke="#A89BD0" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LibraryIcon() {
  // Book/library icon matching Figma nav-lib
  return (
    <svg width="15" height="13" viewBox="0 0 15 13" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M0.674999 0.675003H4.425V11.925H0.674999V0.675003ZM5.175 0.675003H8.925V11.925H5.175V0.675003Z" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" stroke="#A89BD0"/>
<path d="M10.425 1.425L13.425 2.175L11.175 11.925L8.175 11.175" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" stroke="#A89BD0"/>
</svg>

  );
}

const NAV_ITEMS = [
  { label: "Dashboard", path: "/",        icon: DashboardIcon },
  { label: "Library",   path: "/library",  icon: LibraryIcon },
  { label: "Tracking", path: "/tracking", icon: TrackingIcon },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === "/" ? pathname === "/" : pathname.startsWith(item.path);
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
