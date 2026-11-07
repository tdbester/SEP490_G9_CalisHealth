/**
 * Trạng thái bật/tắt giọng điều khiển (voice coach) của hệ thống AI.
 *
 * Member có thể tắt giọng ở màn tracking; nếu chỉ giữ trong React state thì khi
 * chuyển sang màn khác (màn nghỉ giữa các set, bài tiếp theo, màn kết quả...)
 * trạng thái sẽ bị reset về "đang bật" — gây khó chịu khi họ muốn tập im lặng.
 *
 * Vì vậy trạng thái được lưu trong `sessionStorage`:
 *  - Sống sót qua việc chuyển màn (điều hướng trong cùng tab).
 *  - Sống sót qua F5.
 *  - Tự xoá khi đóng tab -> buổi tập mới sẽ bật giọng trở lại.
 *
 * Trạng thái chỉ được đổi khi member bấm nút bật/tắt, không tự đổi theo màn.
 */
import { useCallback, useEffect, useState } from "react";

/** Key lưu trạng thái tắt giọng ("1" = đang tắt, "0" = đang bật). */
const VOICE_MUTED_KEY = "calishealth.voice.muted";

/** Các subscriber được thông báo khi trạng thái tắt/bật thay đổi. */
const listeners = new Set();

/**
 * Member đang tắt giọng hay không.
 * @returns {boolean} true nếu đang tắt
 */
export function isVoiceMuted() {
  try {
    return sessionStorage.getItem(VOICE_MUTED_KEY) === "1";
  } catch {
    // Bộ nhớ đầy / private mode -> coi như đang bật.
    return false;
  }
}

/**
 * Lưu trạng thái tắt/bật giọng và báo cho các màn đang mở cập nhật.
 * @param {boolean} muted
 */
export function setVoiceMuted(muted) {
  try {
    sessionStorage.setItem(VOICE_MUTED_KEY, muted ? "1" : "0");
  } catch {
    // Bộ nhớ đầy / private mode -> bỏ qua, vẫn chạy được.
  }
  listeners.forEach((listener) => listener(muted));
}

/**
 * Đảo trạng thái tắt/bật giọng.
 * @returns {boolean} trạng thái mới sau khi đảo (true = đang tắt)
 */
export function toggleVoiceMuted() {
  const next = !isVoiceMuted();
  setVoiceMuted(next);
  return next;
}

/**
 * Hook đọc trạng thái tắt giọng và tự cập nhật khi có màn khác đổi trạng thái.
 *
 * @returns {[boolean, () => boolean]} `[đang tắt, hàm đảo trạng thái]`
 */
export function useVoiceMuted() {
  const [muted, setMuted] = useState(isVoiceMuted);

  useEffect(() => {
    const listener = (next) => setMuted(next);
    listeners.add(listener);
    // Đồng bộ lại lúc mount: có thể đã bị đổi từ màn trước đó.
    setMuted(isVoiceMuted());
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = !isVoiceMuted();
    setVoiceMuted(next);
    return next;
  }, []);

  return [muted, toggle];
}
