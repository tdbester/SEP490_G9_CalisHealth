import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { normalizeItemId } from "../../api/favorites";
import { useFavorites } from "../../context/FavoritesContext";
import { isGuestSession, loginPath } from "../../utils/authState";

/** Ngôi sao rỗng — chưa yêu thích. */
export function StarIcon({ className = "h-4 w-4", filled = false }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

/**
 * Nút đánh dấu sao (⭐) cho một mục trong thư viện.
 *
 * Nút luôn chỉ hiện icon ngôi sao — tên bài tập/workout chỉ nằm trong
 * `aria-label`/`title` để trình đọc màn hình đọc được, tránh làm nút
 * tràn ra ngoài khung khi đặt cạnh tiêu đề.
 *
 * @param {string} itemType SYSTEM_EXERCISE | MEMBER_EXERCISE | SYSTEM_WORKOUT | MEMBER_WORKOUT
 * @param {number|string} itemId id của bài tập / workout gốc
 * @param {function} onClick callback khi bấm (dùng cho card tự điều hướng)
 * @param {string} label tên mục — chỉ dùng cho aria-label (tuỳ chọn)
 */
export default function FavoriteButton({
  itemType,
  itemId,
  onClick,
  label,
  className = "",
  size = "md",
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isFavorite, toggle, pending } = useFavorites();
  const normalizedId = normalizeItemId(itemId);
  // Id không phải số (vd dữ liệu mẫu có slug) thì server sẽ từ chối —
  // ta ẩn/disable nút sao thay vì gửi request chắc chắn lỗi.
  const usable = normalizedId !== null;
  const active = usable && isFavorite(itemType, normalizedId);
  const key = `${itemType}:${normalizedId}`;
  const busy = Boolean(pending[key]);

  const handleClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (busy || !usable) return;
    // GUEST chưa đăng nhập thì không đánh dấu sao được — mời đăng nhập.
    if (isGuestSession()) {
      toast.info(t("member.library.loginRequiredDetail"));
      navigate(loginPath(window.location.pathname + window.location.search));
      return;
    }
    await toggle(itemType, normalizedId);
    if (onClick) onClick(event);
  };

  const iconSize = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  const ariaLabel = active
    ? t("member.favorites.removeAria", { title: label || "" })
    : t("member.favorites.addAria", { title: label || "" });

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      title={ariaLabel}
      disabled={busy || !usable}
      className={`favorite-button inline-flex shrink-0 items-center justify-center rounded-full border transition-all ${
        active
          ? "border-amber-400/70 bg-amber-400/15 text-amber-300"
          : "border-[#3b2d68] bg-[#1a1436] text-[#8a82af] hover:border-amber-400/50 hover:text-amber-300"
      } ${size === "lg" ? "h-9 w-9" : "h-8 w-8"} ${busy ? "opacity-60" : ""} ${!usable ? "opacity-40" : ""} ${className}`}
    >
      <StarIcon className={iconSize} filled={active} />
    </button>
  );
}
