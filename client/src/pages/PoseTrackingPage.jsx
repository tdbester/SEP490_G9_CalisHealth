import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import usePoseDetection, { POSE_CONNECTIONS, POSE_LANDMARKS } from "../hooks/usePoseDetection";
import useSquatTracker, { findKneeRule } from "../hooks/useSquatTracker";
import useHoldTracker from "../hooks/useHoldTracker";
import trackingApi from "../api/tracking";
import api from "../api/client";
import SessionTopbar from "../components/session/SessionTopbar";
import VoiceToggleButton from "../components/session/VoiceToggleButton";
import { addWorkoutResult } from "../utils/workoutResults";
import { useVoiceMuted } from "../utils/voiceCoach";
import { toast } from "react-toastify";
import "./PoseTrackingPage.css";

const DEFAULT_REPS = 12;
const DEFAULT_SETS = 3;
/** Thời lượng giữ mặc định cho bài HOLD (plank) khi bài không khai báo. */
const DEFAULT_HOLD_SECONDS = 30;

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
/** Key lưu các set đã hoàn thành khi quay lại từ màn nghỉ ngơi. */
const COMPLETED_SETS_KEY = "calishealth.tracking.completedSets";
/** Key lưu số liệu set vừa xong để màn nghỉ hiển thị "Last set summary". */
const LAST_SET_KEY = "calishealth.tracking.lastSet";
/** Key lưu các lỗi form đã phát hiện — sống sót qua màn nghỉ để màn kết quả có đủ. */
const FORM_ISSUES_KEY = "calishealth.tracking.formIssues";

