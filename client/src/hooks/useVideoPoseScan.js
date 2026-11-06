/**
 * Quét video bằng MediaPipe Pose để chấm điểm bài tập.
 *
 * Luồng: member chọn file video -> hook nạp model -> duyệt từng frame của
 * video (seek theo lưới thời gian) -> trả landmark cho tracker đếm.
 *
 * Vì quét bằng cách nhảy frame (seek) thay vì phát realtime, tốc độ nhanh
 * hơn thời gian thực: video 30 giây thường xong trong vài giây.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** Model heavy để đạt độ ổn định trên laptop tầm trung. */
const MODEL_URL = "/models/pose_landmarker_heavy.task";
const WASM_PATH = "/wasm";

/**
 * Số frame lấy mẫu mỗi giây video.
 *
 * 12 fps đủ chính xác cho đếm rep (mỗi rep kéo dài >= 1s) và giữ được trạng
 * thái "đáy" của rep (cần giữ đủ sâu nhiều frame mới tính rep sạch), đồng thời
 * không quá nặng cho CPU khi seek từng frame.
 */
const SAMPLE_FPS = 12;

/** Bước nhảy giữa các frame lấy mẫu (giây). */
const SAMPLE_STEP = 1 / SAMPLE_FPS;

/**
 * @param {object} options
 * @param {React.RefObject<HTMLVideoElement>} options.videoRef - video đang phát file đã chọn
 * @param {(landmarks: Array, timestamp: number) => void} options.onFrame
 */
export default function useVideoPoseScan({ videoRef, onFrame }) {
  const [status, setStatus] = useState("idle"); // idle | loading | ready | scanning | error | done
  const [error, setError] = useState("");
  /** 0-100 — tiến độ quét. */
  const [progress, setProgress] = useState(0);
  /** Số frame đã xử lý. */
  const [framesScanned, setFramesScanned] = useState(0);

  const landmarkerRef = useRef(null);
  /** Promise nạp model — dùng để chờ model sẵn sàng trước khi quét. */
  const loadPromiseRef = useRef(null);
  const onFrameRef = useRef(onFrame);
  const cancelRef = useRef(false);
  /**
   * Timestamp của lần detect cuối — MediaPipe chế độ VIDEO yêu cầu timestamp
   * tăng đơn điệu trên cùng một instance, kể cả khi member quét lại video khác.
   */
  const lastTimestampRef = useRef(0);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  // Nạp model một lần.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (landmarkerRef.current) {
        setStatus("ready");
        return;
      }
      setStatus("loading");
      try {
        const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
        if (cancelled) return;
        const landmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setStatus("ready");
      } catch (err) {
        console.error("Failed to load pose model:", err);
        if (!cancelled) {
          setError(
            err?.message ||
              "Couldn't load the AI pose model. Check your connection and retry.",
          );
          setStatus("error");
        }
      }
    }

    loadPromiseRef.current = load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Giải phóng khi component unmount.
  useEffect(() => {
    return () => {
      cancelRef.current = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  /**
   * Quét video từ đầu đến cuối.
   *
   * Duyệt theo lưới thời gian: seek tới từng mốc rồi chờ frame được vẽ
   * xong trước khi detect — tránh đọc frame cũ.
   */
  const scan = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    // Chờ model nạp xong (nếu đang nạp) rồi mới quét.
    if (loadPromiseRef.current) {
      await loadPromiseRef.current;
    }
    const landmarker = landmarkerRef.current;
    if (!landmarker) {
      setError("The AI pose model isn't ready yet. Please retry.");
      setStatus("error");
      return;
    }

    cancelRef.current = false;
    setStatus("scanning");
    setProgress(0);
    setFramesScanned(0);

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (duration <= 0) {
      setError("This video has no readable duration.");
      setStatus("error");
      return;
    }

    let scanned = 0;

    for (let time = 0; time <= duration; time += SAMPLE_STEP) {
      if (cancelRef.current) return;

      await seekTo(video, time);

      // Timestamp phải tăng đơn điệu cho chế độ VIDEO của MediaPipe.
      const timestamp = Math.max(lastTimestampRef.current + 1, Math.round(time * 1000));
      try {
        const result = landmarker.detectForVideo(video, timestamp);
        lastTimestampRef.current = timestamp;
        const landmarks = result?.landmarks?.[0] || [];
        scanned += 1;
        onFrameRef.current(landmarks, timestamp);
      } catch (err) {
        console.error("Pose detection failed while scanning video:", err);
      }

      setFramesScanned(scanned);
      setProgress(Math.min(100, Math.round((time / duration) * 100)));
      // Cho trình duyệt kịp render thanh tiến độ.
      await nextTick();
    }

    setProgress(100);
    setStatus("done");
  }, [videoRef]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    setStatus("idle");
  }, []);

  return { status, error, progress, framesScanned, scan, cancel };
}

/**
 * Seek video tới `time` và chờ frame mới được vẽ.
 * @param {HTMLVideoElement} video
 * @param {number} time
 */
function seekTo(video, time) {
  return new Promise((resolve) => {
    const target = Math.min(time, Math.max(0, (video.duration || 0) - 0.05));
    if (Math.abs(video.currentTime - target) < 0.001 && video.readyState >= 2) {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    const onSeeked = () => {
      // Chờ browser vẽ xong frame mới rồi mới detect.
      if (typeof video.requestVideoFrameCallback === "function") {
        video.requestVideoFrameCallback(() => finish());
      } else {
        requestAnimationFrame(() => requestAnimationFrame(finish));
      }
    };

    video.addEventListener("seeked", onSeeked, { once: true });
    try {
      video.currentTime = target;
    } catch {
      finish();
      return;
    }

    // Fallback: nếu 'seeked' không bắn (video ngắn, browser cache) thì vẫn tiến.
    setTimeout(finish, 600);
  });
}

/** Nhường luồng cho browser render (dùng để cập nhật thanh tiến độ). */
function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
