import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useTranslation } from "react-i18next";
import api from "../api/client";
import "../styles/notification.css";

const AUDIENCE_LABEL_KEYS = {
  MEMBER: "admin.notifications.detail.audienceMember",
  ALL_MEMBERS: "admin.notifications.detail.audienceAllMembers",
  CONTENT_MANAGER: "admin.notifications.detail.audienceContentManager",
  SYSTEM_WIDE: "admin.notifications.detail.audienceSystem",
  ALL_USERS: "admin.notifications.detail.audienceSystem",
  GLOBAL: "admin.notifications.detail.audienceSystem",
  SPECIFIC_USER: "admin.notifications.detail.audienceDirect",
};

function formatCreatedAt(value, locale) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(locale || "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
}

export default function NotificationDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [notification, setNotification] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get(`/admin/notifications/${id}`)
      .then(({ data }) => {
        if (active) setNotification(data);
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.response?.data?.message || t("admin.notifications.detail.loadFailed"));
        }
      });
    return () => { active = false; };
  }, [id, t]);

  if (!notification && !error) {
    return (
      <section className="notification-module mx-auto w-full max-w-[1080px] py-8 text-sm text-[#a89bd0]" role="status">
        {t("admin.notifications.detail.loading")}
      </section>
    );
  }

  if (error) {
    return (
      <section className="notification-module mx-auto w-full max-w-[1080px] text-slate-100">
        <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
        <button
          type="button"
          onClick={() => navigate("/admin/notifications")}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-[#51456f] bg-[#17112d] px-4 py-2 text-sm text-white transition hover:bg-[#2b2049]"
        >
          <ArrowBackRoundedIcon sx={{ fontSize: 17 }} />
          {t("admin.notifications.detail.backToList")}
        </button>
      </section>
    );
  }

  const audience = notification.targetAudience
    || (notification.userId ? "SPECIFIC_USER" : "ALL_MEMBERS");
  const type = String(notification.type || "").toUpperCase();
  const status = String(notification.status || "").toUpperCase();
  const audienceLabel = AUDIENCE_LABEL_KEYS[audience]
    ? t(AUDIENCE_LABEL_KEYS[audience])
    : audience;

  return (
    <section className="notification-module mx-auto w-full max-w-[1080px] text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-white">{t("admin.notifications.detail.title")}</h1>
          <p className="mt-1.5 text-sm text-[#a89bd0]">{t("admin.notifications.detail.description")}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin/notifications")}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#51456f] bg-[#17112d] px-3.5 text-sm font-medium text-white transition hover:bg-[#2b2049]"
        >
          <ArrowBackRoundedIcon sx={{ fontSize: 18 }} />
          {t("admin.notifications.detail.backToList")}
        </button>
      </header>

      <div className="w-full space-y-4">
        <section className="rounded-2xl border border-[#35275e] bg-[#21183c] p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-300">
              {type ? type.charAt(0) + type.slice(1).toLowerCase() : t("admin.notifications.detail.unknown")}
            </span>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-300">
              {audienceLabel}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              status === "PUBLISHED"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-slate-500/30 bg-slate-500/10 text-slate-300"
            }`}>
              {status ? status.charAt(0) + status.slice(1).toLowerCase() : t("admin.notifications.detail.unknown")}
            </span>
          </div>
          <h2 className="mt-4 break-words text-xl font-bold text-white">{notification.title}</h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#c5bdd7]">
            {notification.message}
          </p>
        </section>
        <section className="rounded-2xl border border-[#35275e] bg-[#21183c] p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white">{t("admin.notifications.detail.deliveryDetails")}</h2>
          <dl className="mt-4 grid w-full grid-cols-2 gap-4">
            <div className="flex min-h-16 w-full min-w-0 flex-col rounded-xl border border-[#35275e] bg-[#17112d] p-4">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#81769d]">{t("admin.notifications.detail.audience")}</dt>
              <dd className="mt-auto pt-1.5 text-sm font-semibold leading-5 text-[#e2ddef]">
                {audienceLabel}
                {audience === "SPECIFIC_USER" && notification.userId ? ` · ${t("admin.notifications.detail.userTag", { id: notification.userId })}` : ""}
              </dd>
            </div>
            <div className="flex min-h-16 w-full min-w-0 flex-col rounded-xl border border-[#35275e] bg-[#17112d] p-4">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#81769d]">{t("admin.notifications.detail.created")}</dt>
              <dd className="mt-auto pt-1.5 text-sm font-semibold leading-5 text-[#e2ddef]">
                {formatCreatedAt(notification.createdAt, i18n.language)}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </section>
  );
}
