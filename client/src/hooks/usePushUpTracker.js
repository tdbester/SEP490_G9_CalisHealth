/**
 * Dem reps va cham form cho bai push-up dua tren landmark tu MediaPipe.
 *
 * - Rep: goc khuyu di qua nguong "duoi het" -> xuong toi nguong "day" -> quay lai
 *   nguong "duoi het" = 1 rep hop le. Khong quay lai thi rep do khong sach.
 * - Do sau (Depth): do bang KHOANG CACH DOC giua vai va co tay (px trong anh),
 *   khong dung goc khuyu. Ly do: o goc may nghien (side view) do nay chinh xac,
 *   con goc khuyu bi MediaPipe doc sai khi camera chinh dien.
 * - Diem rep: tinh theo 4 thanh phan D (do sau) + A (than thang) + C (kiem soat)
 *   + E (doi tay het). Rep sach khi diem >= CLEAN_REP_THRESHOLD.
 *
 * Hook nay thuan tuy ve logic, khong goi camera.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import i18n from "../i18n";
import { POSE_LANDMARKS, angleBetween, midpoint } from "./usePoseDetection";
import { scoreByDeviation } from "../utils/formScore";

/** Dich chuoi phan hoi / loi form theo ngon ngu hien tai. */
const t = (key) => i18n.t(key);

/**
 * Diem toi thieu de 1 rep duoc coi la "sach".
 *
 * MediaPipe co sai so 15-25 do khi anh sang kem -> yeu cau 100 diem se khi
 * moi rep thuc te deu khong sach, lam he thong vo dung.
 */
export const CLEAN_REP_THRESHOLD = 85;

/** Nguong goc khuyu (do) khi tay duoi het - vuot nguong nay la da khoa. */
const DEFAULT_TOP_ANGLE = 165;

/** Nguong goc khuyu (do) o day nua nhat cua bai. */
const DEFAULT_BOTTOM_ANGLE = 97;

/** Goc than (vai-hong-cot chan) toi thieu de coi la than thang. */
const DEFAULT_ALIGN_MIN = 165;

/** Dung sai (do) cho vung dung quanh nguong muc tieu. */
const DEFAULT_TOLERANCE = 20;

/** He so giam diem cho thanh phan Control (jitter) — can hieu chinh bang du lieu that. */
const CONTROL_LAMBDA = 2.5;

/** Trong so cac thanh phan chinh diem. */
const WEIGHTS = {
  depth: 0.30,
  alignment: 0.25,
  control: 0.20,
  extension: 0.15,
};

/** Nguong visibility toi thieu de tin landmark. */
const MIN_VISIBILITY = 0.5;

/** So frame can giu o day nua nhat de tinh rep sach. */
const BOTTOM_FRAMES_REQUIRED = 3;

/** Do lech goc (do) de coi la chuyen pha trong may. */
const PHASE_HYSTERESIS = 12;

/**
 * Do lech (do) cho phep so voi nguong day khi dem rep.
 *
 * Vung nay rong hon vung chinh xac cua "da du sau" -> mot lan xuong nong van
 * duoc dem la 1 rep (nhung diem form thap -> khong phai rep sach).
 */
const REP_COUNT_TOLERANCE = 40;

const PHASE = {
  TOP: "top",
  DESCENT: "descent",
  INFLECTION: "inflection",
  ASCENT: "ascent",
};

/** Loi form dung o man ket qua. */
export const PUSHUP_FORM_ISSUES = {
  get depth() {
    return t("member:tracking.formIssues.depth");
  },
  get alignment() {
    return t("member:tracking.formIssues.alignment");
  },
  get control() {
    return t("member:tracking.formIssues.control");
  },
  get extension() {
    return t("member:tracking.formIssues.extension");
  },
};

function isVisible(point) {
  return !!point && (point.visibility ?? 0) >= MIN_VISIBILITY;
}

/**
 * Tim rule theo khớp trong danh sach rule tu server.
 *
 * @param {Array} formRules
 * @param {string} joint
 * @returns {object|null}
 */
export function findPushUpRule(formRules, joint) {
  if (!Array.isArray(formRules)) return null;
  const target = String(joint || "").toUpperCase();
  if (!target) return null;
  return (
    formRules.find(
      (rule) => String(rule?.joint || "").toUpperCase() === target,
    ) || null
  );
}

