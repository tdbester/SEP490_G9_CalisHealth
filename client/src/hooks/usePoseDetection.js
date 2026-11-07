/**
 * Hook đọc pose từ camera bằng MediaPipe PoseLandmarker.
 *
 * Mỗi frame trả về 33 landmark (MediaPipe BlazePose) kèm visibility.
 * Hook chỉ lo "nhận diện", phần đếm reps / chấm form nằm ở useSquatTracker.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import i18n from "../i18n";

/** Model heavy để đạt độ ổn định 30 FPS trên laptop tầm trung. */
const MODEL_URL = "/models/pose_landmarker_heavy.task";
const WASM_PATH = "/wasm";

/** Chỉ số landmark của BlazePose (33 điểm). */
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

/** Đường nối để vẽ skeleton. */
export const POSE_CONNECTIONS = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [0, 11],
  [0, 12],
];

/**
 * Góc của ba điểm A-B-C (độ, 0 = thẳng, 180 = gập ngược).
 * Dùng để tính góc đầu gối, hông…
 */
export function angleBetween(a, b, c) {
  if (!a || !b || !c) return null;
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (!mag) return null;
  const cos = Math.min(1, Math.max(-1, dot / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Điểm giữa của hai landmark (dùng cho hông). */
export function midpoint(a, b) {
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Khởi tạo PoseLandmarker một lần và chạy vòng lặp detect trên video.
 *
 * @param {React.RefObject<HTMLVideoElement>} videoRef
 * @param {boolean} enabled - chỉ detect khi true (đang tập)
 * @param {(landmarks: Array, timestamp: number) => void} onFrame
 */
export default function usePoseDetection(videoRef, enabled, onFrame) {
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [error, setError] = useState("");
  const [fps, setFps] = useState(0);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const onFrameRef = useRef(onFrame);
  const frameTimesRef = useRef([]);

  // Giữ callback mới nhất mà không restart vòng lặp.
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  // Nạp model một lần.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus("loading");
      try {
        // Dynamic import: MediaPipe (~10MB wasm) chỉ nạp khi member mở màn tracking.
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
            err?.message
              || i18n.t("member:videoScan.poseModelLoadFailed"),
          );
          setStatus("error");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Giải phóng khi component unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  // Vòng lặp detect.
  useEffect(() => {
    if (!enabled || status !== "ready") return undefined;

    let lastVideoTime = -1;

    const detect = () => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;

      if (!video || !landmarker || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        try {
          const result = landmarker.detectForVideo(video, performance.now());
          const landmarks = result?.landmarks?.[0] || [];

          // Tính FPS đã làm tròn.
          const now = performance.now();
          frameTimesRef.current = frameTimesRef.current.filter((t) => now - t < 1000);
          frameTimesRef.current.push(now);
          setFps(frameTimesRef.current.length);

          onFrameRef.current(landmarks, now);
        } catch (err) {
          console.error("Pose detection failed:", err);
        }
      }

      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      frameTimesRef.current = [];
    };
  }, [enabled, status, videoRef]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  return { status, error, fps, stop };
}
