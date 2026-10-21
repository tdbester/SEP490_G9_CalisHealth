import { useEffect, useState } from "react";
import api from "../api/client";
import "./Dashboard.css";

export default function Dashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const cached = localStorage.getItem("user");
    if (cached) setUser(JSON.parse(cached));

    api.get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => {});
  }, []);

  return (
    <div className="dashboard" style={{ padding: "32px", color: "#111827" }}>
      <h1 style={{ fontSize: "32px", fontWeight: 700, margin: 0 }}>
        Welcome, {user?.fullName || "..."}
      </h1>
      <p style={{ color: "#6B7280", marginTop: "8px" }}>{user?.email}</p>
    </div>
  );
}