/**
 * Chuan hoa trong so theo cac thanh phan dang bat.
 *
 * @param {object} weights
 * @returns {object} trong so tong = 1
 */
function normalizeWeights(weights) {
  const entries = Object.entries(weights).filter(([, value]) => value > 0);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) return {};
  const result = {};
  for (const [key, value] of entries) {
    result[key] = value / total;
  }
  return result;
}

/**
 * Diem cua 1 thanh phan theo vung dung quanh muc tieu.
 *
 * @param {number|null} measured - gia tri do duoc
 * @param {number} target - gia tri muc tieu
 * @param {number} tolerance - ban kinh vung dung
 * @returns {number} 0..100
 */
function scoreByTolerance(measured, target, tolerance) {
  if (measured == null || !Number.isFinite(measured)) return 0;
  if (tolerance <= 0) return measured === target ? 100 : 0;
  const deviation = Math.abs(measured - target);
  if (deviation <= tolerance / 2) return 100;
  if (deviation >= tolerance) return 0;
  const ratio = (deviation - tolerance / 2) / (tolerance / 2);
  return Math.round((1 - ratio) * 100);
}

/**
 * Diem thanh phan Control: do "run" cua chuyong dong trong 1 rep.
 *
 * Do tren KHOANG CACH DOC vai-co tay chu khong phai goc khu yu: khi co the
 * cung, khoang cach nay bat bien; khi co the run, no bien dong. Do tren goc
 * khu yu se cho diem sai vi goc do thay doi mot cach co y (xuong - len).
 *
 * Tinh theo gia toc bac 1 (do thay doi moi frame), chuan hoa ve [0,1] roi giam
 * theo exp(-lambda * jitter).
 *
 * @param {number[]} distances - cac khoang cach doc vai-co tay theo thu tu
 * @returns {number} 0..100
 */
export function scoreControl(distances) {
  if (!Array.isArray(distances) || distances.length < 3) return 100;
  let jitterSum = 0;
  let count = 0;
  for (let i = 1; i < distances.length; i += 1) {
    jitterSum += Math.abs(distances[i] - distances[i - 1]);
    count += 1;
  }
  if (count === 0) return 100;
  const jitter = jitterSum / count;
  // Jitter duoi 0.005 (do) -> khong run (100 diem).
  // Jitter tren 0.06 (do) -> khong kiem soat duoc (0 diem).
  const normalized = Math.min(1, Math.max(0, (jitter - 0.005) / (0.06 - 0.005)));
  return Math.round(100 * Math.exp(-CONTROL_LAMBDA * normalized));
}

/**
 * Do khoang cach doc giua vai va co tay (px trong anh).
 *
 * @param {object} shoulder
 * @param {object} wrist
 * @returns {number|null}
 */
function verticalDistance(shoulder, wrist) {
  if (!shoulder || !wrist) return null;
  return Math.abs(wrist.y - shoulder.y);
}

/**
 * Diem cua 1 thanh phan theo do lech (deviation) so voi muc tieu.
 *
 * Vung dung rong tolerance/2 quanh muc tieu -> 100 diem. Lech >= tolerance -> 0.
 *
 * Ham nay da tach sang `utils/formScore.js` de `useHoldTracker.js` va hook nay
 * dung chung mot cong thuc (truoc day 2 ban co the lech nhau).
 */


/**
 * Diem thanh phan Depth: goc khu yu tai day cua rep so voi nguong day.
 *
 * Dung goc khu yu (do) thay vi khoang cach pixel giua vai-co tay: goc khong doi
 * theo vi tri camera nen khong phu thuoc goc may, va MediaPipe do goc khu yu
 * kha on dinh hon khi nhin nghien.
 *
 * @param {number|null} minAngle - goc khu yu nho nhat cua rep
 * @param {number} bottomAngle - nguong goc tai day
 * @param {number} tolerance - ban kinh vung dung
 * @returns {number} 0..100
 */
