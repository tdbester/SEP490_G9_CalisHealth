import { useTranslation } from "react-i18next";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import { SUPPORTED_LANGUAGES, changeLanguage } from "../i18n";
import "./LanguageSwitcher.css";

/**
 * Nút đổi ngôn ngữ.
 *
 * Dùng chung cho mọi vai trò: gắn ở thanh sidebar trên đầu (member, admin,
 * content manager) và ở đầu các trang đăng nhập / đăng ký.
 *
 * Chọn ngôn ngữ sẽ đổi ngay toàn bộ màn hình đang mở, không cần tải lại trang.
 */
export default function LanguageSwitcher({ variant = "icon", className = "" }) {
  const { t, i18n: instance } = useTranslation();
  const current = instance.resolvedLanguage || instance.language || "vi";

  const handleChange = (event) => {
    const next = event.target.value;
    changeLanguage(next);
  };

  if (variant === "select") {
    return (
      <label
        className={`lang-select ${className}`.trim()}
        title={t("common.changeLanguage")}
      >
        <LanguageRoundedIcon className="lang-select__icon" />
        <select
          className="lang-select__control"
          value={current}
          onChange={handleChange}
          aria-label={t("common.changeLanguage")}
        >
          {SUPPORTED_LANGUAGES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.short}
            </option>
          ))}
        </select>
      </label>
    );
  }

  // Mặc định: nút tròn bấm để mở menu các ngôn ngữ.
  return (
    <div className={`lang-switcher ${className}`.trim()}>
      <button
        type="button"
        className="lang-switcher__button"
        aria-label={t("common.changeLanguage")}
        title={t("common.changeLanguage")}
      >
        <LanguageRoundedIcon />
        <span className="lang-switcher__short">
          {SUPPORTED_LANGUAGES.find((item) => item.code === current)?.short || "VI"}
        </span>
      </button>
      <div className="lang-switcher__menu" role="menu">
        {SUPPORTED_LANGUAGES.map((item) => (
          <button
            key={item.code}
            type="button"
            role="menuitem"
            className={`lang-switcher__option${
              item.code === current ? " is-active" : ""
            }`}
            onClick={() => changeLanguage(item.code)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
