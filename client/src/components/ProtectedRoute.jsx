import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/client";

export default function ProtectedRoute({ children }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState("loading"); // loading | authed | guest

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setStatus("guest");
      return;
    }
    // Validate token by calling /me
    api.get("/auth/me")
      .then(() => setStatus("authed"))
      .catch(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setStatus("guest");
      });
  }, []);

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#100923", color: "#fff" }}>
        {t("common.loading")}
      </div>
    );
  }
  if (status === "guest") return <Navigate to="/login" replace />;
  return children;
}
