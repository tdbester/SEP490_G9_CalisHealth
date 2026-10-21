import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "./Topbar.css";

function Logo() {
  return (
    <svg width="12" height="18" viewBox="0 0 12 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.6316 0C6.7146 4.332 11.0466 6.498 11.0466 11.913C11.0466 13.3491 10.4761 14.7265 9.46058 15.742C8.44507 16.7575 7.06775 17.328 5.6316 17.328C4.19545 17.328 2.81812 16.7575 1.80262 15.742C0.787106 14.7265 0.216599 13.3491 0.216599 11.913C0.216599 9.747 1.2996 8.664 2.3826 7.581C2.3826 9.747 3.4656 10.83 4.5486 10.83C4.5486 6.498 3.4656 4.332 5.6316 0Z" fill="url(#paint0_linear_89_80)" />
      <path d="M0.758101 12.996H3.4656L4.8735 10.2885L6.9312 15.7035L8.3391 12.996H10.5051" strokeWidth="1.5162" strokeLinecap="round" strokeLinejoin="round" stroke="white" />
      <defs>
        <linearGradient id="paint0_linear_89_80" x1="2.3826" y1="-2.22058e-07" x2="14.1558" y2="12.2638" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B44CFF" />
          <stop offset="1" stopColor="#FF77A8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Topbar() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const cached = localStorage.getItem("user");
    if (cached) setUser(JSON.parse(cached));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <header className="topbar">
      <div className="topbar-logo" onClick={() => navigate("/")}>
        <div className="topbar-logo-icon">
          <Logo />
        </div>
        <span className="topbar-logo-text">Calis</span>
        <span className="gradient-text">Health</span>
      </div>

      <div className="topbar-spacer" />

      {user ? (
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: "#F7F2FC", fontSize: 14 }}>{user.fullName}</span>
          <div className="topbar-login-btn" onClick={handleLogout}>
            <span>Logout</span>
          </div>
        </div>
      ) : (
        <div className="topbar-login-btn" onClick={() => navigate("/login")}>
          <span>Login</span>
        </div>
      )}
    </header>
  );
}
