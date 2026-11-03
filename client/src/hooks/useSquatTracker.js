/**
 * Đếm reps và chấm form cho bài squat dựa trên landmark từ MediaPipe.
 *
 * - Rep: góc đầu gối đi qua ngưỡng "đứng thẳng" → xuống dưới ngưỡng "sâu"
 *   → quay lại trên = 1 rep hợp lệ. Nếu không quay lại trên ngưỡng thì rep đó
 *   tính là không sạch (invalid).
 * - Form: % = số frame mà góc đầu gối nằm trong dải "đủ sâu" chia tổng frame
 *   có người trong khung hình.
 * - Ngưỡng góc có thể override bằng form rules do Content Manager khai báo.
 *
 * Hook này thuần tuý về logic, không gọi camera.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { POSE_LANDMARKS, angleBetween, midpoint } from "./usePoseDetection";

/** Góc đầu gối (độ) khi đứng thẳng — trên ngưỡng này coi như đã lên hết. */
const STANDING_ANGLE = 160;
/** Góc đầu gối khi xuống sâu — dưới ngưỡng này coi như đã xuống đủ. */
const DEEP_ANGLE = 100;
/** Cần giữ đủ sâu liên tục bao nhiêu frame mới tính là rep sạch. */
const DEEP_FRAMES_REQUIRED = 4;

/**
 * Ngưỡng visibility tối thiểu để tin landmark.
 *
 * MediaPipe đôi khi trả về 33 điểm "ảo" (hallucination) khi khung hình không
 * có người — visibility thấp nhưng vẫn đủ độ dài mảng. Nếu không lọc, các
 * điểm này tạo ra góc đầu gối ngẫu nhiên và đếm reps sai. Dưới ngưỡng này
 * coi như không có người trong khung hình.
 */
const MIN_VISIBILITY = 0.5;

/** Landmark có đủ tin cậy để dùng không. */
function isVisible(point) {
  return !!point && (point.visibility ?? 0) >= MIN_VISIBILITY;
}

/**
 * Tìm rule của khớp KNEE trong danh sách rule từ server.
 * @returns {{ angleThreshold: number, romDepth: number, feedbackMessage: string } | null}
 */
export function findKneeRule(formRules) {
  if (!Array.isArray(formRules)) return null;
  return (
    formRules.find(
      (rule) => String(rule?.joint || "").toUpperCase() === "KNEE",
    ) || null
  );
}

const PHASE = {
  STANDING: "standing",
  DESCENDING: "descending",
  BOTTOM: "bottom",
  ASCENDING: "ascending",
};

/**
 * @param {object} options
 * @param {number} options.targetReps - số reps mục tiêu của set hiện tại
 */
