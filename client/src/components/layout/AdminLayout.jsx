import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import "./AdminLayout.css";

export default function AdminLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Trên mobile, sidebar là drawer: tự đóng khi người dùng chuyển trang.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="admin-layout">
      <Topbar onOpenMenu={() => setMenuOpen((open) => !open)} menuOpen={menuOpen} />
      {menuOpen ? (
        <button
          type="button"
          className="admin-scrim"
          aria-label="Đóng menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      <main className="admin-content">
        {children}
      </main>
    </div>
  );
}
