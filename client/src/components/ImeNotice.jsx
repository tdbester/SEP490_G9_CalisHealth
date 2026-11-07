import { useTranslation } from "react-i18next";

// Small line under an input. Idle: a reminder shown only while the field is focused
// (see .login-field:focus-within in Login.css). Warn: always visible once accents are typed.
export default function ImeNotice({ warn = false }) {
  const { t } = useTranslation();
  return (
    <small
      className={`login-hint ${warn ? "login-hint--warn" : "login-hint--idle"}`}
      role={warn ? "alert" : undefined}
    >
      {warn ? t("common.imeWarning") : t("common.imeIdleHint")}
    </small>
  );
}