export function scoreDepthRatio(minAngle, bottomAngle, tolerance = DEFAULT_TOLERANCE) {
  if (minAngle == null || !Number.isFinite(minAngle)) return 0;
  // Goc tai day phai nho hon nguong day (xuong sau) -> depth > 0.
  // depth = 0 (dung bang nguong) van la dat.
  const depth = bottomAngle - minAngle;
  if (depth < 0) return 0;
  // Xuong sau = goc khu yu nho hon nguong day nhieu.
  // Dat khi lech nho hon tolerance/2, 0 diem khi lech >= tolerance.
  return scoreByDeviation(minAngle, bottomAngle, tolerance);
}

/**
 * Tinh diem 4 thanh phan cho 1 rep da hoan thanh.
 *
 * @param {object} current - ref hien tai cua tracker
 * @param {object} thresholds - nguong doc tu rule
 * @returns {{ total: number, depth: number, alignment: number, control: number, extension: number }}
 */
function scoreRep(current, thresholds) {
  const {
    topAngle, bottomAngle, alignMin, tolerance,
  } = thresholds;

  // D - do sau: goc khu yu tai day so voi nguong day.
  const depth = scoreDepthRatio(current.repMinAngle, bottomAngle, tolerance);

  // A - than thang: lech cua goc than so voi 180 do (than thang tuyet doi).
  const alignment = scoreByDeviation(
    current.repMinBodyAngle == null ? null : 180 - current.repMinBodyAngle,
    0,
    tolerance,
  );

  // C - kiem soat: do doc dong cua goc khuyu trong rep.
  const control = scoreControl(current.repDistances);

  // E - doi tay het: lech cua goc khuyu lon nhat so voi nguong tren cung.
  const extension = scoreByDeviation(current.repMaxAngle, topAngle, tolerance);

  const parts = {
    depth, alignment, control, extension,
  };
  const weights = normalizeWeights(WEIGHTS);
  let total = 0;
  for (const key of Object.keys(weights)) {
    total += parts[key] * weights[key];
  }
  return { total: Math.round(total), ...parts };
}

/**
 * Ghi nhan loi form cua rep vua hoan thanh (dung cho man ket qua).
 */
function recordPushUpIssues(current, scores) {
  if (scores.depth < 60) {
    current.formIssues.add(PUSHUP_FORM_ISSUES.depth);
  }
  if (scores.alignment < 60) {
    current.formIssues.add(PUSHUP_FORM_ISSUES.alignment);
  }
  if (scores.control < 60) {
    current.formIssues.add(PUSHUP_FORM_ISSUES.control);
  }
  if (scores.extension < 60) {
    current.formIssues.add(PUSHUP_FORM_ISSUES.extension);
  }
}

/**
 * @param {object} options
 * @param {number} options.targetReps - so reps muc tieu cua set hien tai
 * @param {number} options.maxSets - tong so set cua bai
 * @param {Array} options.formRules - danh sach rule tu server (ELBOW, HIP)
 * @param {number} options.bottomFramesRequired - so frame o day can giu
 */
