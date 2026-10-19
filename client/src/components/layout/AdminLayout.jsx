import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import "./AdminLayout.css";

export default function AdminLayout({ children }) {
  return (
    <div className="admin-layout">
      <Topbar />
      <Sidebar />
      <main className="admin-content">
        {children}
      </main>
    </div>
  );
}
