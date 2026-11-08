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
import i18n from "../i18n";
import { POSE_LANDMARKS, angleBetween, midpoint } from "./usePoseDetection";

/** Dịch chuỗi phản hồi / lỗi form theo ngôn ngữ hiện tại. */
const t = (key) => i18n.t(key);

/** Góc đầu gối (độ) khi đứng thẳng — trên ngưỡng này coi như đã lên hết. */
const STANDING_ANGLE = 160;
/** Góc đầu gối khi xuống sâu — dưới ngưỡng này coi như đã xuống đủ. */
const DEEP_ANGLE = 100;
/**
 * Cần giữ đủ sâu liên tục bao nhiêu frame mới tính là rep sạch.
 *
 * Mặc định cho luồng camera (~30 fps) -> khoảng 130ms ở đáy.
 * Khi quét video, tần số lấy mẫu thấp hơn nên ngưỡng này được giảm tương ứng
 * (xem `deepFramesRequired` trong options).
 */
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

/** Nhãn lỗi form dùng ở màn kết quả (Figma 549:1175). */
export const FORM_ISSUES = {
  get depth() {
    return t("member:tracking.formIssues.depth");
  },
  get torso() {
    return t("member:tracking.formIssues.torso");
  },
  get knee() {
    return t("member:tracking.formIssues.knee");
  },
};

/**
 * Mốc góc để coi là đạt cho từng loại lỗi.
 *
 * Dùng khi bài chưa có form rule do Content Manager khai báo.
 */
const DEFAULT_DEPTH_TARGET = 95;
/** Góc thân tối thiểu để lưng không gật (độ). */
const TORSO_MIN_ANGLE = 115;
/** Độ lệch gối hướng vào trong (độ) được coi là lỗi. */
const KNEE_INWARD_MAX = 12;

/**
 * @typedef {object} FormIssueStat
 * @property {string} key      - khoá lỗi (depth | torso | knee)
 * @property {string} label    - nhãn lỗi hiển thị
 * @property {string} joint    - khớp liên quan (HIP | KNEE | ...)
 * @property {number} measured - giá trị đo được (góc độ)
 * @property {number} target   - giá trị mục tiêu (góc độ)
 * @property {number} occurrences - số rep bị lỗi này
 * @property {number} totalReps    - tổng số rep đã đếm
 */

/**
 * Đo độ lệch gối hướng vào trong (độ).
 *
 * Gối lệch vào trong khi bàn chân đặt thẳng -> đoạn bàn chân -> gối lệch
 * khỏi trục thẳng. Dùng góc của đoạn đó so với đường thẳng đứng.
 *
 * @param {object} ankle
 * @param {object} knee
 * @returns {number|null} góc lệch (độ), null khi thiếu điểm
 */
