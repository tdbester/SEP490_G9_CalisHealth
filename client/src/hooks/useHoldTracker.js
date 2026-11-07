/**
 * Đếm thời gian giữ cho bài HOLD (plank, wall handstand hold…).
 *
 * Bài HOLD được tính theo GIÂY và SET, không tính rep:
 *  - Mỗi set có một mục tiêu thời gian (targetSeconds).
 *  - Thời gian chỉ chạy khi người vẫn nằm trong khung hình; mất dấu người
 *    thì đồng hồ dừng (không tính phần không ai giữ).
 *  - Form = % số giây giữ đúng tư thế (thân thẳng) trên tổng số giây giữ.
 *
 * Hook này thuần tuý về logic, không gọi camera.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import i18n from "../i18n";
import { POSE_LANDMARKS, angleBetween, midpoint } from "./usePoseDetection";

/** Dịch chuỗi phản hồi / lỗi form theo ngôn ngữ hiện tại. */
const t = (key) => i18n.t(key);

/** Ngưỡng visibility tối thiểu để tin landmark. */
const MIN_VISIBILITY = 0.5;

/**
 * Góc thân (vai–hông–gối) tối thiểu để coi là giữ đúng tư thế.
 * Thân thẳng (plank, tay đứng) ~180°, gật hông ~120°.
 */
const STRAIGHT_BODY_ANGLE = 150;

/** Bước thời gian tối đa tính cho một frame (s) — chống nhảy số khi tab bị treo. */
const MAX_FRAME_DELTA = 0.5;

/** Nhãn lỗi form dùng ở màn kết quả (Figma 549:1175). */
export const HOLD_FORM_ISSUES = {
  get alignment() {
    return t("member:tracking.formIssues.alignment");
  },
};

/** Góc thân tối thiểu để coi là giữ đúng tư thế (độ). */
const STRAIGHT_BODY_TARGET = 150;

function isVisible(point) {
  return !!point && (point.visibility ?? 0) >= MIN_VISIBILITY;
}

/**
 * @param {object} options
 * @param {number} options.targetSeconds - số giây cần giữ trong 1 set
 * @param {number} options.maxSets - tổng số set của bài (chặn set counter vượt quá)
 */
