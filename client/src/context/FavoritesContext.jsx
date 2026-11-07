import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  FAVORITE_ITEM_TYPES,
  getFavorites,
  toggleFavorite,
} from "../api/favorites";
import { AUTH_SESSION_CHANGED } from "../utils/authSession";

const FavoritesContext = createContext(null);

/**
 * Yêu thích là tính năng riêng của MEMBER.
 * Các role khác (guest, ADMIN, CONTENT_MANAGER) không được gọi API này,
 * nên ta chỉ nạp dữ liệu khi phiên đăng nhập hợp lệ là MEMBER.
 */
function hasMemberSession() {
  try {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("jwt");
    if (!token) return false;
    const cached = localStorage.getItem("user");
    if (!cached) return false;
    return JSON.parse(cached)?.role === "MEMBER";
  } catch {
    return false;
  }
}

/**
 * Nguồn sự thật duy nhất cho trạng thái "đã đánh dấu sao".
 *
 * - Danh sách yêu thích được nạp 1 lần khi mount và dùng chung cho mọi màn,
 *   nên nút sao trên card và trên màn Favorites luôn khớp nhau.
 * - `toggle` cập nhật optimistic để phản hồi tức thì, rồi gọi API.
 */
export function FavoritesProvider({ children }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!hasMemberSession()) {
      setItems([]);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await getFavorites();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load favorites:", err);
      setError(err?.message || t("member.favorites.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let active = true;

    const load = () => {
      if (!hasMemberSession()) {
        setItems([]);
        setLoading(false);
        setError("");
        return;
      }
      setLoading(true);
      getFavorites()
        .then((data) => {
          if (active) setItems(Array.isArray(data) ? data : []);
        })
        .catch((err) => {
          console.error("Failed to load favorites:", err);
          if (active) setError(err?.message || t("member.favorites.loadFailed"));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    load();
    // Đăng nhập/đăng xuất diễn ra bằng client-side routing nên không có reload trang.
    // Sự kiện này giúp nạp lại yêu thích ngay sau khi đăng nhập.
    window.addEventListener(AUTH_SESSION_CHANGED, load);
    window.addEventListener("storage", load);

    return () => {
      active = false;
      window.removeEventListener(AUTH_SESSION_CHANGED, load);
      window.removeEventListener("storage", load);
    };
  }, [t]);

  /**
   * Khoá theo `itemType:itemId` để một mục không bị toggle 2 lần khi bấm nhanh.
   */
  const [pending, setPending] = useState({});

  /**
   * Các mục đang được thêm/bỏ ngôi sao (optimistic).
   * Ta giữ riêng khỏi `items` (dữ liệu thật từ server) để danh sách Favorites
   * không bao giờ hiện một card rỗng trong khoảnh khắc đang cập nhật.
   */
  const [optimistic, setOptimistic] = useState({});

  const isFavorite = useCallback(
    (itemType, itemId) => {
      const key = `${itemType}:${itemId}`;
      if (optimistic[key] !== undefined) {
        return optimistic[key];
      }
      return items.some(
        (item) => item.itemType === itemType && String(item.itemId) === String(itemId)
      );
    },
    [items, optimistic]
  );

  const toggle = useCallback(
    async (itemType, itemId) => {
      const key = `${itemType}:${itemId}`;
      if (pending[key]) return null;
      if (!hasMemberSession()) return null;
      setPending((current) => ({ ...current, [key]: true }));

      const wasFavorite = isFavorite(itemType, itemId);
      // Optimistic: đổi trạng thái ngôi sao ngay để phản hồi tức thì.
      setOptimistic((current) => ({ ...current, [key]: !wasFavorite }));

      try {
        const result = await toggleFavorite(itemType, itemId);
        if (!wasFavorite) {
          toast.success(t("member.favorites.added"));
        } else {
          toast.info(t("member.favorites.removed"));
        }
        await refresh();
        return result;
      } catch (err) {
        console.error("Failed to toggle favorite:", err);
        // Hoàn tác optimistic update.
        await refresh();
        toast.error(t("member.favorites.toggleFailed"));
        return null;
      } finally {
        setOptimistic((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
        setPending((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      }
    },
    [isFavorite, pending, refresh, t]
  );

  const value = useMemo(
    () => ({
      items,
      loading,
      error,
      refresh,
      isFavorite,
      toggle,
      pending,
      /** Danh sách item đã lọc theo loại nội dung. */
      byType: (itemType) => items.filter((item) => item.itemType === itemType),
      /** Bốn nhóm mà màn Favorites hiển thị. */
      groups: {
        systemExercises: items.filter(
          (item) => item.itemType === FAVORITE_ITEM_TYPES.SYSTEM_EXERCISE
        ),
        memberExercises: items.filter(
          (item) => item.itemType === FAVORITE_ITEM_TYPES.MEMBER_EXERCISE
        ),
        systemWorkouts: items.filter(
          (item) => item.itemType === FAVORITE_ITEM_TYPES.SYSTEM_WORKOUT
        ),
        memberWorkouts: items.filter(
          (item) => item.itemType === FAVORITE_ITEM_TYPES.MEMBER_WORKOUT
        ),
      },
    }),
    [items, loading, error, refresh, isFavorite, toggle, pending]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used inside a FavoritesProvider");
  }
  return context;
}

export default FavoritesProvider;