function measureKneeInward(ankle, knee) {
  if (!ankle || !knee) return null;
  const dx = Math.abs(knee.x - ankle.x);
  const dy = Math.abs(knee.y - ankle.y);
  if (dy < 0.01) return null;
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

/**
 * @param {object} options
 * @param {number} options.targetReps - số reps mục tiêu của set hiện tại
 * @param {number} options.maxSets - tổng số set của bài (chặn set counter vượt quá)
 * @param {number} options.deepFramesRequired - số frame phải giữ đủ sâu để tính
 *        rep sạch. Giảm giá trị này khi tần số lấy mẫu thấp hơn (quét video).
 */
/**
 * Ghi nhận số liệu đo của các lỗi form để dựng màn "Form correction".
 *
 * Mỗi lỗi lưu: giá trị đo được, giá trị mục tiêu và số rep bị lỗi.
 * Chỉ tính 1 lần cho mỗi rep (dùng `lastRepCount` để tránh đếm trùm khi
 * tracker ở đáy nhiều frame liên tiếp).
 *
 * @param {object} current - ref hiện tại của tracker
 * @param {object} sample - số liệu của frame này
 */
function recordIssueStats(current, sample) {
  const stats = current.issueStats;
  // Rep mới -> cho phép ghi nhận lỗi mới cho rep này.
  const isNewRep = current.reps > (current.lastRepCount ?? 0);
  if (isNewRep) {
    current.lastRepCount = current.reps;
  }

  /**
   * Cập nhật 1 lỗi: giữ giá trị đo "xấu nhất" và đếm số rep bị lỗi.
   *
   * @param {string} key
   * @param {string} label
   * @param {string} joint
   * @param {number} measured
   * @param {number} target
   * @param {"max"|"min"} direction - hướng "xấu": góc càng lớn càng lỗi
   *   (độ sâu, gối lệch) hay càng nhỏ càng lỗi (lưng gật).
   */
  const update = (key, label, joint, measured, target, direction = "max") => {
    if (measured == null || !Number.isFinite(measured)) return;
    const rounded = Math.round(measured);
    const existing = stats.get(key);
    if (!existing) {
      stats.set(key, {
        key,
        label,
        joint,
        measured: rounded,
        target: Math.round(target),
        direction,
        occurrences: isNewRep ? 1 : 0,
      });
      return;
    }
    existing.measured =
      direction === "min"
        ? Math.min(existing.measured, rounded)
        : Math.max(existing.measured, rounded);
    existing.target = Math.round(target);
    if (isNewRep) existing.occurrences += 1;
  };

  // 1. Hông không xuống đủ sâu: góc gối lớn hơn ngưỡng ROM.
  if (sample.kneeAngle != null && sample.kneeAngle > sample.deepTarget) {
    update(
      "depth",
      FORM_ISSUES.depth,
      "HIP",
      sample.kneeAngle,
      sample.deepTarget ?? DEFAULT_DEPTH_TARGET,
    );
  }

  // 2. Lưng gật: góc thân nhỏ hơn ngưỡng.
  if (sample.torsoAngle != null && sample.torsoAngle < TORSO_MIN_ANGLE) {
    update(
      "torso",
      FORM_ISSUES.torso,
      "SHOULDER",
      sample.torsoAngle,
      TORSO_MIN_ANGLE,
      "min",
    );
  }

  // 3. Gối lệch vào trong.
  if (sample.kneeInward != null && sample.kneeInward > KNEE_INWARD_MAX) {
    update("knee", FORM_ISSUES.knee, "KNEE", sample.kneeInward, KNEE_INWARD_MAX);
  }
}

export default function useSquatTracker({
  targetReps = 12,
  kneeRule = null,
  maxSets = Infinity,
  deepFramesRequired = DEEP_FRAMES_REQUIRED,
} = {}) {
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
    deepFramesRequired,
    lastFeedback: "",
    feedbackTone: "good",
    completedSets: [],
    setStartedAt: Date.now(),
    /** Set các lỗi form đã phát hiện — dùng cho màn kết quả. */
    formIssues: new Set(),
    /**
     * Số liệu đo chi tiết của từng lỗi form (màn Form correction).
     * key -> { key, label, joint, measured, target, occurrences }
     */
    issueStats: new Map(),
  });

  // Rule có thể đến sau (server trả về bất đồng bộ) -> cập nhật vào ref.
  useEffect(() => {
    ref.current.kneeRule = kneeRule;
  }, [kneeRule]);

  // Ngưỡng "giữ đủ sâu" có thể đổi theo tần số lấy mẫu -> cập nhật vào ref.
  useEffect(() => {
    ref.current.deepFramesRequired = deepFramesRequired;
  }, [deepFramesRequired]);

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
      formIssues: new Set(),
      issueStats: new Map(),
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
   *
   * Set number không vượt quá `maxSets` — khi member bấm Continue nhiều lần
   * (kể cả khi hệ thống không nhận được frame nào) thì bộ đếm vẫn dừng ở
   * set cuối cùng thay vì tăng vô hạn.
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

    const nextSetNumber = Math.min(current.setNumber + 1, maxSets);

    ref.current = {
      ...current,
      phase: PHASE.STANDING,
      deepFrames: 0,
      totalFrames: 0,
      goodFrames: 0,
      setNumber: nextSetNumber,
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
      setNumber: nextSetNumber,
      repsLeft: (newTargetReps ?? current.targetReps) - 0,
      lastFeedback: "",
      feedbackTone: "good",
    });
  }, [maxSets]);

  /**
   * Khôi phục các set đã hoàn thành khi member quay lại từ màn nghỉ ngơi.
   *
   * @param {Array} completedSets - các set đã xong, mỗi set gồm
   *        { totalReps, cleanReps, totalSeconds, cleanSeconds }
   * @param {number} [newTargetReps] - số reps mục tiêu của set tiếp theo
   * @param {number} [newSetNumber] - số thứ tự của set tiếp theo (do màn
   *        tracking truyền xuống — không suy ra từ độ dài mảng vì member có
   *        thể bấm Continue nhiều lần mà hệ thống không nhận được lần tập nào)
   */
  const restore = useCallback((completedSets, newTargetReps, newSetNumber) => {
    const sets = Array.isArray(completedSets) ? completedSets : [];
    const current = ref.current;
    const target = newTargetReps ?? current.targetReps;
    const totalReps = sets.reduce((sum, set) => sum + (set.totalReps || 0), 0);
    const cleanReps = sets.reduce((sum, set) => sum + (set.cleanReps || 0), 0);
    // Set number không vượt quá maxSets.
    const setNumber = Math.min(newSetNumber ?? sets.length + 1, maxSets);
    ref.current = {
      ...current,
      phase: PHASE.STANDING,
      deepFrames: 0,
      totalFrames: 0,
      goodFrames: 0,
      reps: totalReps,
      cleanReps,
      setReps: 0,
      setCleanReps: 0,
      setNumber,
      targetReps: target,
      completedSets: sets,
      lastFeedback: "",
      feedbackTone: "good",
      setStartedAt: Date.now(),
    };
    setState({
      phase: PHASE.STANDING,
      reps: totalReps,
      cleanReps,
      setReps: 0,
      setCleanReps: 0,
      kneeAngle: null,
      formScore: 100,
      setNumber,
      repsLeft: target,
      lastFeedback: "",
      feedbackTone: "good",
    });
  }, [maxSets]);

  /**
   * Lấy kết quả tất cả set đã hoàn thành (bao gồm set đang tập dở).
   *
   * @param {number} [elapsedOverride] - thời lượng thực tế của set (giây). Khi
   *        quét video thì thời lượng phải lấy theo thời lượng video, không phải
   *        thời gian thực đã trôi qua lúc quét.
   * @returns {Array<{ totalReps: number, cleanReps: number, totalSeconds: number, cleanSeconds: number }>}
   */
  const getSetResults = useCallback((elapsedOverride) => {
    const current = ref.current;
    const results = [...current.completedSets];
    const elapsed =
      elapsedOverride != null
        ? Math.round(elapsedOverride)
        : Math.round((Date.now() - current.setStartedAt) / 1000);
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

  /** Danh sách lỗi form đã phát hiện — dùng cho màn kết quả. */
  const getFormIssues = useCallback(() => [...ref.current.formIssues], []);

  /**
   * Số liệu đo chi tiết của các lỗi form — dùng cho màn "Form correction".
   * @returns {FormIssueStat[]}
   */
  const getIssueStats = useCallback(
    () =>
      [...ref.current.issueStats.values()].map((item) => ({
        ...item,
        totalReps: ref.current.reps,
      })),
    [],
  );

  /**
   * Xử lý một frame landmark.
   * @param {Array} landmarks - 33 điểm từ MediaPipe
   */
  const onFrame = useCallback((landmarks) => {
    const current = ref.current;

    if (!landmarks || landmarks.length < 29) {
      // Không thấy người trong khung -> báo "bước vào khung hình".
      current.lastFeedback = t("member:tracking.feedback.stepIntoFrame");
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
      current.lastFeedback = t("member:tracking.feedback.stepIntoFrame");
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

    // Số frame cần giữ đủ sâu để tính rep sạch (phụ thuộc tần số lấy mẫu).
    const deepRequired = current.deepFramesRequired || DEEP_FRAMES_REQUIRED;

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
          if (current.deepFrames >= deepRequired) {
            current.phase = PHASE.BOTTOM;
          }
        } else if (isStanding) {
          // Đi lên lại mà chưa chạm ngưỡng "sâu" -> vẫn tính 1 rep,
          // nhưng không sạch (độ sâu không đạt).
          current.reps += 1;
          current.setReps += 1;
          feedback = t("member:tracking.feedback.shallowRep");
          tone = "warn";
          current.phase = PHASE.STANDING;
          current.deepFrames = 0;
        }
        break;

      case PHASE.BOTTOM:
        if (isDeep) current.deepFrames += 1;
        if (isStanding) {
          // Hoàn thành 1 rep: sạch nếu đã đủ sâu và lưng không gật quá nhiều.
          const isClean = current.deepFrames >= deepRequired && (torsoAngle == null || torsoAngle > 115);
          current.reps += 1;
          current.setReps += 1;
          if (isClean) {
            current.cleanReps += 1;
            current.setCleanReps += 1;
            feedback = t("member:tracking.feedback.goodRep");
            tone = "good";
          } else {
            feedback = t("member:tracking.feedback.shallowRep");
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

    // Ghi nhận lỗi form để hiển thị ở màn kết quả.
    if (tone === "warn") {
      if (feedback.includes("deeper")) {
        current.formIssues.add(FORM_ISSUES.depth);
      } else if (feedback.includes("chest up")) {
        current.formIssues.add(FORM_ISSUES.torso);
      }
    }
    // Rule do Content Manager khai báo (ví dụ gối đầu gối lệch trong) -> ghi nhận.
    const ruleFeedback = current.kneeRule?.feedbackMessage;
    if (ruleFeedback && /knee/i.test(ruleFeedback)) {
      current.formIssues.add(FORM_ISSUES.knee);
    }

    // Số liệu đo chi tiết cho màn Form correction.
    // Ghi lại giá trị đo và số rep bị lỗi để member thấy "18° deviation · seen in 5/12 reps".
    recordIssueStats(current, {
      kneeAngle,
      torsoAngle,
      kneeInward: measureKneeInward(ankle, knee),
      deepTarget: deepAngle,
      totalReps: current.reps,
      issueFeedback: feedback,
      tone,
    });

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
