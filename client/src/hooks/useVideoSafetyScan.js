/**
 * Kiểm tra video demo của member bằng MediaPipe Pose.
 *
 * Mục tiêu: chặn video không thể hiện bài tập trước khi gửi lên duyệt —
 * video rác, ảnh tĩnh, hoặc nội dung không phù hợp.
 *
 * Quy tắc kiểm tra:
 *   1. Phải có người trong khung hình (MediaPipe nhận diện được cơ thể).
 *   2. Phải có chuyển động rõ ràng (vị trí cơ thể thay đổi giữa các frame),
 *      loại bỏ ảnh tĩnh / video dừng.
 *   3. Thời lượng trong khoảng hợp lý.
 *
 * Hook chạy hoàn toàn trên client: file video được nạp vào một thẻ <video>
 * tạm, quét bằng mô hình pose landmarker, rồi giải phóng tài nguyên.
 *
 * Hook trả về mã lý do (reason) để UI tự dịch theo ngôn ngữ hiện tại.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import i18n from "../i18n";

/** Model heavy để ổn định trên laptop tầm trung. */
const MODEL_URL = "/models/pose_landmarker_heavy.task";
const WASM_PATH = "/wasm";

/** Số frame lấy mẫu mỗi giây video. */
const SAMPLE_FPS = 6;

/** Tổng khoảng cách landmark tích luỹ tối thiểu để coi là có chuyển động. */
const TOTAL_MOTION_THRESHOLD = 0.02;

/** Số frame liên tiếp không thấy người tối đa trước khi kết luận video không có người. */
const MAX_MISSING_FRAMES = 12;

/** Thời lượng tối thiểu (giây) — video quá ngắn không thể thể hiện một bài tập. */
const MIN_DURATION_SECONDS = 2;

/** Thời lượng tối đa (giây) — khớp giới hạn upload của server. */
const MAX_DURATION_SECONDS = 180;

/**
 * @param {object} options
 * @param {File|null} options.file - video cần kiểm tra
 */
export default function useVideoSafetyScan({ file }) {
  const [status, setStatus] = useState("idle"); // idle | scanning | passed | failed
  const [progress, setProgress] = useState(0);
  const [reason, setReason] = useState(""); // mã lý do: no-person | no-motion | ...
  const [duration, setDuration] = useState(0);

  const landmarkerRef = useRef(null);
  const loadPromiseRef = useRef(null);
  const cancelRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelRef.current = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  /** Nạp model pose một lần, dùng lại cho các lần quét sau. */
  const ensureModel = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    if (!loadPromiseRef.current) {
      loadPromiseRef.current = (async () => {
        const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
        const landmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        landmarkerRef.current = landmarker;
        return landmarker;
      })();
    }
    return loadPromiseRef.current;
  }, []);

  /**
   * Quét video và trả kết quả.
   * @returns {Promise<{ passed: boolean, reason?: string }>}
   */
  const scan = useCallback(async () => {
    if (!file) return { passed: false, reason: "no-file" };

    cancelRef.current = false;
    setStatus("scanning");
    setProgress(0);
    setReason("");

    let video = null;
    let url = null;

    const fail = (code) => {
      if (mountedRef.current) {
        setStatus("failed");
        setReason(code);
      }
      return { passed: false, reason: code };
    };

    try {
      video = document.createElement("video");
      url = URL.createObjectURL(file);
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.src = url;

      await waitForMetadata(video);

      const totalDuration = Number.isFinite(video.duration) ? video.duration : 0;
      if (mountedRef.current) setDuration(Math.round(totalDuration));

      if (totalDuration < MIN_DURATION_SECONDS) {
        return fail("too-short");
      }
      if (totalDuration > MAX_DURATION_SECONDS) {
        return fail("too-long");
      }

      const landmarker = await ensureModel();
      if (cancelRef.current) return { passed: false, reason: "cancelled" };

      const step = 1 / SAMPLE_FPS;
      let lastTimestamp = 0;
      let missingFrames = 0;
      let poseFrames = 0;
      let totalMotion = 0;
      let previous = null;

      for (let time = 0; time <= totalDuration; time += step) {
        if (cancelRef.current) return { passed: false, reason: "cancelled" };

        await seekTo(video, time);

        const timestamp = Math.max(lastTimestamp + 1, Math.round(time * 1000));
        let landmarks = [];
        try {
          const result = landmarker.detectForVideo(video, timestamp);
          lastTimestamp = timestamp;
          landmarks = result?.landmarks?.[0] || [];
        } catch (err) {
          console.error("Pose detection failed while scanning video:", err);
        }

        if (landmarks.length > 0) {
          poseFrames += 1;
          missingFrames = 0;
          if (previous) {
            totalMotion += motionDistance(previous, landmarks);
          }
          previous = landmarks;
        } else {
          missingFrames += 1;
          previous = null;
          if (missingFrames > MAX_MISSING_FRAMES) {
            return fail("no-person");
          }
        }

        if (mountedRef.current) {
          setProgress(Math.min(100, Math.round((time / totalDuration) * 100)));
        }
        // Cho trình duyệt kịp render thanh tiến độ.
        await nextTick();
      }

      if (poseFrames === 0) {
        return fail("no-person");
      }

      // Không có chuyển động -> ảnh tĩnh hoặc video dừng.
      if (totalMotion < TOTAL_MOTION_THRESHOLD) {
        return fail("no-motion");
      }

      if (mountedRef.current) {
        setStatus("passed");
        setProgress(100);
      }
      return { passed: true };
    } catch (err) {
      console.error("Video safety scan failed:", err);
      return fail("unreadable");
    } finally {
      if (video) {
        video.removeAttribute("src");
        video.load();
      }
      if (url) URL.revokeObjectURL(url);
    }
  }, [file, ensureModel]);

  /** Cho phép chạy lại khi đổi file. */
  const reset = useCallback(() => {
    setStatus("idle");
    setProgress(0);
    setReason("");
    setDuration(0);
  }, []);

  return { status, progress, reason, duration, scan, reset };
}

/** Chờ browser đọc xong metadata (duration, kích thước). */
function waitForMetadata(video) {
  return new Promise((resolve, reject) => {
    const done = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      reject(new Error(i18n.t("member:videoScan.unreadableFile")));
    };
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", done);
      video.removeEventListener("error", failed);
    };
    video.addEventListener("loadedmetadata", done);
    video.addEventListener("error", failed);
    // Video đã có metadata sẵn (cache) thì event không bắn nữa.
    if (video.readyState >= 1) done();
  });
}

/** Seek tới `time` và chờ frame được vẽ xong. */
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
    setTimeout(finish, 600);
  });
}

/**
 * Khoảng cách trung bình giữa hai bộ landmark (đã chuẩn hoá theo kích thước
 * khung hình) — dùng làm đại lượng "chuyển động".
 */
function motionDistance(a, b) {
  const size = Math.min(a.length, b.length);
  if (!size) return 0;
  let total = 0;
  for (let i = 0; i < size; i += 1) {
    const dx = (a[i].x || 0) - (b[i].x || 0);
    const dy = (a[i].y || 0) - (b[i].y || 0);
    total += dx * dx + dy * dy;
  }
  return total / size;
}

/** Nhường luồng cho browser render. */
function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
