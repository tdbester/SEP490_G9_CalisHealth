import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import api from "../api/client";

function clearAuthState() {
  localStorage.removeItem("token");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("jwt");
  localStorage.removeItem("user");
}

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const token = localStorage.getItem("token")?.trim();
  const [status, setStatus] = useState("loading"); // loading | authed | guest

  useEffect(() => {
    setStatus("loading");
    if (!token) {
      clearAuthState();
      setStatus("guest");
      return undefined;
    }

    let cancelled = false;
    api.get("/auth/me")
      .then(({ data }) => {
        if (cancelled) return;
        if (
          typeof data?.email !== "string" ||
          !data.email.trim() ||
          typeof data?.role !== "string" ||
          !data.role.trim()
        ) {
          clearAuthState();
          setStatus("guest");
          return;
        }
        localStorage.setItem(
          "user",
          JSON.stringify({ email: data.email, fullName: data.fullName, role: data.role }),
        );
        setStatus("authed");
      })
      .catch(() => {
        if (cancelled) return;
        clearAuthState();
        setStatus("guest");
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname, token]);

  if (!token) return <Navigate to="/login" replace />;
  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#100923", color: "#fff" }}>
        Loading…
      </div>
    );
  }
  if (status === "guest") return <Navigate to="/login" replace />;
  return children;
}
