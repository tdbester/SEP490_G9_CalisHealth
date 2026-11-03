import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import usePoseDetection, { POSE_CONNECTIONS, POSE_LANDMARKS } from "../hooks/usePoseDetection";
import useSquatTracker, { findKneeRule } from "../hooks/useSquatTracker";
import trackingApi from "../api/tracking";
import api from "../api/client";
import { toast } from "react-toastify";
import "./PoseTrackingPage.css";

const DEFAULT_REPS = 12;
const DEFAULT_SETS = 3;

/** Bảng màu lấy từ Figma (frame 549:683). */
const COLORS = {
  bg: "#0d0b1a",
  panel: "#111024",
  panelBorder: "#241d45",
  accent: "#c084fc",
  accentSoft: "#a855f7",
  mint: "#34d399",
  rose: "#fb7185",
  amber: "#fbbf24",
  text: "#ffffff",
  muted: "#b4aedb",
  dim: "#8b85b8",
};

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Key lưu cấu hình phiên để sống sót khi F5 (location.state mất khi reload). */
const SESSION_CONFIG_KEY = "calishealth.tracking.session";

/**
 * Đọc cấu hình bài tập được truyền từ màn Exercise detail.
 *
 * `location.state` mất khi người dùng F5 -> fallback sang sessionStorage để
 * màn tracking vẫn biết exerciseCode (cần cho bước submit kết quả).
 */
function useSessionConfig() {
  const { state } = useLocation();

  const [saved] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_CONFIG_KEY) || "null");
    } catch {
      return null;
    }
  });

  const config = {
    exerciseCode: state?.exerciseCode || saved?.exerciseCode || "",
    exerciseName: state?.exerciseName || saved?.exerciseName || "Squat",
    reps: state?.reps || saved?.reps || DEFAULT_REPS,
    sets: state?.sets || saved?.sets || DEFAULT_SETS,
    index: state?.index || saved?.index || 1,
    total: state?.total || saved?.total || 1,
    restSeconds: state?.restSeconds ?? saved?.restSeconds ?? 60,
  };

  // Lưu lại mỗi khi có config mới (đi qua màn Exercise detail).
  useEffect(() => {
    if (!state?.exerciseCode) return;
    try {
      sessionStorage.setItem(SESSION_CONFIG_KEY, JSON.stringify(state));
    } catch {
      // Bộ nhớ đầy / private mode -> bỏ qua, vẫn chạy được.
    }
  }, [state]);

  return config;
}

/**
 * Đọc 1 frame landmark và vẽ skeleton lên canvas.
 * Canvas đặt đúng tỉ lệ với video nên không bị méo.
 */
function drawPose(canvas, landmarks, width, height) {
  if (!canvas || !width || !height) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);

  if (!landmarks || landmarks.length < 29) return;

  // Đường nối xương.
  ctx.lineWidth = 4;
  ctx.strokeStyle = COLORS.accent;
  ctx.lineCap = "round";
  POSE_CONNECTIONS.forEach(([a, b]) => {
    const p1 = landmarks[a];
    const p2 = landmarks[b];
    if (!p1 || !p2) return;
    ctx.beginPath();
    ctx.moveTo(p1.x * width, p1.y * height);
    ctx.lineTo(p2.x * width, p2.y * height);
    ctx.stroke();
  });

  // Điểm khớp: xanh lá = chân, hồng = đầu/vai.
  landmarks.forEach((point, index) => {
    const isLowerBody = index >= POSE_CONNECTIONS.length; // giữ đơn giản, tô đều
    ctx.beginPath();
    ctx.arc(point.x * width, point.y * height, isLowerBody ? 4 : 5, 0, Math.PI * 2);
    ctx.fillStyle = index <= 10 ? COLORS.rose : COLORS.mint;
    ctx.fill();
  });
}

