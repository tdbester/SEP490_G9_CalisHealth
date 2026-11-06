import { useVoiceMuted } from "../../utils/voiceCoach";
import "./VoiceToggleButton.css";

/**
 * Nút bật/tắt giọng điều khiển của hệ thống AI.
 *
 * Dùng chung cho màn tracking và màn nghỉ giữa các set để member có thể tắt
 * giọng ở bất kỳ màn nào. Trạng thái được lưu trong `sessionStorage` nên vẫn
 * giữ nguyên khi chuyển màn — chỉ mở lại khi member bấm nút.
 */
export default function VoiceToggleButton({ className = "vt-icon-btn" }) {
  const [muted, toggle] = useVoiceMuted();

  return (
    <button
      type="button"
      className={`${className}${muted ? " is-muted" : ""}`}
      aria-label={muted ? "Enable voice coach" : "Mute voice coach"}
      aria-pressed={!muted}
      title={muted ? "Voice coach off" : "Voice coach on"}
      onClick={() => {
        const next = toggle();
        if (next) {
          // Tắt giọng -> dừng luôn câu đang phát.
          window.speechSynthesis?.cancel();
        }
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3a4 4 0 0 0-4 4v5a4 4 0 0 0 8 0V7a4 4 0 0 0-4-4Z" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="1.6" />
        {/* Gạch chéo khi tắt voice -> dễ phân biệt trạng thái on/off. */}
        {muted && (
          <path
            d="M4 4l16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </svg>
    </button>
  );
}