/** Đọc danh sách lỗi form đã lưu trong phiên. */
function readFormIssues() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(FORM_ISSUES_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

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
    // HOLD = bài tính theo thời gian giữ (plank), REPS = bài tính theo số lần.
    category: state?.category || saved?.category || "REPS",
    durationSeconds: state?.durationSeconds ?? saved?.durationSeconds ?? DEFAULT_HOLD_SECONDS,
    // Các bài còn lại trong buổi tập — dùng cho nút "Finish" sang bài tiếp theo.
    nextExercises: state?.nextExercises || saved?.nextExercises || [],
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
  const location = useLocation();
  const config = useSessionConfig();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarksRef = useRef([]);
  /** Cờ đánh dấu "vừa quay lại từ màn nghỉ" — dùng bởi effect khôi phục set. */
  const restReturnRef = useRef(Boolean(location.state?.fromRest));

  const [cameraState, setCameraState] = useState("loading"); // loading | on | denied | error
  const [running, setRunning] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  // Trạng thái tắt giọng được nhớ trong sessionStorage nên khi chuyển sang màn
  // nghỉ / bài tiếp theo / màn kết quả thì giọng vẫn tắt cho tới khi member
  // bấm nút bật lại.
  const [voiceMuted] = useVoiceMuted();
  const speakEnabled = !voiceMuted;
  const [kneeRule, setKneeRule] = useState(null);
  const [landmarkCount, setLandmarkCount] = useState(0);
  const kneeTipRef = useRef(null);

  /** Bài HOLD (plank) đếm theo thời gian giữ + set, không tính rep. */
  const isHold = config.category === "HOLD";
  const targetHoldSeconds = config.durationSeconds || DEFAULT_HOLD_SECONDS;

  const {
    state: squat,
    onFrame: onSquatFrame,
    restore,
    getSetResults,
    getFormIssues: getSquatFormIssues,
    getIssueStats: getSquatIssueStats,
  } = useSquatTracker({
    targetReps: config.reps,
    kneeRule,
    maxSets: config.sets,
  });
  const {
    state: hold,
    onFrame: onHoldFrame,
    restore: restoreHold,
    getSetResults: getHoldSetResults,
    getFormIssues: getHoldFormIssues,
    getIssueStats: getHoldIssueStats,
  } = useHoldTracker({ targetSeconds: targetHoldSeconds, maxSets: config.sets });

  /**
   * Khi chuyển sang bài tiếp theo (cùng route `/session/tracking`) component
   * không remount -> phải tự reset tracker, nếu không số set của bài trước
   * sẽ "mang theo" sang bài mới.
   */
  const lastExerciseRef = useRef(config.exerciseCode);
  useEffect(() => {
    if (lastExerciseRef.current === config.exerciseCode) return;
    lastExerciseRef.current = config.exerciseCode;
    if (isHold) {
      restoreHold([], 1);
    } else {
      restore([], config.reps, 1);
    }
    // Lỗi form của bài trước không áp dụng cho bài mới.
    try {
      sessionStorage.removeItem(FORM_ISSUES_KEY);
    } catch {
      // Không quan trọng.
    }
    setRunning(true);
  }, [config.exerciseCode, config.reps, isHold, restoreHold, restore]);

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
  const activeFeedback = isHold ? hold.lastFeedback : squat.lastFeedback;
  useEffect(() => {
    if (!activeFeedback) return;
    if (activeFeedback === lastSpokenRef.current) return;
    lastSpokenRef.current = activeFeedback;
    speak(activeFeedback);
  }, [activeFeedback, speak]);

  // ------------------------------------------------------------------ detect
  const handleFrame = useCallback(
    (landmarks, timestamp) => {
      landmarksRef.current = landmarks;
      setLandmarkCount(landmarks?.length || 0);

      // Tooltip góc khớp bám theo vị trí đầu gối trên khung hình.
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

      if (isHold) {
        onHoldFrame(landmarks, timestamp);
      } else {
        onSquatFrame(landmarks);
      }
    },
    [onSquatFrame, onHoldFrame, isHold],
  );

  const { status: modelStatus, error: modelError, fps } = usePoseDetection(
    videoRef,
    running && cameraState === "on",
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

  /**
   * Chuyển sang bài tiếp theo trong buổi tập.
   *
   * Xoá cấu hình phiên của bài vừa xong để bài mới bắt đầu từ set 1.
   * Nếu không còn bài nào -> mở màn kết quả tổng hợp của cả buổi tập.
   */
  const goToNextExercise = useCallback(() => {
    const next = config.nextExercises?.[0];
    try {
      sessionStorage.removeItem(SESSION_CONFIG_KEY);
      sessionStorage.removeItem(COMPLETED_SETS_KEY);
      sessionStorage.removeItem(LAST_SET_KEY);
      sessionStorage.removeItem(FORM_ISSUES_KEY);
    } catch {
      // Không quan trọng.
    }

    if (!next) {
      // Hết bài trong buổi tập -> màn kết quả tổng hợp (chỉ mở 1 lần cuối buổi).
      navigate("/session/result");
      return;
    }

    // Còn bài sau nữa -> danh sách bài tiếp theo được rút ngắn 1 phần tử.
    navigate("/session/tracking", {
      replace: true,
      state: {
        exerciseCode: next.exerciseCode,
        exerciseName: next.exerciseName,
        category: next.category || "REPS",
        sets: next.sets ?? DEFAULT_SETS,
        reps: next.reps ?? DEFAULT_REPS,
        durationSeconds: next.durationSeconds ?? DEFAULT_HOLD_SECONDS,
        restSeconds: next.restSeconds ?? 60,
        index: (config.index ?? 1) + 1,
        total: config.total ?? 1,
        nextExercises: config.nextExercises.slice(1),
      },
    });
  }, [config, navigate]);

  /**
   * "Finish" -> lưu kết quả bài này rồi chuyển sang bài tiếp theo.
   *
   * Chỉ khi bài này là bài CUỐI CÙNG của buổi tập thì mới mở màn kết quả
   * tổng hợp ("/session/result") — không mở màn kết quả cho từng bài.
   *
   * Member vẫn bấm được kể cả khi hệ thống không nhận được lần tập nào
   * (bài chưa có dữ liệu) — buổi tập vẫn tiếp tục được.
   */
  const finishExercise = async () => {
    window.speechSynthesis?.cancel();
    setRunning(false);
    await goToResult();
  };

  /**
   * Gửi kết quả từng set lên server để tính % clean và mở khóa progression rules,
   * đồng thời tích lũy kết quả của bài này vào buổi tập.
   *
   * Màn kết quả chỉ mở MỘT lần cuối buổi tập, nên mọi bài đều phải ghi kết quả
   * vào đây để màn đó tổng hợp được toàn bộ.
   *
   * @param {Array} [setsOverride] - dùng khi set đã hoàn thành ở màn nghỉ.
   * @returns {Promise<{accuracy:number, validCount:number, invalidCount:number, totalCount:number, formIssues:string[]}>}
   */
  const recordExerciseResult = useCallback(async (setsOverride) => {
    const allSets = setsOverride ?? (isHold ? getHoldSetResults() : getSetResults());
    // Set chưa có dữ liệu (bỏ dở) không gửi lên — server cần ít nhất 1 mẫu.
    const sets = allSets.filter((set) =>
      isHold ? (set.totalSeconds || 0) > 0 : (set.totalReps || 0) > 0,
    );

    const totalReps = sets.reduce((sum, set) => sum + (set.totalReps || 0), 0);
    const validReps = sets.reduce((sum, set) => sum + (set.cleanReps || 0), 0);
    // Bài HOLD đo theo giây -> "rep hợp lệ" là số giây giữ đúng tư thế.
    const totalSeconds = sets.reduce((sum, set) => sum + (set.totalSeconds || 0), 0);
    const cleanSeconds = sets.reduce((sum, set) => sum + (set.cleanSeconds || 0), 0);
    const formIssues = isHold ? getHoldFormIssues() : getSquatFormIssues();
    // Gộp với lỗi form đã phát hiện ở các set trước (đã đi qua màn nghỉ).
    const mergedIssues = Array.from(
      new Set([...readFormIssues(), ...formIssues]),
    );
    try {
      sessionStorage.setItem(FORM_ISSUES_KEY, JSON.stringify(mergedIssues));
    } catch {
      // Bộ nhớ đầy / private mode -> bỏ qua.
    }

    // Accuracy lấy từ server (% clean) nếu gửi được, không thì tính tại client.
    let accuracy = null;
    if (sets.length > 0) {
      try {
        const response = await trackingApi.submitExerciseResult({
          exerciseCode: config.exerciseCode,
          sets,
        });
        accuracy = response?.cleanRate != null ? Number(response.cleanRate) : null;
        toast.success("Session saved. Nice work!");
      } catch (err) {
        console.error("Failed to submit exercise result:", err);
        toast.error("Couldn't save this session. Please try again.");
      }
    } else {
      // Member chưa tập được lần nào — không chặn, chỉ báo nhẹ để họ biết
      // dữ liệu chưa có gì để lưu (vẫn skip sang set/bài tiếp theo được).
      toast(
        isHold
          ? "No hold time recorded — skipping to the next step."
          : "No reps recorded — skipping to the next step.",
      );
    }

    if (accuracy == null) {
      const counted = isHold ? totalSeconds : totalReps;
      const clean = isHold ? cleanSeconds : validReps;
      accuracy = counted > 0 ? Math.round((clean / counted) * 100) : 0;
    }

    // Tích lũy kết quả bài này vào buổi tập -> màn kết quả cuối tổng hợp.
    const validCount = isHold ? cleanSeconds : validReps;
    const totalCount = isHold ? totalSeconds : totalReps;
    addWorkoutResult({
      exerciseCode: config.exerciseCode,
      exerciseName: config.exerciseName,
      isHold,
      accuracy: Math.round(accuracy),
      validCount,
      invalidCount: Math.max(0, totalCount - validCount),
      totalCount,
      formIssues: mergedIssues,
      issueStats: isHold ? getHoldIssueStats() : getSquatIssueStats(),
      source: "camera",
    });

    return {
      accuracy: Math.round(accuracy),
      validCount,
      invalidCount: Math.max(0, totalCount - validCount),
      totalCount,
      formIssues: mergedIssues,
    };
  }, [isHold, getHoldSetResults, getSetResults, getHoldFormIssues, getSquatFormIssues,
      getHoldIssueStats, getSquatIssueStats, config.exerciseCode]);

  /**
   * Lưu kết quả bài hiện tại vào buổi tập, rồi điều hướng:
   *  - Còn bài sau -> sang bài tiếp theo (màn tracking).
   *  - Hết bài   -> mở màn kết quả tổng hợp của cả buổi tập.
   */
  const goToResult = useCallback(async () => {
    await recordExerciseResult();

    const next = config.nextExercises?.[0];
    if (next) {
      // Còn bài trong buổi tập -> chuyển sang bài tiếp theo, chưa mở màn kết quả.
      goToNextExercise();
      return;
    }

    // Bài cuối cùng -> mở màn kết quả tổng hợp của cả buổi tập.
    try {
      sessionStorage.removeItem(SESSION_CONFIG_KEY);
      sessionStorage.removeItem(COMPLETED_SETS_KEY);
      sessionStorage.removeItem(LAST_SET_KEY);
      sessionStorage.removeItem(FORM_ISSUES_KEY);
    } catch {
      // Không quan trọng.
    }

    navigate("/session/result");
  }, [recordExerciseResult, config, navigate, goToNextExercise]);

  /**
   * Gửi kết quả từng set lên server để tính % clean và mở khóa progression rules.
   * @param {Array} [setsOverride] - dùng khi set đã hoàn thành ở màn nghỉ.
   */
  const submitResults = async (setsOverride) => {
    if (!config.exerciseCode) return;
    await recordExerciseResult(setsOverride);
  };

  /**
   * Kết thúc phiên tập: lưu kết quả, dọn sessionStorage rồi rời màn.
   *
   * @param {string|number} [target] đích đến sau khi lưu (mặc định: màn trước)
   */
  const stopSession = async (target = -1) => {
    window.speechSynthesis?.cancel();
    setRunning(false);

    await submitResults();

    try {
      sessionStorage.removeItem(SESSION_CONFIG_KEY);
      sessionStorage.removeItem(COMPLETED_SETS_KEY);
      sessionStorage.removeItem(LAST_SET_KEY);
      sessionStorage.removeItem(FORM_ISSUES_KEY);
    } catch {
      // Không quan trọng.
    }

    navigate(target);
  };

  /**
   * Bấm logo CalisHealth -> về dashboard.
   *
   * Vẫn lưu kết quả phiên tập trước (giống nút Back) để không mất dữ liệu
   * những set đã tập được.
   */
  const goToDashboard = async () => {
    await stopSession("/");
  };

  /**
   * "Continue" -> màn đếm ngược nghỉ ngơi.
   *
   * Các set đã xong được truyền sang màn nghỉ (và lưu vào sessionStorage để
   * sống sót khi F5) để màn tracking khôi phục đúng số set khi quay lại —
   * nghỉ xong bắt đầu set tiếp theo chứ không phải set đầu tiên.
   *
   * Set number luôn được chặn ở `config.sets`: nếu hệ thống không nhận được
   * lần tập nào, member vẫn bấm Continue được nhưng bộ đếm không vượt quá
   * set cuối cùng.
   */
  const startRest = () => {
    // Giữ cả set đang tập dở: bấm "Continue" nghĩa là kết thúc set hiện tại
    // và sang set kế tiếp, nên số set phải tăng đúng 1.
    const finishedSets = isHold ? getHoldSetResults() : getSetResults();

    // Số liệu set vừa xong để màn nghỉ hiển thị "Last set summary".
    const lastSet = isHold
      ? {
          totalSeconds: Math.round(hold.holdSeconds),
          cleanSeconds: Math.round(hold.holdSeconds * (hold.formScore / 100)),
          formScore: hold.formScore,
          angle: hold.bodyAngle,
          feedback: hold.lastFeedback,
        }
      : {
          totalReps: squat.setReps,
          cleanReps: squat.setCleanReps,
          formScore: squat.formScore,
          angle: squat.kneeAngle,
          feedback: squat.lastFeedback,
        };

    try {
      sessionStorage.setItem(COMPLETED_SETS_KEY, JSON.stringify(finishedSets));
      sessionStorage.setItem(LAST_SET_KEY, JSON.stringify(lastSet));
    } catch {
      // Bộ nhớ đầy / private mode -> bỏ qua.
    }

    setRunning(false);
    speak(`Rest for ${config.restSeconds} seconds.`);

    navigate("/session/rest", {
      state: {
        restSeconds: config.restSeconds,
        exerciseName: config.exerciseName,
        // Số thứ tự set tiếp theo (chưa clamp) — màn nghỉ dùng để biết set
        // vừa xong là set cuối cùng hay không. Bản thân bộ đếm set luôn được
        // chặn ở `config.sets` nên không bao giờ hiện "set 4 of 3".
        nextSetNumber: currentSetNumber + 1,
        totalSets: config.sets,
        completedSets: finishedSets,
        lastSet,
        nextExercises: config.nextExercises,
      },
    });
  };

  /**
   * Quay lại từ màn nghỉ ngơi -> khôi phục các set đã hoàn thành rồi bắt đầu
   * set tiếp theo.
   *
   * `nextSetNumber` do màn nghỉ truyền xuống (đã clamp theo tổng số set).
   * Nếu đã hết set cuối (`finishWorkout`) thì lưu kết quả rồi chuyển sang
   * bài tiếp theo hoặc kết thúc buổi tập.
   */
  useEffect(() => {
    if (!restReturnRef.current) return;
    restReturnRef.current = false;

    let saved = location.state?.completedSets;
    if (!Array.isArray(saved)) {
      try {
        const raw = JSON.parse(sessionStorage.getItem(COMPLETED_SETS_KEY) || "[]");
        saved = Array.isArray(raw) ? raw : [];
      } catch {
        saved = [];
      }
    }

    const nextSetNumber = location.state?.nextSetNumber ?? config.sets;

    if (isHold) {
      restoreHold(saved, nextSetNumber);
    } else {
      restore(saved, config.reps, nextSetNumber);
    }

    if (location.state?.endWorkout) {
      // Member bấm "End workout" -> lưu kết quả rồi mở màn kết quả tổng hợp.
      submitResults(saved).finally(() => {
        try {
          sessionStorage.removeItem(SESSION_CONFIG_KEY);
          sessionStorage.removeItem(COMPLETED_SETS_KEY);
          sessionStorage.removeItem(LAST_SET_KEY);
          sessionStorage.removeItem(FORM_ISSUES_KEY);
        } catch {
          // Không quan trọng.
        }
        navigate("/session/result");
      });
      return;
    }

    if (location.state?.finishWorkout) {
      // Đã xong bài này -> gửi kết quả rồi chuyển sang bài tiếp theo (nếu có)
      // hoặc kết thúc buổi tập.
      submitResults(saved).finally(() => goToNextExercise());
      return;
    }

    setRunning(true);
  }, [isHold, config.reps, config.sets, restoreHold, restore, location.state?.completedSets, location.state?.nextSetNumber, location.state?.finishWorkout, location.state?.endWorkout, submitResults, goToNextExercise, navigate]);

  const formScore = isHold ? hold.formScore : squat.formScore;
  const formTone = formScore >= 80 ? "good" : formScore >= 60 ? "warn" : "bad";

  /** Số set đã xong (hiển thị "Set 2 / 3"). */
  const currentSetNumber = isHold ? hold.setNumber : squat.setNumber;

  /** Thông số chính: reps cho bài REPS, giây cho bài HOLD. */
  const primaryMetric = useMemo(() => {
    if (isHold) {
      const remaining = Math.max(0, targetHoldSeconds - Math.floor(hold.holdSeconds));
      return {
        label: `${config.exerciseName} · Hold`,
        value: formatClock(hold.holdSeconds),
        sub: `/ ${targetHoldSeconds}s · Set ${currentSetNumber} · ${formatClock(elapsed)}`,
        secondaryLabel: "Seconds left",
        secondaryValue: `${remaining}s`,
      };
    }
    return {
      label: `${config.exerciseName} · Reps`,
      value: String(squat.setCleanReps).padStart(2, "0"),
      sub: `/ ${config.reps} reps · Set ${currentSetNumber} · ${formatClock(elapsed)}`,
      secondaryLabel: "Reps left",
      secondaryValue: String(squat.repsLeft),
    };
  }, [isHold, config.exerciseName, config.reps, hold.holdSeconds, targetHoldSeconds, currentSetNumber, elapsed, squat.setCleanReps, squat.repsLeft]);

  return (
    <div className="pt-page">
      <SessionTopbar
        onBack={stopSession}
        onBrand={goToDashboard}
        right={
          <VoiceToggleButton className="pt-icon-btn" />
        }
      />

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
            {!isHold && squat.kneeAngle != null && (
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
          </div>
        </section>

        {/* ---------------------------------------------------- stats panel */}
        <aside className="pt-panel">
          <section className="pt-card">
            <p className="pt-card-label">{primaryMetric.label}</p>
            <p className="pt-reps">{primaryMetric.value}</p>
            <p className="pt-set">{primaryMetric.sub}</p>
          </section>

          <section className="pt-card">
            <div className="pt-card-row">
              <p className="pt-card-label">Form</p>
              <p className={`pt-form-score is-${formTone}`}>{formScore}%</p>
            </div>
            <div className="pt-progress">
              <span
                className={`pt-progress-fill is-${formTone}`}
                style={{ width: `${formScore}%` }}
              />
            </div>
            <p className="pt-tip">
              {activeFeedback || kneeRule?.feedbackMessage || "Keep your knees aligned with your toes"}
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
              {activeFeedback
                ? activeFeedback
                : kneeRule?.feedbackMessage || "Your left knee is caving in — push it outward."}
            </p>
          </section>

          <div className="pt-metrics">
            <section className="pt-metric">
              <p className="pt-metric-label">
                {isHold ? "Body angle" : "Knee angle"}
              </p>
              <p className="pt-metric-value">
                {isHold ? (hold.bodyAngle ?? "--") : (squat.kneeAngle ?? "--")}°
              </p>
            </section>
            <section className="pt-metric">
              <p className="pt-metric-label">{primaryMetric.secondaryLabel}</p>
              <p className="pt-metric-value">{primaryMetric.secondaryValue}</p>
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

          {/* Nút "Continue" -> màn đếm ngược nghỉ ngơi, xong quay lại set sau. */}
          <button type="button" className="pt-continue-btn" onClick={startRest}>
            Continue
            <span className="pt-continue-btn__hint">
              {currentSetNumber >= config.sets
                ? `Rest ${config.restSeconds}s, then continue`
                : `Rest ${config.restSeconds}s, then start set ${currentSetNumber + 1}`}
            </span>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M4 10h11M10.5 5.5L15 10l-4.5 4.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Nút "Finish" -> lưu kết quả bài này rồi sang bài tiếp theo.
              Chỉ bài cuối cùng mới mở màn kết quả tổng hợp của buổi tập. */}
          <button type="button" className="pt-finish-btn" onClick={finishExercise}>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M6 4l8 6-8 6V4z" fill="currentColor" />
              <path d="M15 4v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {config.nextExercises?.length > 0 ? "Finish exercise" : "Finish workout"}
          </button>
        </aside>
      </div>
    </div>
  );
}