export default function useSquatTracker({ targetReps = 12, kneeRule = null } = {}) {
  const [state, setState] = useState({
    phase: PHASE.STANDING,
    reps: 0,
    cleanReps: 0,
    /** Số reps của set hiện tại (Figma hiển thị "08 / 12 reps · Set 2"). */
    setReps: 0,
    setCleanReps: 0,
    kneeAngle: null,
    formScore: 100,
    setNumber: 1,
    repsLeft: targetReps,
    lastFeedback: "",
    feedbackTone: "good",
    completedSets: [],
    setStartedAt: Date.now(),
  });

  // Ref giữ trạng thái để xử lý trong vòng lặp frame mà không re-render.
  const ref = useRef({
    phase: PHASE.STANDING,
    reps: 0,
    cleanReps: 0,
    setReps: 0,
    setCleanReps: 0,
    kneeAngle: null,
    deepFrames: 0,
    totalFrames: 0,
    goodFrames: 0,
    setNumber: 1,
    targetReps,
    kneeRule,
    lastFeedback: "",
    feedbackTone: "good",
    completedSets: [],
    setStartedAt: Date.now(),
  });

  // Rule có thể đến sau (server trả về bất đồng bộ) -> cập nhật vào ref.
  useEffect(() => {
    ref.current.kneeRule = kneeRule;
  }, [kneeRule]);

  const reset = useCallback((newTargetReps) => {
    ref.current = {
      phase: PHASE.STANDING,
      reps: 0,
      cleanReps: 0,
      setReps: 0,
      setCleanReps: 0,
      kneeAngle: null,
      deepFrames: 0,
      totalFrames: 0,
      goodFrames: 0,
      setNumber: 1,
      targetReps: newTargetReps ?? ref.current.targetReps,
      kneeRule: ref.current.kneeRule,
      lastFeedback: "",
      feedbackTone: "good",
      completedSets: [],
      setStartedAt: Date.now(),
    };
    setState({
      phase: PHASE.STANDING,
      reps: 0,
      cleanReps: 0,
      setReps: 0,
      setCleanReps: 0,
      kneeAngle: null,
      formScore: 100,
      setNumber: 1,
      repsLeft: ref.current.targetReps,
      lastFeedback: "",
      feedbackTone: "good",
    });
  }, []);

  /**
   * Bắt đầu set mới (sau khi nghỉ) — giữ tổng reps của bài để hiển thị.
   * Set vừa rồi được ghi vào completedSets để gửi lên server.
   */
  const nextSet = useCallback((newTargetReps) => {
    const current = ref.current;
    const seconds = Math.round((Date.now() - current.setStartedAt) / 1000);
    const formRatio = current.totalFrames
      ? current.goodFrames / current.totalFrames
      : 1;
    const totalSeconds = current.totalFrames > 0 ? Math.max(1, seconds) : seconds;
    const finishedSet = {
      totalReps: current.setReps,
      cleanReps: current.setCleanReps,
      totalSeconds,
      cleanSeconds: Math.round(totalSeconds * formRatio),
    };

    ref.current = {
      ...current,
      phase: PHASE.STANDING,
      deepFrames: 0,
      totalFrames: 0,
      goodFrames: 0,
      setNumber: current.setNumber + 1,
      targetReps: newTargetReps ?? current.targetReps,
      lastFeedback: "",
      feedbackTone: "good",
      completedSets: [...current.completedSets, finishedSet],
      setStartedAt: Date.now(),
    };
    setState({
      phase: PHASE.STANDING,
      reps: current.reps,
      cleanReps: current.cleanReps,
      setReps: 0,
      setCleanReps: 0,
      kneeAngle: current.kneeAngle,
      formScore: 100,
      setNumber: current.setNumber + 1,
      repsLeft: (newTargetReps ?? current.targetReps) - 0,
      lastFeedback: "",
      feedbackTone: "good",
    });
  }, []);

  /**
   * Lấy kết quả tất cả set đã hoàn thành (bao gồm set đang tập dở).
   * @returns {Array<{ totalReps: number, cleanReps: number, totalSeconds: number, cleanSeconds: number }>}
   */
  const getSetResults = useCallback(() => {
    const current = ref.current;
    const results = [...current.completedSets];
    const elapsed = Math.round((Date.now() - current.setStartedAt) / 1000);
    // Set chạy dưới 1 giây vẫn phải ghi nhận ít nhất 1 giây để server
    // không từ chối dữ liệu (bài HOLD cần thời lượng > 0).
    const seconds = current.totalFrames > 0 ? Math.max(1, elapsed) : elapsed;
    const formRatio = current.totalFrames ? current.goodFrames / current.totalFrames : 1;
    results.push({
      totalReps: current.setReps,
      cleanReps: current.setCleanReps,
      totalSeconds: seconds,
      cleanSeconds: Math.round(seconds * formRatio),
    });
    return results;
  }, []);

  /**
   * Xử lý một frame landmark.
   * @param {Array} landmarks - 33 điểm từ MediaPipe
   */
  const onFrame = useCallback((landmarks) => {
    const current = ref.current;

    if (!landmarks || landmarks.length < 29) {
      // Không thấy người trong khung -> báo "bước vào khung hình".
      current.lastFeedback = "Step into the frame so I can track you.";
      current.feedbackTone = "warn";
      setState((prev) => ({ ...prev, lastFeedback: current.lastFeedback, feedbackTone: "warn" }));
      return;
    }

    const lm = landmarks;
    const leftHip = lm[POSE_LANDMARKS.LEFT_HIP];
    const rightHip = lm[POSE_LANDMARKS.RIGHT_HIP];
    const leftKnee = lm[POSE_LANDMARKS.LEFT_KNEE];
    const rightKnee = lm[POSE_LANDMARKS.RIGHT_KNEE];
    const leftAnkle = lm[POSE_LANDMARKS.LEFT_ANKLE];
    const rightAnkle = lm[POSE_LANDMARKS.RIGHT_ANKLE];

    // Chọn chân có visibility cao hơn để góc đầu gối ổn định hơn.
    const useLeft = (leftKnee?.visibility ?? 0) >= (rightKnee?.visibility ?? 0);
    const knee = useLeft ? leftKnee : rightKnee;
    const hip = useLeft ? leftHip : rightHip;
    const ankle = useLeft ? leftAnkle : rightAnkle;

    // Không đủ tin cậy -> coi như không có người, không tính rep.
    if (!isVisible(knee) || !isVisible(hip) || !isVisible(ankle)) {
      current.lastFeedback = "Step into the frame so I can track you.";
      current.feedbackTone = "warn";
      setState((prev) => ({ ...prev, lastFeedback: current.lastFeedback, feedbackTone: "warn" }));
      return;
    }

    const kneeAngle = angleBetween(hip, knee, ankle);
    if (kneeAngle == null) return;

    const shoulderMid = midpoint(lm[POSE_LANDMARKS.LEFT_SHOULDER], lm[POSE_LANDMARKS.RIGHT_SHOULDER]);
    const hipMid = midpoint(leftHip, rightHip);
    // Góc thân: đứng thẳng ~180°, gật ngang ~90°. Dùng để cảnh báo lưng.
    const torsoAngle = angleBetween(shoulderMid, hipMid, midpoint(knee, ankle));

    current.totalFrames += 1;
    current.kneeAngle = kneeAngle;

    // Ngưỡng có thể override bằng form rule do Content Manager khai báo.
    const rule = current.kneeRule;
    const deepAngle = rule?.romDepth != null ? DEEP_ANGLE + (rule.romDepth - 60) : DEEP_ANGLE;
    const standingAngle = rule?.angleThreshold != null
      ? Math.min(180, Math.max(deepAngle + 30, rule.angleThreshold))
      : STANDING_ANGLE;

    const isDeep = kneeAngle <= deepAngle;
    const isStanding = kneeAngle >= standingAngle;
    if (isDeep) current.goodFrames += 1;

    let feedback = current.lastFeedback;
    let tone = current.feedbackTone;

    switch (current.phase) {
      case PHASE.STANDING:
        if (!isStanding && kneeAngle < standingAngle - 12) {
          current.phase = PHASE.DESCENDING;
        }
        break;

      case PHASE.DESCENDING:
        if (isDeep) {
          current.deepFrames += 1;
          if (current.deepFrames >= DEEP_FRAMES_REQUIRED) {
            current.phase = PHASE.BOTTOM;
          }
        } else if (isStanding) {
          // Đi lên lại mà chưa chạm ngưỡng "sâu" -> vẫn tính 1 rep,
          // nhưng không sạch (độ sâu không đạt).
          current.reps += 1;
          current.setReps += 1;
          feedback = "Rep counted, but go deeper and keep your chest up.";
          tone = "warn";
          current.phase = PHASE.STANDING;
          current.deepFrames = 0;
        }
        break;

      case PHASE.BOTTOM:
        if (isDeep) current.deepFrames += 1;
        if (isStanding) {
          // Hoàn thành 1 rep: sạch nếu đã đủ sâu và lưng không gật quá nhiều.
          const isClean = current.deepFrames >= DEEP_FRAMES_REQUIRED && (torsoAngle == null || torsoAngle > 115);
          current.reps += 1;
          current.setReps += 1;
          if (isClean) {
            current.cleanReps += 1;
            current.setCleanReps += 1;
            feedback = "Nice rep. Keep that depth.";
            tone = "good";
          } else {
            feedback = "Rep counted, but go deeper and keep your chest up.";
            tone = "warn";
          }
          current.phase = PHASE.ASCENDING;
          current.deepFrames = 0;
        }
        break;

      case PHASE.ASCENDING:
        if (isStanding) current.phase = PHASE.STANDING;
        break;

      default:
        break;
    }

    // Cảnh báo lưng gật khi đang ở dưới cùng.
    if (
      current.phase === PHASE.BOTTOM &&
      torsoAngle != null &&
      torsoAngle < 105 &&
      feedback !== "Keep your chest up — don't fold over."
    ) {
      feedback = "Keep your chest up — don't fold over.";
      tone = "warn";
    }

    current.lastFeedback = feedback;
    current.feedbackTone = tone;

    const formScore = current.totalFrames
      ? Math.round((current.goodFrames / current.totalFrames) * 100)
      : 100;

    setState({
      phase: current.phase,
      reps: current.reps,
      cleanReps: current.cleanReps,
      setReps: current.setReps,
      setCleanReps: current.setCleanReps,
      kneeAngle: Math.round(kneeAngle),
      formScore,
      setNumber: current.setNumber,
      repsLeft: Math.max(0, current.targetReps - current.setCleanReps),
      lastFeedback: feedback,
      feedbackTone: tone,
    });
  }, []);

  return { state, onFrame, reset, nextSet, getSetResults };
}
