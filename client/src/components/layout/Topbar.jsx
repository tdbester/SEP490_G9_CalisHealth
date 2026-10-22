import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "./Topbar.css";

function Logo() {
  return (
    <svg width="16" height="24" viewBox="0 0 12 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.6316 0C6.7146 4.332 11.0466 6.498 11.0466 11.913C11.0466 13.3491 10.4761 14.7265 9.46058 15.742C8.44507 16.7575 7.06775 17.328 5.6316 17.328C4.19545 17.328 2.81812 16.7575 1.80262 15.742C0.787106 14.7265 0.216599 13.3491 0.216599 11.913C0.216599 9.747 1.2996 8.664 2.3826 7.581C2.3826 9.747 3.4656 10.83 4.5486 10.83C4.5486 6.498 3.4656 4.332 5.6316 0Z" fill="url(#paint0_linear_89_80)" />
      <path d="M0.758101 12.996H3.4656L4.8735 10.2885L6.9312 15.7035L8.3391 12.996H10.5051" strokeWidth="1.5162" strokeLinecap="round" strokeLinejoin="round" stroke="white" />
      <defs>
        <linearGradient id="paint0_linear_89_80" x1="2.3826" y1="-2.22058e-07" x2="14.1558" y2="12.2638" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B44CFF" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function UserIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LogOutIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export default function Topbar() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const cached = localStorage.getItem("user");
    if (cached) {
      try {
        setUser(JSON.parse(cached));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <header className="topbar">
      <div className="topbar-logo cursor-pointer flex items-center" onClick={() => navigate("/library")}>
        <div className="topbar-logo-icon">
          <Logo />
        </div>
        <span className="topbar-logo-text">Calis</span>
        <span
          className="text-[#a855f7] font-extrabold text-[16.8px]"
          style={{ color: "#a855f7", WebkitTextFillColor: "#a855f7", background: "none" }}
        >
          Health
        </span>
      </div>

      <div className="topbar-spacer" />

      {/* Cụm User góc phải: 2 nút icon tròn nhỏ User và LogOut */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          className="w-9 h-9 rounded-full bg-[#1e1548] text-[#a58ef8] hover:text-white border border-[#3b2880] flex items-center justify-center transition-all cursor-pointer shadow-sm"
          title={user?.fullName || "User Profile"}
        >
          <UserIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="w-9 h-9 rounded-full bg-[#2a132e] text-[#f43f5e] hover:text-white border border-[#4a1f4b] flex items-center justify-center transition-all cursor-pointer shadow-sm"
          title="Log out"
        >
          <LogOutIcon className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