export default function usePushUpTracker({
  targetReps = 12,
  maxSets = Infinity,
  formRules = null,
  bottomFramesRequired = BOTTOM_FRAMES_REQUIRED,
  /**
   * Dung khi set hien tai da dat du `targetReps` lan -> dung dem, khong dem
   * vuot moc (mian tracking tu chuyen sang man nghi).
   */
  capAtTarget = false,
} = {}) {
  const [state, setState] = useState({
    phase: PHASE.TOP,
    reps: 0,
    cleanReps: 0,
    setReps: 0,
    setCleanReps: 0,
    elbowAngle: null,
    bodyAngle: null,
    formScore: 100,
    setNumber: 1,
    repsLeft: targetReps,
    /** Set hien tai da dat du so reps muc tieu chua. */
    setComplete: false,
    lastFeedback: "",
    feedbackTone: "good",
    completedSets: [],
    setStartedAt: Date.now(),
  });

  const ref = useRef({
    phase: PHASE.TOP,
    reps: 0,
    cleanReps: 0,
    setReps: 0,
    setCleanReps: 0,
    elbowAngle: null,
    bodyAngle: null,
    totalFrames: 0,
    goodFrames: 0,
    setNumber: 1,
    targetReps,
    maxSets,
    formRules,
    bottomFramesRequired,
    capAtTarget,
    lastFeedback: "",
    feedbackTone: "good",
    completedSets: [],
    setStartedAt: Date.now(),
    formIssues: new Set(),
    issueStats: new Map(),
    /** Diem tung rep trong set hien tai. */
    repScores: [],
    /** Cac goc khuyu cua rep dang chay -> tinh jitter cho thanh phan Control. */
    repDistances: [],
    /** Goc khuyu nho nhat cua rep dang chay (diem day). */
    repMinAngle: null,
    /** Khoang cach doc vai-co tay nho nhat cua rep dang chay. */
    repMinDepth: null,
    /** Khoang cach doc vai-co tay luc tay duoi het (mau chuan cho ty le do sau). */
    repTopDepth: null,
    /** Goc than nho nhat cua rep dang chay (de chay than thang). */
    repMinBodyAngle: null,
    /** Goc khuyu lon nhat cua rep dang chay (do duoi het). */
    repMaxAngle: null,
    /** Frame dem duoc o day nua nhat. */
    bottomFrames: 0,
    /** Diem cua rep vua hoan thanh (null = chua co rep nao). */
    lastRepScore: null,
    lastRepCount: 0,
  });

  useEffect(() => {
    ref.current.formRules = formRules;
  }, [formRules]);

  useEffect(() => {
    ref.current.bottomFramesRequired = bottomFramesRequired;
  }, [bottomFramesRequired]);

  useEffect(() => {
    ref.current.capAtTarget = capAtTarget;
  }, [capAtTarget]);

  /**
   * Doc cac nguong tu rule cua server, fallback ve gia tri mac dinh.
   *
   * Hai nguong duoi day dung 2 muc dich khac nhau:
   * - `bottomAngle` (chặt): mốc để coi rep là ĐẠT (dùng cho điểm form).
   * - `countBottomAngle` (rộng): mốc để coi là ĐÃ XUỐNG (dùng cho đếm rep).
   *
   * Nếu dùng chung một ngưỡng, những lần xuống nông sẽ không được đếm -> member
   * thấy bộ đếm không nhảy. Đếm rộng + chấm chặt là cách các app fitness làm.
   */
  const readThresholds = useCallback((rules) => {
    const elbowRule = findPushUpRule(rules, "ELBOW");
    const alignRule = findPushUpRule(rules, "HIP");
    const topAngle = elbowRule?.angleThreshold ?? DEFAULT_TOP_ANGLE;
    const bottomAngle = elbowRule?.romDepth ?? DEFAULT_BOTTOM_ANGLE;
    // Ngưỡng đếm rep = ngưỡng đạt + dung sai, gọn trong khoảng hợp lý.
    const countBottomAngle = Math.min(
      topAngle - 20,
      bottomAngle + REP_COUNT_TOLERANCE,
    );
    const alignMin = alignRule?.minAngle ?? DEFAULT_ALIGN_MIN;
    const tolerance = elbowRule?.tolerance ?? DEFAULT_TOLERANCE;
    return {
      topAngle, bottomAngle, countBottomAngle, alignMin, tolerance,
    };
  }, []);

  const reset = useCallback((newTargetReps) => {
    const previous = ref.current;
    ref.current = {
      ...previous,
      phase: PHASE.TOP,
      reps: 0,
      cleanReps: 0,
      setReps: 0,
      setCleanReps: 0,
      elbowAngle: null,
      bodyAngle: null,
      totalFrames: 0,
      goodFrames: 0,
      setNumber: 1,
      targetReps: newTargetReps ?? previous.targetReps,
      lastFeedback: "",
      feedbackTone: "good",
      completedSets: [],
      setStartedAt: Date.now(),
      formIssues: new Set(),
      issueStats: new Map(),
      repScores: [],
      repDistances: [],
      repMinAngle: null,
      repMinDepth: null,
    /** Khoang cach doc vai-co tay luc tay duoi het (mau chuan cho ty le do sau). */
    repTopDepth: null,
    /** Goc than nho nhat cua rep dang chay (de chay than thang). */
    repMinBodyAngle: null,
      repMaxAngle: null,
      bottomFrames: 0,
      lastRepScore: null,
      lastRepCount: 0,
    };
    setState({
      phase: PHASE.TOP,
      reps: 0,
      cleanReps: 0,
      setReps: 0,
      setCleanReps: 0,
      elbowAngle: null,
      bodyAngle: null,
      formScore: 100,
      setNumber: 1,
      repsLeft: ref.current.targetReps,
      setComplete: false,
      lastFeedback: "",
      feedbackTone: "good",
      completedSets: [],
      setStartedAt: Date.now(),
    });
  }, []);

  const nextSet = useCallback((newTargetReps) => {
    const current = ref.current;
    const seconds = Math.round((Date.now() - current.setStartedAt) / 1000);
    const formRatio = current.totalFrames ? current.goodFrames / current.totalFrames : 1;
    const totalSeconds = current.totalFrames > 0 ? Math.max(1, seconds) : seconds;
    const finishedSet = {
      totalReps: current.setReps,
      cleanReps: current.setCleanReps,
      totalSeconds,
      cleanSeconds: Math.round(totalSeconds * formRatio),
    };
    const nextSetNumber = Math.min(current.setNumber + 1, current.maxSets);

    ref.current = {
      ...current,
      phase: PHASE.TOP,
      totalFrames: 0,
      goodFrames: 0,
      setNumber: nextSetNumber,
      targetReps: newTargetReps ?? current.targetReps,
      lastFeedback: "",
      feedbackTone: "good",
      completedSets: [...current.completedSets, finishedSet],
      setStartedAt: Date.now(),
      repScores: [],
      repDistances: [],
      repMinAngle: null,
      repMinDepth: null,
    /** Khoang cach doc vai-co tay luc tay duoi het (mau chuan cho ty le do sau). */
    repTopDepth: null,
    /** Goc than nho nhat cua rep dang chay (de chay than thang). */
    repMinBodyAngle: null,
      repMaxAngle: null,
      bottomFrames: 0,
    };
    setState({
      phase: PHASE.TOP,
      reps: current.reps,
      cleanReps: current.cleanReps,
      setReps: 0,
      setCleanReps: 0,
      elbowAngle: current.elbowAngle,
      bodyAngle: current.bodyAngle,
      formScore: 100,
      setNumber: nextSetNumber,
      repsLeft: ref.current.targetReps,
      setComplete: false,
      lastFeedback: "",
      feedbackTone: "good",
    });
  }, []);

  const restore = useCallback((completedSets, newTargetReps, newSetNumber) => {
    const sets = Array.isArray(completedSets) ? completedSets : [];
    const current = ref.current;
    const target = newTargetReps ?? current.targetReps;
    const totalReps = sets.reduce((sum, set) => sum + (set.totalReps || 0), 0);
    const cleanReps = sets.reduce((sum, set) => sum + (set.cleanReps || 0), 0);
    const setNumber = Math.min(newSetNumber ?? sets.length + 1, current.maxSets);
    ref.current = {
      ...current,
      phase: PHASE.TOP,
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
      repScores: [],
      repDistances: [],
      repMinAngle: null,
      repMinDepth: null,
    /** Khoang cach doc vai-co tay luc tay duoi het (mau chuan cho ty le do sau). */
    repTopDepth: null,
    /** Goc than nho nhat cua rep dang chay (de chay than thang). */
    repMinBodyAngle: null,
      repMaxAngle: null,
      bottomFrames: 0,
    };
    setState({
      phase: PHASE.TOP,
      reps: totalReps,
      cleanReps,
      setReps: 0,
      setCleanReps: 0,
      elbowAngle: null,
      bodyAngle: null,
      formScore: 100,
      setNumber,
      repsLeft: target,
      setComplete: false,
      lastFeedback: "",
      feedbackTone: "good",
    });
  }, []);

  const getSetResults = useCallback((elapsedOverride) => {
    const current = ref.current;
    const results = [...current.completedSets];
    const elapsed = elapsedOverride != null
      ? Math.round(elapsedOverride)
      : Math.round((Date.now() - current.setStartedAt) / 1000);
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

  const getFormIssues = useCallback(() => [...ref.current.formIssues], []);

  const getIssueStats = useCallback(
    () =>
      [...ref.current.issueStats.values()].map((item) => ({
        ...item,
        totalReps: ref.current.reps,
      })),
    [],
  );

  /** Diem tung rep trong set hien tai. */
  const getRepScores = useCallback(() => [...ref.current.repScores], []);

  /**
   * Xu ly mot frame landmark.
   *
   * @param {Array} landmarks - 33 diem tu MediaPipe
   */
  const onFrame = useCallback((landmarks) => {
    const current = ref.current;
    if (!landmarks || landmarks.length < 29) {
      current.lastFeedback = t("member:tracking.feedback.stepIntoFrame");
      current.feedbackTone = "warn";
      setState((prev) => ({ ...prev, lastFeedback: current.lastFeedback, feedbackTone: "warn" }));
      return;
    }

    const lm = landmarks;
    const leftShoulder = lm[POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = lm[POSE_LANDMARKS.RIGHT_SHOULDER];
    const leftElbow = lm[POSE_LANDMARKS.LEFT_ELBOW];
    const rightElbow = lm[POSE_LANDMARKS.RIGHT_ELBOW];
    const leftWrist = lm[POSE_LANDMARKS.LEFT_WRIST];
    const rightWrist = lm[POSE_LANDMARKS.RIGHT_WRIST];
    const leftHip = lm[POSE_LANDMARKS.LEFT_HIP];
    const rightHip = lm[POSE_LANDMARKS.RIGHT_HIP];
    const leftKnee = lm[POSE_LANDMARKS.LEFT_KNEE];
    const rightKnee = lm[POSE_LANDMARKS.RIGHT_KNEE];
    const leftAnkle = lm[POSE_LANDMARKS.LEFT_ANKLE];
    const rightAnkle = lm[POSE_LANDMARKS.RIGHT_ANKLE];

    const useLeft = (leftElbow?.visibility ?? 0) >= (rightElbow?.visibility ?? 0);
    const shoulder = useLeft ? leftShoulder : rightShoulder;
    const elbow = useLeft ? leftElbow : rightElbow;
    const wrist = useLeft ? leftWrist : rightWrist;
    const hip = useLeft ? leftHip : rightHip;
    const knee = useLeft ? leftKnee : rightKnee;
    const ankle = useLeft ? leftAnkle : rightAnkle;

    if (!isVisible(shoulder) || !isVisible(elbow) || !isVisible(wrist)
      || !isVisible(hip) || !isVisible(knee) || !isVisible(ankle)) {
      current.lastFeedback = t("member:tracking.feedback.stepIntoFrame");
      current.feedbackTone = "warn";
      setState((prev) => ({ ...prev, lastFeedback: current.lastFeedback, feedbackTone: "warn" }));
      return;
    }

    const elbowAngle = angleBetween(shoulder, elbow, wrist);
    if (elbowAngle == null) return;

    // Do sau: khoang cach doc vai - co tay (chinh xac o goc may nghien).
    const depth = verticalDistance(shoulder, wrist);

    // Than thang: goc vai - hong - cot chan.
    const shoulderMid = midpoint(leftShoulder, rightShoulder);
    const hipMid = midpoint(leftHip, rightHip);
    const ankleMid = midpoint(leftAnkle, rightAnkle);
    const bodyAngle = angleBetween(shoulderMid, hipMid, ankleMid);

    current.totalFrames += 1;
    current.elbowAngle = elbowAngle;
    if (bodyAngle != null) current.bodyAngle = Math.round(bodyAngle);

    const {
      topAngle, bottomAngle, countBottomAngle, alignMin, tolerance,
    } = readThresholds(current.formRules);

    const isTop = elbowAngle >= topAngle - PHASE_HYSTERESIS;
    // Da xuong du (du de dem rep) va da xuong sau (dat diem form).
    const isBottom = elbowAngle <= countBottomAngle;
    const reachedDepth = elbowAngle <= bottomAngle + PHASE_HYSTERESIS;

    // Ghi nhan du lieu cua rep dang chay.
    if (current.phase !== PHASE.TOP) {
      if (depth != null) current.repDistances.push(depth);
      if (current.repMinAngle == null || elbowAngle < current.repMinAngle) {
        current.repMinAngle = elbowAngle;
      }
      if (current.repMaxAngle == null || elbowAngle > current.repMaxAngle) {
        current.repMaxAngle = elbowAngle;
      }
      if (depth != null && (current.repMinDepth == null || depth < current.repMinDepth)) {
        current.repMinDepth = depth;
      }
      if (bodyAngle != null && (current.repMinBodyAngle == null || bodyAngle < current.repMinBodyAngle)) {
        current.repMinBodyAngle = bodyAngle;
      }
    }

    // Khoang cach doc luc tay duoi het — mau chuan cho ty le do sau.
    // Chi ghi khi tay thuc su duoi het (isTop) de lay mau dai nhat cua rep.
    if (isTop && depth != null) {
      current.repTopDepth = depth;
    }

    // Goc khu yu lon nhat cua rep (tay duoi het nhat) — dung cho thanh phan E.
    // Ghi o ca pha TOP va DESCENT de khong bo qua khung hinh ngay truoc khi xuong.
    if (current.phase === PHASE.TOP || current.phase === PHASE.DESCENT) {
      if (current.repMaxAngle == null || elbowAngle > current.repMaxAngle) {
        current.repMaxAngle = elbowAngle;
      }
    }

    let feedback = current.lastFeedback;
    let tone = current.feedbackTone;

    switch (current.phase) {
      case PHASE.TOP:
        if (!isTop && elbowAngle < topAngle - PHASE_HYSTERESIS) {
          current.phase = PHASE.DESCENT;
          current.repDistances = depth == null ? [] : [depth];
          current.repMinAngle = elbowAngle;
          // Giu goc khu yu lon nhat cua rep (tay duoi het) de cham thanh phan E.
          current.repMaxAngle = current.repMaxAngle ?? elbowAngle;
          current.repMinDepth = depth;
        }
        break;

      case PHASE.DESCENT:
        if (isBottom) {
          current.bottomFrames += 1;
          if (current.bottomFrames >= current.bottomFramesRequired) {
            current.phase = PHASE.INFLECTION;
          }
        }
        break;

      case PHASE.INFLECTION:
        if (isBottom) {
          current.bottomFrames += 1;
        } else if (isTop) {
          // Hoan thanh 1 rep.
          const scores = scoreRep(current, {
            topAngle, bottomAngle, alignMin, tolerance,
          });
          // Set da dat du so rep muc tieu -> dung dem, khong dem vuot moc.
          const targetReached = current.capAtTarget
            && current.setReps >= current.targetReps;
          if (!targetReached) {
            current.reps += 1;
            current.setReps += 1;
            current.repScores.push(scores.total);
            if (scores.total >= CLEAN_REP_THRESHOLD) {
              current.cleanReps += 1;
              current.setCleanReps += 1;
              feedback = t("member:tracking.feedback.goodRep");
              tone = "good";
            } else {
              feedback = t("member:tracking.feedback.shallowRep");
              tone = "warn";
            }
          }
          current.lastRepScore = scores.total;
          current.phase = PHASE.ASCENT;
          current.bottomFrames = 0;
          recordPushUpIssues(current, scores);
        }
        break;

      case PHASE.ASCENT:
        if (isTop) {
          current.phase = PHASE.TOP;
          current.repDistances = [];
          current.repMinAngle = null;
          current.repMinDepth = null;
          current.repMinBodyAngle = null;
          current.repMaxAngle = null;
        }
        break;

      default:
        break;
    }

    // Canh bao than khong thang khi dang o day nua nhat.
    if (
      current.phase === PHASE.INFLECTION
      && bodyAngle != null
      && bodyAngle < alignMin
    ) {
      feedback = t("member:tracking.feedback.braceCore");
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
      elbowAngle: Math.round(elbowAngle),
      bodyAngle: current.bodyAngle,
      formScore,
      setNumber: current.setNumber,
      repsLeft: Math.max(0, current.targetReps - current.setReps),
      // Set du so rep muc tieu -> mian tracking tu chuyen sang man nghi.
      setComplete: current.setReps >= current.targetReps,
      lastFeedback: feedback,
      feedbackTone: tone,
    });
  }, [readThresholds]);

  return {
    state,
    onFrame,
    reset,
    nextSet,
    restore,
    getSetResults,
    getFormIssues,
    getIssueStats,
    getRepScores,
  };
}
