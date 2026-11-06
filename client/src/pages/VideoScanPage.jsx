import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import SessionTopbar from "../components/session/SessionTopbar";
import useSquatTracker from "../hooks/useSquatTracker";
import useHoldTracker from "../hooks/useHoldTracker";
import useVideoPoseScan from "../hooks/useVideoPoseScan";
import trackingApi from "../api/tracking";
import { addWorkoutResult } from "../utils/workoutResults";
import "./VideoScanPage.css";

const MAX_BYTES = 500 * 1024 * 1024;
const ACCEPTED_EXT = /\.(mp4|mov|webm)$/i;

/**
 * Màn "Video scan" — member chọn file video để hệ thống quét và chấm điểm.
 *
 * Đây là luồng thay thế cho việc quay camera trực tiếp: member tập sẵn, quay
 * bằng điện thoại rồi tải file lên đây. Hệ thống quét pose bằng MediaPipe và
 * chấm điểm y hệt luồng camera.
 *
 * Sau khi quét xong -> màn kết quả tổng hợp của buổi tập.
 */
export default function VideoScanPage() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const exerciseCode = state?.exerciseCode || "";
  const exerciseName = state?.exerciseName || "Exercise";
  const isHold = state?.category === "HOLD";
  const targetReps = state?.reps ?? 12;
  const targetSeconds = state?.durationSeconds ?? 30;
  const sets = state?.sets ?? 3;
  /** Các bài còn lại trong buổi tập (nếu có). */
  const nextExercises = useMemo(
    () => (Array.isArray(state?.nextExercises) ? state.nextExercises : []),
    [state?.nextExercises],
  );

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  /** Timer chuyển màn sau khi quét xong — cần clear khi unmount. */
  const navTimerRef = useRef(null);
  const [file, setFile] = useState(null);
  const [objectUrl, setObjectUrl] = useState("");
  /** Thời lượng video (giây) — dùng làm "elapsed" khi tính kết quả set. */
  const [duration, setDuration] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState("pick"); // pick | scanning | done

  const {
    onFrame: onSquatFrame,
    getSetResults,
    getFormIssues,
    getIssueStats,
  } = useSquatTracker({
    targetReps,
    maxSets: sets,
    // Video lấy mẫu ở tần số thấp hơn camera nên cần giữ đáy ít frame hơn
    // để vẫn tính đúng rep sạch (tương đương ~130ms ở đáy).
    deepFramesRequired: 2,
  });
  const {
    onFrame: onHoldFrame,
    getSetResults: getHoldSetResults,
    getFormIssues: getHoldFormIssues,
    getIssueStats: getHoldIssueStats,
  } = useHoldTracker({ targetSeconds, maxSets: sets });

  // Callback khung hình -> tracker đếm.
  const handleFrame = useCallback(
    (landmarks, timestamp) => {
      if (isHold) {
        onHoldFrame(landmarks, timestamp);
      } else {
        onSquatFrame(landmarks);
      }
    },
    [isHold, onHoldFrame, onSquatFrame],
  );

  const { status: modelStatus, error: modelError, progress, framesScanned, scan } =
    useVideoPoseScan({ videoRef, onFrame: handleFrame });

  // Dọn object URL cũ + huỷ timer chuyển màn nếu member rời trang sớm.
  useEffect(() => {
    return () => {
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  /** Chọn file video hợp lệ. */
  const acceptFile = useCallback(
    (picked) => {
      if (!picked) return;
      if (!ACCEPTED_EXT.test(picked.name)) {
        toast.error("Only MP4, MOV or WebM videos are supported.");
        return;
      }
      if (picked.size > MAX_BYTES) {
        toast.error("Video must be 500 MB or smaller.");
        return;
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setFile(picked);
      setObjectUrl(URL.createObjectURL(picked));
      setDuration(0);
      setPhase("pick");
    },
    [objectUrl],
  );

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      setDragOver(false);
      const picked = event.dataTransfer.files?.[0];
      if (picked) acceptFile(picked);
    },
    [acceptFile],
  );

  /** Bắt đầu quét video. */
  const startScan = useCallback(async () => {
    if (!file) return;
    setPhase("scanning");
    // Chờ video nạp xong rồi mới seek từng frame.
    const video = await waitForVideo(videoRef.current);
    if (video) {
      const value = video.duration;
      setDuration(Number.isFinite(value) ? value : 0);
    }
    await scan();
  }, [file, scan]);

  /**
   * Sau khi quét xong: lưu kết quả lên server, tích lũy vào buổi tập rồi
   * đưa member tới màn kết quả.
   */
  const finishScan = useCallback(async () => {
    // Bài REPS: thời lượng set = thời lượng video (không phải thời gian
    // thực đã trôi qua lúc quét). Bài HOLD: tracker tự cộng theo timestamp
    // của từng frame nên không cần override.
    const allSets = isHold
      ? getHoldSetResults()
      : getSetResults(duration || undefined);

    // Video có thể chứa nhiều set -> tách theo mục tiêu của bài.
    const validSets = splitIntoSets(
      allSets,
      isHold ? targetSeconds : targetReps,
      isHold,
    ).filter((set) =>
      isHold ? (set.totalSeconds || 0) > 0 : (set.totalReps || 0) > 0,
    );

    const valid = validSets.reduce(
      (sum, set) => sum + (isHold ? set.cleanSeconds || 0 : set.cleanReps || 0),
      0,
    );
    const total = validSets.reduce(
      (sum, set) => sum + (isHold ? set.totalSeconds || 0 : set.totalReps || 0),
      0,
    );
    const invalid = Math.max(0, total - valid);
    const computedAccuracy = total > 0 ? Math.round((valid / total) * 100) : 0;

    // Gửi lên server để lưu session và mở khóa progression rules.
    let serverAccuracy = null;
    if (validSets.length > 0 && exerciseCode) {
      try {
        const response = await trackingApi.submitExerciseResult({
          exerciseCode,
          sets: validSets,
        });
        serverAccuracy = response?.cleanRate != null ? Number(response.cleanRate) : null;
      } catch (err) {
        console.error("Failed to submit scanned result:", err);
        toast.error("Couldn't save this scan. Please try again.");
      }
    }

    const finalAccuracy = serverAccuracy ?? computedAccuracy;

    // Tích lũy vào buổi tập để màn kết quả cuối tổng hợp.
    addWorkoutResult({
      exerciseCode,
      exerciseName,
      isHold,
      accuracy: finalAccuracy,
      validCount: valid,
      invalidCount: invalid,
      totalCount: total,
      formIssues: isHold ? getHoldFormIssues() : getFormIssues(),
      issueStats: isHold ? getHoldIssueStats() : getIssueStats(),
      source: "video",
    });

    setPhase("done");

    // Còn bài sau trong buổi tập -> sang bài tiếp theo (member chọn tiếp bằng
    // camera hay upload video). Màn kết quả CHỈ mở 1 lần, sau bài cuối cùng.
    const next = nextExercises[0];
    const target = next
      ? {
          path: `/exercises/${encodeURIComponent(next.exerciseCode)}`,
          state: {
            sets: next.sets,
            reps: next.reps,
            durationSeconds: next.durationSeconds,
            restSeconds: next.restSeconds,
            index: (state?.index ?? 1) + 1,
            total: state?.total ?? 1,
            nextExercises: nextExercises.slice(1),
          },
        }
      : { path: "/session/result", state: undefined };

    // Chừa 1 nhịp để member thấy trạng thái "quét xong" trước khi chuyển màn.
    navTimerRef.current = setTimeout(() => {
      navTimerRef.current = null;
      navigate(target.path, { replace: true, state: target.state });
    }, 1200);
  }, [
    isHold,
    exerciseCode,
    exerciseName,
    duration,
    targetReps,
    targetSeconds,
    getHoldSetResults,
    getSetResults,
    getHoldFormIssues,
    getFormIssues,
    getHoldIssueStats,
    getIssueStats,
    nextExercises,
    navigate,
    state,
  ]);

  // Khi quét xong -> tự lưu kết quả rồi mở màn kết quả.
  useEffect(() => {
    if (phase === "scanning" && modelStatus === "done") {
      finishScan();
    }
  }, [phase, modelStatus, finishScan]);

  const isScanning = phase === "scanning";
  const scanProgress = progress;

  return (
    <div className="vs-page">
      <SessionTopbar onBack={() => navigate(-1)} />

      <main className="vs-body">
        <header className="vs-head">
          <h1 className="vs-title">Scan video · {exerciseName}</h1>
          <p className="vs-subtitle">
            Upload a video of your set — the AI pose scanner will grade your form.
          </p>
        </header>

        <div className="vs-grid">
          {/* ---------------------------------------------- cột trái: video */}
          <section className="vs-card vs-video-card">
            {objectUrl ? (
              <video
                ref={videoRef}
                src={objectUrl}
                playsInline
                muted
                className="vs-video"
                controls={!isScanning}
                onLoadedMetadata={(event) => {
                  const value = event.currentTarget.duration;
                  setDuration(Number.isFinite(value) ? value : 0);
                }}
              />
            ) : (
              <div
                className={`vs-dropzone${dragOver ? " is-over" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <svg viewBox="0 0 40 28" aria-hidden="true" className="vs-dropzone-icon">
                  <path d="M10 22a7 7 0 0 1-.5-13.98A10 10 0 0 1 29 7a8 8 0 0 1 1 15" />
                  <path d="M20 26V14M15 18l5-5 5 5" />
                </svg>
                <p className="vs-dropzone-title">Drop your video here</p>
                <p className="vs-dropzone-hint">MP4, MOV, WebM · max 500 MB</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
              hidden
              onChange={(event) => {
                const picked = event.target.files?.[0];
                if (picked) acceptFile(picked);
                event.target.value = "";
              }}
            />

            <div className="vs-actions">
              <button
                type="button"
                className="vs-btn vs-btn--ghost"
                disabled={isScanning}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" />
                </svg>
                {file ? "Choose another file" : "Browse file"}
              </button>

              {phase !== "done" && (
                <button
                  type="button"
                  className="vs-btn vs-btn--primary"
                  disabled={!file || isScanning || modelStatus === "loading"}
                  onClick={startScan}
                >
                  {isScanning
                    ? `Scanning… ${scanProgress}%`
                    : modelStatus === "loading"
                      ? "Loading AI model…"
                      : "Start scanning"}
                </button>
              )}
            </div>

            {isScanning && (
              <div className="vs-progress">
                <div className="vs-progress-track">
                  <span className="vs-progress-fill" style={{ width: `${scanProgress}%` }} />
                </div>
                <p className="vs-progress-text">
                  {modelStatus === "loading"
                    ? "Loading the AI pose model…"
                    : `Scanning frame ${framesScanned}… ${scanProgress}%`}
                </p>
              </div>
            )}

            {phase === "done" && (
              <div className="vs-progress" role="status">
                <p className="vs-progress-text">
                  {nextExercises.length > 0
                    ? `Scan complete — moving to ${
                        nextExercises[0].exerciseName
                      }…`
                    : "Scan complete — opening your workout result…"}
                </p>
              </div>
            )}

            {modelStatus === "error" && (
              <p className="vs-error" role="alert">
                {modelError}
              </p>
            )}
          </section>

          {/* ------------------------------------------- cột phải: hướng dẫn */}
          <aside className="vs-side">
            <section className="vs-card vs-tip-card">
              <p className="vs-tip-title">How the scan works</p>
              <ul className="vs-tip-list">
                <li>Film your set from the side so your whole body is visible.</li>
                <li>Keep the camera still and make sure you are in frame.</li>
                <li>The AI grades every rep — clean reps count towards your progress.</li>
                <li>When the scan finishes you'll see your workout result.</li>
              </ul>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

/**
 * Tách kết quả gộp thành nhiều set theo mục tiêu của bài.
 *
 * Tracker chỉ theo dõi 1 set đang chạy, nhưng video member quay có thể chứa
 * nhiều set liên tiếp. Tách ra để server đánh giá đúng số set đạt (progression
 * rules yêu cầu đủ số set).
 *
 * @param {Array} sets - kết quả tracker trả về
 * @param {number} target - số rep (bài REPS) hoặc số giây (bài HOLD) mỗi set
 * @param {boolean} isHold
 * @returns {Array<{ totalReps:number, cleanReps:number, totalSeconds:number, cleanSeconds:number }>}
 */
function splitIntoSets(sets, target, isHold) {
  if (!Array.isArray(sets) || sets.length === 0) return [];
  if (!target || target <= 0) return sets;

  const total = isHold
    ? sets.reduce((sum, set) => sum + (set.totalSeconds || 0), 0)
    : sets.reduce((sum, set) => sum + (set.totalReps || 0), 0);
  const clean = isHold
    ? sets.reduce((sum, set) => sum + (set.cleanSeconds || 0), 0)
    : sets.reduce((sum, set) => sum + (set.cleanReps || 0), 0);

  if (total <= target) return sets;

  // Số set đầy đủ + (nếu dư) một set cuối chưa đủ.
  const fullSets = Math.floor(total / target);
  const remainder = total % target;

  // Phần "sạch" được phân bổ theo tỉ lệ clean của toàn bộ video.
  const cleanRatio = total > 0 ? clean / total : 0;
  const result = [];

  for (let index = 0; index < fullSets; index += 1) {
    const setTotal = target;
    const setClean = Math.round(setTotal * cleanRatio);
    result.push(
      isHold
        ? { totalReps: 0, cleanReps: 0, totalSeconds: setTotal, cleanSeconds: setClean }
        : { totalReps: setTotal, cleanReps: setClean, totalSeconds: 0, cleanSeconds: 0 },
    );
  }

  if (remainder > 0) {
    const setClean = Math.round(remainder * cleanRatio);
    result.push(
      isHold
        ? { totalReps: 0, cleanReps: 0, totalSeconds: remainder, cleanSeconds: setClean }
        : { totalReps: remainder, cleanReps: setClean, totalSeconds: 0, cleanSeconds: 0 },
    );
  }

  return result;
}

/**
 * Chờ video nạp xong metadata để seek được.
 * @param {HTMLVideoElement | null} video
 * @returns {Promise<HTMLVideoElement | null>}
 */
function waitForVideo(video) {
  if (!video) return Promise.resolve(null);
  if (video.readyState >= 1) return Promise.resolve(video);
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener("loadedmetadata", done);
      resolve(video);
    };
    video.addEventListener("loadedmetadata", done, { once: true });
  });
}