export default function PoseTrackingPage() {
  const navigate = useNavigate();
  const config = useSessionConfig();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarksRef = useRef([]);

  const [cameraState, setCameraState] = useState("loading"); // loading | on | denied | error
  const [running, setRunning] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [resting, setResting] = useState(false);
  const [restLeft, setRestLeft] = useState(0);
  const [speakEnabled, setSpeakEnabled] = useState(true);
  const [kneeRule, setKneeRule] = useState(null);
  const [landmarkCount, setLandmarkCount] = useState(0);
  const kneeTipRef = useRef(null);
  const [streak, setStreak] = useState(null);
  const [initials, setInitials] = useState("HV");

  // Streak và initials lấy từ tài khoản đang đăng nhập.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return;
      const user = JSON.parse(raw);
      const name = user?.fullName || user?.name || "";
      const letters = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("");
      if (letters) setInitials(letters);
    } catch {
      // Giữ initials mặc định.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const today = new Date();
    api
      .get("/member/day-streak", {
        params: { year: today.getFullYear(), month: today.getMonth() + 1 },
      })
      .then(({ data }) => {
        if (!cancelled) setStreak(data?.currentStreak ?? 0);
      })
      .catch(() => {
        if (!cancelled) setStreak(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { state: squat, onFrame, reset, nextSet, getSetResults } = useSquatTracker({
    targetReps: config.reps,
    kneeRule,
  });

  // Lấy cấu hình chấm form do Content Manager khai báo cho bài này.
  useEffect(() => {
    if (!config.exerciseCode) return undefined;
    let cancelled = false;
    api
      .get("/member/form-rules", { params: { exerciseCode: config.exerciseCode } })
      .then(({ data }) => {
        if (!cancelled) setKneeRule(findKneeRule(data?.rules));
      })
      .catch(() => {
        // Không có rule thì dùng ngưỡng mặc định trong tracker.
      });
    return () => {
      cancelled = true;
    };
  }, [config.exerciseCode]);

  // ------------------------------------------------------------------ camera
  useEffect(() => {
    let stream;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState("error");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 1280, height: 720 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraState("on");
      } catch (err) {
        setCameraState(err?.name === "NotAllowedError" ? "denied" : "error");
      }
    }

    start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ------------------------------------------------------------------ voice
  const speak = useCallback(
    (text) => {
      if (!speakEnabled || !text || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    },
    [speakEnabled],
  );

  const lastSpokenRef = useRef("");
  useEffect(() => {
    if (!squat.lastFeedback) return;
    if (squat.lastFeedback === lastSpokenRef.current) return;
    lastSpokenRef.current = squat.lastFeedback;
    speak(squat.lastFeedback);
  }, [squat.lastFeedback, speak]);

  // ------------------------------------------------------------------ detect
  const handleFrame = useCallback(
    (landmarks) => {
      landmarksRef.current = landmarks;
      setLandmarkCount(landmarks?.length || 0);

      // Tooltip góc đầu gối bám theo vị trí đầu gối trên khung hình.
      const video = videoRef.current;
      const tipEl = kneeTipRef.current;
      if (tipEl && landmarks?.length >= 29) {
        const leftKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
        const rightKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
        const useLeft = (leftKnee?.visibility ?? 0) >= (rightKnee?.visibility ?? 0);
        const knee = useLeft ? leftKnee : rightKnee;
        if (knee) {
          // Khung hình được lật ngược (scaleX(-1)) nên đảo lại toạ độ X.
          tipEl.style.left = `${(1 - knee.x) * 100}%`;
          tipEl.style.top = `${knee.y * 100}%`;
        }
      }

      if (resting) return;
      onFrame(landmarks);
    },
    [onFrame, resting],
  );

  const { status: modelStatus, error: modelError, fps } = usePoseDetection(
    videoRef,
    running && cameraState === "on" && !resting,
    handleFrame,
  );

  // Vẽ skeleton lên canvas mỗi frame.
  useEffect(() => {
    let raf;
    const draw = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas) {
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        drawPose(canvas, landmarksRef.current, width, height);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ------------------------------------------------------------------ timer
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  // Đếm nghỉ giữa các set.
  useEffect(() => {
    if (!resting) return undefined;
    const timer = setInterval(() => {
      setRestLeft((prev) => {
        if (prev <= 1) {
          setResting(false);
          nextSet(config.reps);
          speak("Next set. Let's go.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resting, nextSet, config.reps, speak]);

  // ------------------------------------------------------------------ actions
  const togglePause = () => {
    setRunning((prev) => {
      if (prev) {
        speak("Paused.");
        return false;
      }
      speak("Resumed.");
      return true;
    });
  };

  const stopSession = async () => {
    window.speechSynthesis?.cancel();
    setRunning(false);

    // Gửi số đếm từng set lên server để tính % clean và mở khóa progression rules.
    if (config.exerciseCode) {
      const sets = getSetResults();
      const totalReps = sets.reduce((sum, set) => sum + (set.totalReps || 0), 0);
      if (totalReps > 0) {
        try {
          await trackingApi.submitExerciseResult({ exerciseCode: config.exerciseCode, sets });
          toast.success("Session saved. Nice work!");
        } catch (err) {
          console.error("Failed to submit exercise result:", err);
          toast.error("Couldn't save this session. Please try again.");
        }
      } else {
        toast("No reps were recorded, so there's nothing to save yet.");
      }
      try {
        sessionStorage.removeItem(SESSION_CONFIG_KEY);
      } catch {
        // Không quan trọng.
      }
    }

    navigate(-1);
  };

  const startRest = () => {
    setRunning(false);
    setResting(true);
    setRestLeft(config.restSeconds);
    speak(`Rest for ${config.restSeconds} seconds.`);
  };

  const formTone = squat.formScore >= 80 ? "good" : squat.formScore >= 60 ? "warn" : "bad";

  return (
    <div className="pt-page">
      <div className="pt-topbar">
        <div className="pt-brand">
          <span className="pt-brand-mark" aria-hidden="true" />
          <span className="pt-brand-text">CalisHealth</span>
        </div>
        <div className="pt-topbar-center">
          <span className="pt-url">localhost:3000/session/tracking</span>
        </div>
        <div className="pt-topbar-right">
          <span className="pt-streak">
            <span className="pt-streak-flame" aria-hidden="true" />
            {streak ?? "-"} days
          </span>
          <button
            type="button"
            className="pt-icon-btn"
            aria-label={speakEnabled ? "Mute voice coach" : "Enable voice coach"}
            onClick={() => setSpeakEnabled((prev) => !prev)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3a4 4 0 0 0-4 4v5a4 4 0 0 0 8 0V7a4 4 0 0 0-4-4Z" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
          <button type="button" className="pt-avatar" aria-label="Account">
            {initials}
          </button>
          <button
            type="button"
            className="pt-exit-btn"
            aria-label="Exit workout"
            onClick={stopSession}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="pt-body">
        {/* ---------------------------------------------------- camera panel */}
        <section className="pt-stage">
          <div className="pt-video-wrap">
            <video ref={videoRef} className="pt-video" muted playsInline />
            <canvas ref={canvasRef} className="pt-canvas" />

            {/* Badge LIVE + số liệu tracking nằm đè trên video (Figma 549:707). */}
            <div className="pt-stage-overlay-head">
              <span className="pt-live">
                <span className="pt-live-dot" aria-hidden="true" />
                LIVE
              </span>
              <span className="pt-stage-meta">
                {landmarkCount} landmarks · {fps} FPS
              </span>
            </div>

            {/* Tooltip góc khớp bám theo đầu gối (Figma: "Knee 94°"). */}
            {squat.kneeAngle != null && (
              <span className="pt-joint-tip" ref={kneeTipRef}>
                Knee {squat.kneeAngle}°
              </span>
            )}

            {cameraState !== "on" && (
              <div className="pt-overlay">
                <p>
                  {cameraState === "loading"
                    ? "Starting camera…"
                    : cameraState === "denied"
                      ? "Camera access was blocked. Allow it in your browser settings."
                      : "Couldn't start the camera."}
                </p>
              </div>
            )}

            {modelStatus === "loading" && cameraState === "on" && (
              <div className="pt-overlay pt-overlay--soft">
                <p>Loading AI pose model…</p>
              </div>
            )}

            {modelStatus === "error" && (
              <div className="pt-overlay">
                <p>{modelError}</p>
              </div>
            )}

            {resting && (
              <div className="pt-overlay pt-overlay--rest">
                <p className="pt-rest-label">Rest</p>
                <p className="pt-rest-timer">{restLeft}s</p>
              </div>
            )}
          </div>
        </section>

        {/* ---------------------------------------------------- stats panel */}
        <aside className="pt-panel">
          <section className="pt-card">
            <p className="pt-card-label">{config.exerciseName} · Reps</p>
            <p className="pt-reps">{String(squat.setCleanReps).padStart(2, "0")}</p>
            <p className="pt-set">
              / {config.reps} reps · Set {squat.setNumber} · {formatClock(elapsed)}
            </p>
          </section>

          <section className="pt-card">
            <div className="pt-card-row">
              <p className="pt-card-label">Form</p>
              <p className={`pt-form-score is-${formTone}`}>{squat.formScore}%</p>
            </div>
            <div className="pt-progress">
              <span
                className={`pt-progress-fill is-${formTone}`}
                style={{ width: `${squat.formScore}%` }}
              />
            </div>
            <p className="pt-tip">
              {squat.lastFeedback || kneeRule?.feedbackMessage || "Keep your knees aligned with your toes"}
            </p>
          </section>

          <section className="pt-card pt-card--voice">
            <div className="pt-voice-head">
              <span className="pt-voice-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3a4 4 0 0 0-4 4v5a4 4 0 0 0 8 0V7a4 4 0 0 0-4-4Z" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </span>
              <p className="pt-card-label">Voice coach</p>
            </div>
            <p className="pt-voice-text">
              {squat.lastFeedback
                ? squat.lastFeedback
                : kneeRule?.feedbackMessage || "Your left knee is caving in — push it outward."}
            </p>
          </section>

          <div className="pt-metrics">
            <section className="pt-metric">
              <p className="pt-metric-label">Knee angle</p>
              <p className="pt-metric-value">{squat.kneeAngle ?? "--"}°</p>
            </section>
            <section className="pt-metric">
              <p className="pt-metric-label">Reps left</p>
              <p className="pt-metric-value">{squat.repsLeft}</p>
            </section>
          </div>

          <div className="pt-actions">
            <button type="button" className="pt-btn pt-btn--pause" onClick={togglePause}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
              {running ? "Pause" : "Resume"}
            </button>
            <button type="button" className="pt-btn pt-btn--stop" onClick={stopSession}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="1.5" />
              </svg>
              Stop
            </button>
          </div>

          <button type="button" className="pt-rest-btn" onClick={startRest}>
            Start rest timer ({config.restSeconds}s)
          </button>
        </aside>
      </div>
    </div>
  );
}