export default function useHoldTracker({ targetSeconds = 30, maxSets = Infinity } = {}) {
  const [state, setState] = useState({
    /** Số giây đã giữ trong set hiện tại. */
    holdSeconds: 0,
    targetSeconds,
    setNumber: 1,
    /** Số set đã hoàn thành. */
    completedSetCount: 0,
    formScore: 100,
    lastFeedback: "",
    feedbackTone: "good",
    /** Góc thân hiện tại (độ) để hiển thị. */
    bodyAngle: null,
    /** Set hiện tại đã giữ đủ thời gian chưa. */
    setComplete: false,
  });

  const ref = useRef({
    holdSeconds: 0,
    targetSeconds,
    setNumber: 1,
    completedSets: [],
    totalFrames: 0,
    goodFrames: 0,
    lastFeedback: "",
    feedbackTone: "good",
    bodyAngle: null,
    /** Timestamp của frame cuối — dùng để tính delta thời gian. */
    lastTimestamp: null,
    /** Set các lỗi form đã phát hiện — dùng cho màn kết quả. */
    formIssues: new Set(),
    /**
     * Số liệu đo chi tiết của từng lỗi form (màn Form correction).
     * key -> { key, label, joint, measured, target, occurrences }
     */
    issueStats: new Map(),
  });

  // targetSeconds có thể đến sau (props đổi) -> cập nhật vào ref.
  useEffect(() => {
    ref.current.targetSeconds = targetSeconds;
  }, [targetSeconds]);

  const reset = useCallback((newTargetSeconds) => {
    const previous = ref.current;
    ref.current = {
      holdSeconds: 0,
      targetSeconds: newTargetSeconds ?? previous.targetSeconds,
      setNumber: 1,
      completedSets: [],
      totalFrames: 0,
      goodFrames: 0,
      lastFeedback: "",
      feedbackTone: "good",
      bodyAngle: null,
      lastTimestamp: null,
      setStartedAt: Date.now(),
      // Giữ lại số liệu đo lỗi form đã có (reset chỉ xoá bộ đếm).
      formIssues: previous.formIssues,
      issueStats: previous.issueStats,
    };
    setState({
      holdSeconds: 0,
      targetSeconds: ref.current.targetSeconds,
      setNumber: 1,
      completedSetCount: 0,
      formScore: 100,
      lastFeedback: "",
      feedbackTone: "good",
      bodyAngle: null,
      setComplete: false,
    });
  }, []);

  /**
   * Bắt đầu set mới (sau khi nghỉ) — set vừa rồi đã được ghi vào completedSets.
   *
   * Set number không vượt quá `maxSets` — bấm Continue nhiều lần (kể cả khi
   * hệ thống không nhận được frame nào) thì bộ đếm vẫn dừng ở set cuối.
   */
  const nextSet = useCallback((newTargetSeconds) => {
    const current = ref.current;
    const totalSeconds = Math.round(current.holdSeconds);
    const formRatio = current.totalFrames ? current.goodFrames / current.totalFrames : 1;

    const finishedSet = {
      totalReps: 0,
      cleanReps: 0,
      totalSeconds,
      cleanSeconds: Math.round(totalSeconds * formRatio),
    };

    // Set number không vượt quá maxSets.
    const nextSetNumber = Math.min(current.setNumber + 1, maxSets);

    ref.current = {
      ...current,
      holdSeconds: 0,
      totalFrames: 0,
      goodFrames: 0,
      setNumber: nextSetNumber,
      targetSeconds: newTargetSeconds ?? current.targetSeconds,
      completedSets: [...current.completedSets, finishedSet],
      lastFeedback: "",
      feedbackTone: "good",
      lastTimestamp: null,
      setStartedAt: Date.now(),
    };
    setState({
      holdSeconds: 0,
      targetSeconds: ref.current.targetSeconds,
      setNumber: nextSetNumber,
      completedSetCount: ref.current.completedSets.length,
      formScore: 100,
      lastFeedback: "",
      feedbackTone: "good",
      bodyAngle: current.bodyAngle,
      setComplete: false,
    });
  }, [maxSets]);

  /**
   * Khôi phục các set đã hoàn thành sau khi member quay lại từ màn nghỉ ngơi.
   * @param {Array} completedSets - các set đã xong (mỗi set 1 phần tử)
   * @param {number} [newSetNumber] - số thứ tự của set tiếp theo (do màn
   *        tracking truyền xuống — không suy ra từ độ dài mảng vì member có
   *        thể bấm Continue nhiều lần mà hệ thống không nhận được lần tập nào)
   */
  const restore = useCallback((completedSets, newSetNumber) => {
    const sets = Array.isArray(completedSets) ? completedSets : [];
    const current = ref.current;
    // Set number không vượt quá maxSets.
    const setNumber = Math.min(newSetNumber ?? sets.length + 1, maxSets);
    ref.current = {
      ...current,
      holdSeconds: 0,
      totalFrames: 0,
      goodFrames: 0,
      setNumber,
      completedSets: sets,
      lastFeedback: "",
      feedbackTone: "good",
      lastTimestamp: null,
    };
    setState({
      holdSeconds: 0,
      targetSeconds: current.targetSeconds,
      setNumber,
      completedSetCount: sets.length,
      formScore: 100,
      lastFeedback: "",
      feedbackTone: "good",
      bodyAngle: null,
      setComplete: false,
    });
  }, [maxSets]);

  /**
   * Lấy kết quả tất cả set đã hoàn thành (bao gồm set đang tập dở).
   * @returns {Array<{ totalReps: number, cleanReps: number, totalSeconds: number, cleanSeconds: number }>}
   */
  const getSetResults = useCallback(() => {
    const current = ref.current;
    const results = [...current.completedSets];
    const totalSeconds = Math.round(current.holdSeconds);
    const formRatio = current.totalFrames ? current.goodFrames / current.totalFrames : 1;
    results.push({
      totalReps: 0,
      cleanReps: 0,
      totalSeconds,
      cleanSeconds: Math.round(totalSeconds * formRatio),
    });
    return results;
  }, []);

  /** Danh sách lỗi form đã phát hiện — dùng cho màn kết quả. */
  const getFormIssues = useCallback(() => [...ref.current.formIssues], []);

  /**
   * Số liệu đo chi tiết của lỗi form — dùng cho màn "Form correction".
   * @returns {Array<{ key: string, label: string, joint: string, measured: number, target: number, occurrences: number, totalReps: number }>}
   */
  const getIssueStats = useCallback(
    () =>
      [...ref.current.issueStats.values()].map((item) => ({
        ...item,
        totalReps: item.occurrences,
      })),
    [],
  );

  /**
   * Xử lý một frame landmark.
   * @param {Array} landmarks - 33 điểm từ MediaPipe
   * @param {number} timestamp - thời điểm frame (performance.now())
   */
  const onFrame = useCallback((landmarks, timestamp) => {
    const current = ref.current;

    if (!landmarks || landmarks.length < 29) {
      // Không thấy người -> đồng hồ dừng, yêu cầu bước vào khung hình.
      current.lastTimestamp = null;
      current.lastFeedback = t("member:tracking.feedback.stepIntoFrame");
      current.feedbackTone = "warn";
      setState((prev) => ({
        ...prev,
        lastFeedback: current.lastFeedback,
        feedbackTone: "warn",
      }));
      return;
    }

    const lm = landmarks;
    const leftShoulder = lm[POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = lm[POSE_LANDMARKS.RIGHT_SHOULDER];
    const leftHip = lm[POSE_LANDMARKS.LEFT_HIP];
    const rightHip = lm[POSE_LANDMARKS.RIGHT_HIP];
    const leftKnee = lm[POSE_LANDMARKS.LEFT_KNEE];
    const rightKnee = lm[POSE_LANDMARKS.RIGHT_KNEE];

    const hasBody =
      isVisible(leftShoulder) &&
      isVisible(rightShoulder) &&
      isVisible(leftHip) &&
      isVisible(rightHip) &&
      isVisible(leftKnee) &&
      isVisible(rightKnee);

    if (!hasBody) {
      current.lastTimestamp = null;
      current.lastFeedback = t("member:tracking.feedback.stepIntoFrame");
      current.feedbackTone = "warn";
      setState((prev) => ({
        ...prev,
        lastFeedback: current.lastFeedback,
        feedbackTone: "warn",
      }));
      return;
    }

    // Góc thân tại hông: thân thẳng ~180° (plank, tay đứng).
    const shoulderMid = midpoint(leftShoulder, rightShoulder);
    const hipMid = midpoint(leftHip, rightHip);
    const kneeMid = midpoint(leftKnee, rightKnee);
    const bodyAngle = angleBetween(shoulderMid, hipMid, kneeMid);

    // Delta thời gian giữa 2 frame -> số giây vừa giữ.
    const previousTimestamp = current.lastTimestamp;
    current.lastTimestamp = typeof timestamp === "number" ? timestamp : null;
    if (previousTimestamp == null || current.lastTimestamp == null) return;

    const delta = Math.min(
      MAX_FRAME_DELTA,
      Math.max(0, (current.lastTimestamp - previousTimestamp) / 1000),
    );
    current.holdSeconds += delta;
    current.totalFrames += 1;

    const isStraight = bodyAngle == null ? true : bodyAngle >= STRAIGHT_BODY_ANGLE;
    if (isStraight) current.goodFrames += 1;

    current.bodyAngle = bodyAngle == null ? current.bodyAngle : Math.round(bodyAngle);

    let feedback = current.lastFeedback;
    let tone = current.feedbackTone;

    if (!isStraight) {
      feedback = t("member:tracking.feedback.braceCore");
      tone = "warn";
    } else if (current.holdSeconds < current.targetSeconds) {
      feedback = t("member:tracking.feedback.holdSteady");
      tone = "good";
    } else {
      feedback = t("member:tracking.feedback.holdComplete");
      tone = "good";
    }

    current.lastFeedback = feedback;
    current.feedbackTone = tone;

    // Ghi nhận lỗi form để hiển thị ở màn kết quả.
    if (tone === "warn") {
      current.formIssues.add(HOLD_FORM_ISSUES.alignment);
      // Số liệu đo cho màn Form correction: giữ góc thân thấp nhất (lệch nặng nhất).
      const existing = current.issueStats.get("alignment");
      const measured = Math.round(current.bodyAngle ?? 0);
      if (!existing) {
        current.issueStats.set("alignment", {
          key: "alignment",
          label: HOLD_FORM_ISSUES.alignment,
          joint: "HIP",
          measured,
          target: STRAIGHT_BODY_TARGET,
          direction: "min",
          occurrences: 1,
        });
      } else if (measured < existing.measured) {
        existing.measured = measured;
      }
    }

    const formScore = current.totalFrames
      ? Math.round((current.goodFrames / current.totalFrames) * 100)
      : 100;

    setState({
      holdSeconds: current.holdSeconds,
      targetSeconds: current.targetSeconds,
      setNumber: current.setNumber,
      completedSetCount: current.completedSets.length,
      formScore,
      lastFeedback: feedback,
      feedbackTone: tone,
      bodyAngle: current.bodyAngle,
      setComplete: current.holdSeconds >= current.targetSeconds,
    });
  }, []);

  return {
    state,
    onFrame,
    reset,
    nextSet,
    restore,
    getSetResults,
    getFormIssues,
    getIssueStats,
  };
}
