import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import i18n, { SUPPORTED_LANGUAGES } from "../i18n";
import "../components/LanguageSwitcher.css";

function GlobeIcon() {
  return (
    <svg className="lang-switcher-globe" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M2.8 12H21.2M12 2.8C14.4 5.6 15.9 8.7 15.9 12C15.9 15.3 14.4 18.4 12 21.2C9.6 18.4 8.1 15.3 8.1 12C8.1 8.7 9.6 5.6 12 2.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CaretIcon({ open }) {
  return (
    <svg
      className={`lang-switcher-caret${open ? " is-open" : ""}`}
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.5 4.5L6 8L9.5 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="lang-switcher-check"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.5 8.5L6 12L13.5 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Nút đổi ngôn ngữ, đặt cố định ở góc trên bên phải màn hình.
 * - Đọc ngôn ngữ hiện tại từ i18n
 * - Lựa chọn được lưu vào localStorage (key: calishealth_lang)
 * - axios interceptor tự đọc key này để gửi Accept-Language cho backend
 *
 * Component này được render ở App.jsx NGOÀI <Routes>, nên nút xuất hiện trên
 * mọi trang - kể cả các màn do nhóm khác viết.
 */
export default function LanguageSwitcher() {
  const { t, i18n: instance } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = instance.resolvedLanguage || instance.language || "vi";
  const currentLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === current) || SUPPORTED_LANGUAGES[0];

  // Đóng menu khi click ra ngoài
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const changeLanguage = (code) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div className="lang-switcher" ref={ref}>
      <button
        type="button"
        className="lang-switcher-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("common.language")}
        title={t("common.language")}
      >
        <GlobeIcon />
        <span className="lang-switcher-code">{currentLang.short}</span>
        <CaretIcon open={open} />
      </button>

      {open && (
        <div className="lang-switcher-menu" role="listbox" aria-label={t("common.language")}>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              role="option"
              aria-selected={lang.code === currentLang.code}
              className={`lang-switcher-option${
                lang.code === currentLang.code ? " is-active" : ""
              }`}
              onClick={() => changeLanguage(lang.code)}
            >
              <span>{lang.label}</span>
              {lang.code === currentLang.code && <CheckIcon />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
