/**
}
  };
 * Đếm thời gian giữ cho bài HOLD (plank, wall handstand hold…).
 *
 * Bài HOLD được tính theo GIÂY và SET, không tính rep:
 *  - Mỗi set có một mục tiêu thời gian (targetSeconds).
 *  - Thời gian chỉ chạy khi người vẫn nằm trong khung hình; mất dấu người
 *    thì đồng hồ dừng (không tính phần không ai giữ).
 *  - Chấm form theo ĐIỂM MỀM (0..100) dựa trên `tolerance` do Content
 *    Manager khai báo, không dùng so sánh nhị phân `>= minAngle`.
 *  - `cleanSeconds` = số giây giữ ĐÚNG tư thế; `dirtySeconds` = số giây giữ
 *    sai tư thế. Set chỉ được coi là đạt khi `cleanSeconds >= targetSeconds`
 *    (không phải khi tổng thời gian giữ đủ).
 *  - Form score = `cleanSeconds / holdSeconds` (tỉ lệ THỜI GIAN giữ đúng).
 *
 * Hook này thuần tuý về logic, không gọi camera.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import i18n from "../i18n";
import { POSE_LANDMARKS, angleBetween, midpoint } from "./usePoseDetection";
import { scoreByDeviation, scoreByRange } from "../utils/formScore";

/** Dịch chuỗi phản hồi / lỗi form theo ngôn ngữ hiện tại. */
const t = (key) => i18n.t(key);

/** Ngưỡng visibility tối thiểu để tin landmark. */
const MIN_VISIBILITY = 0.5;

/**
 * Góc thân (vai–hông–gối) tối thiểu để coi là giữ đúng tư thế.
 * Thân thẳng (plank, tay đứng) ~180°, gật hông ~120°.
 *
 * Chỉ là giá trị fallback khi bài KHÔNG có form rule do Content Manager khai
 * báo. Thực tế đa số bài HOLD nên có rule riêng trong bảng `form_rules`.
 */
const STRAIGHT_BODY_ANGLE = 150;

/**
 * Góc thân tối đa của dải fallback (độ).
 *
 * Góc thân không thể vượt quá 180° (cơ thể không gập ngược đầu gối), nên dải
 * fallback là 150°–180°.
 */
const STRAIGHT_MAX_ANGLE = 180;

/** Dung sai fallback (độ) khi rule không khai báo `tolerance`. */
const DEFAULT_TOLERANCE = 15;

/**
 * Điểm tối thiểu để một frame được tính là "giữ đúng tư thế".
 *
 * Điểm mềm lấy từ `scoreByDeviation` (vùng dung rộng `tolerance/2` quanh mục
 * tiêu -> 100 điểm, lệch >= `tolerance` -> 0 điểm). Ngưỡng 60 tương đương
 * "còn trong vùng dung chấp nhận được".
 */
const PASS_SCORE = 60;

/** Bước thời gian tối đa tính cho một frame (s) — chống nhảy số khi tab bị treo. */
const MAX_FRAME_DELTA = 0.5;

/**
 * Hệ số giới hạn tổng thời gian so với mục tiêu.
 *
 * Member giữ sai form mãi thì `cleanSeconds` không bao giờ đạt mốc. Hệ số
 * này cho phép tracker cảnh báo "đã giữ quá lâu nhưng tư thế chưa đúng" thay
 * vì để member tự bấm Continue mù.
 */
const MAX_TIME_RATIO = 1.5;

/**
 * Nguong lech hong so voi duong than (chu hoa theo chieu dai than) de coi la vong lung.
 *
 * Gia tri 0.03 = hong lech 3% chieu dai than. Duoi nguong nay chua du de goi la vong lung
 * (nhieu nguoi tap sai do cam goc MediaPipe 15-25 do, xem tai lieu nguon hoc thuat).
 */
const HIP_SAG_THRESHOLD = 0.03;

/** Nhãn lỗi form dùng ở màn kết quả (Figma 549:1175). */
export const HOLD_FORM_ISSUES = {
  get alignment() {
    return t("member:tracking.formIssues.alignment");
  },
  get hipSag() {
    return t("member:tracking.formIssues.hipSag");
  },
  get hipPike() {
    return t("member:tracking.formIssues.hipPike");
  },
};

function isVisible(point) {
  return !!point && (point.visibility ?? 0) >= MIN_VISIBILITY;
}


/**
 * Do lech cua hong so voi duong than vai -> co chan.
 *
 * Goc than (vai-hop-goi) KHONG phan biet duoc vong lung (hong tut) voi vong lung
 * nguoc (hong nang): ca hai deu lam goc be di. Phai so vi tri cua hong voi
 * duong than moi phan biet duoc.
 *
 * Duong than = duong thang noi vai va co chan. Khi co than nam ngang trong anh
 * (plank, front lever, planche):
 *   - Hong nam DUOI duong than (y lon hon) -> vong lung.
 *   - Hong nam TREN duong than (y nho hon) -> vong lung nguoc.
 *
 * @param {object} shoulder - diem vai (midpoint trai + phai)
 * @param {object} hip - diem hong (midpoint trai + phai)
 * @param {object} ankle - diem co chan (midpoint trai + phai)
 * @returns {{ sag: number, horizontal: boolean } | null}
 *            `sag` = lech vuong goc chuan hoa theo chieu dai than.
 *            Duong = hong thap hon duong than (vong lung).
 *            Am = hong cao hon duong than (vong lung nguoc).
 *            `horizontal` = co than nam ngang trong anh hay khong.
 */
function hipDeviationFromBodyLine(shoulder, hip, ankle) {
  if (!shoulder || !hip || !ankle) return null;
  const dx = ankle.x - shoulder.x;
  const dy = ankle.y - shoulder.y;
  const length = Math.hypot(dx, dy);
  if (!length) return null;

  // Diem P = shoulder + t * (ankle - shoulder) la diem tren duong than co
  // cung hoa do X voi hong.
  const t = ((hip.x - shoulder.x) * dx + (hip.y - shoulder.y) * dy) / (length * length);
  const lineY = shoulder.y + t * dy;

  // Chuan hoa theo chieu dai than de khong phu thuoc khoang cach camera.
  const deviation = (hip.y - lineY) / length;

  // Co than nam ngang trong anh hay khong. Chi khi ngang moi so sanh
  // "duoi duong than" theo chieu trong truong co y nghia (vong lung).
  const horizontal = Math.abs(dx) >= Math.abs(dy);

  return { sag: deviation, horizontal };
}

/**
 * Lệch tương đối bao nhiêu để phân biệt võng lưng và vồng hông.
 *
 * Đường thân đi qua vai và cổ chân. Nếu cơ thể nằm ngang trong ảnh
 * (plank, front lever, planche) thì:
 *   - Hông nằm DƯỚI đường thân (y lớn hơn) -> võng lưng.
 *   - Hông nằm TRÊN đường thân (y nhỏ hơn) -> vồng hông.
 *
 * Với cơ thể đứng (đứng tay, L-sit) thì không áp dụng để suy ra
 * võng lưng hay không — trong trường hợp đó coi như không xuất hiện lỗi.
 *
 * @param {object} deviation - kết quả của {@link hipDeviationFromBodyLine}
 * @returns {boolean} true nếu đang là võng lưng
 */
function isHipSagging(deviation) {
  if (!deviation || !deviation.horizontal) return false;
  if (deviation.sag == null || !Number.isFinite(deviation.sag)) return false;
  return deviation.sag > HIP_SAG_THRESHOLD;
}

/**
 * Hông nằm TRÊN đường thân -> vồng hông (lưng cong lên).
 *
 * @param {object} deviation - kết quả của {@link hipDeviationFromBodyLine}
 * @returns {boolean} true nếu đang là vồng hông
 */
function isHipPiked(deviation) {
  if (!deviation || !deviation.horizontal) return false;
  if (deviation.sag == null || !Number.isFinite(deviation.sag)) return false;
  return deviation.sag < -HIP_SAG_THRESHOLD;
}

/**
 * @param {object} options
 * @param {number} options.targetSeconds - số giây cần giữ trong 1 set
 * @param {number} options.maxSets - tổng số set của bài (chặn set counter vượt quá)
 */
export default function useHoldTracker({
  targetSeconds = 30,
  maxSets = Infinity,
  bodyRule = null,
} = {}) {
  const [state, setState] = useState({
    /** Số giây đã giữ trong set hiện tại (kể cả phần giữ sai tư thế). */
    holdSeconds: 0,
    /**
     * Số giây giữ ĐÚNG tư thế trong set hiện tại.
     * Đây là con số dùng để quyết định set đã đạt mục tiêu hay chưa.
     */
    cleanSeconds: 0,
    /** Số giây giữ SAI tư thế trong set hiện tại. */
    dirtySeconds: 0,
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
    /** Member đã giữ quá lâu mà tư thế vẫn chưa đúng. */
    overTime: false,
  });

  const ref = useRef({
    holdSeconds: 0,
    cleanSeconds: 0,
    dirtySeconds: 0,
    targetSeconds,
    bodyRule,
    setNumber: 1,
    completedSets: [],
    totalFrames: 0,
    goodFrames: 0,
    lastFeedback: "",
    feedbackTone: "good",
    bodyAngle: null,
    /** Lech cua hong so voi duong than vai -> goi (%) — phan biet vong lung / vong lung nguoc. */
    hipDeviation: null,
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

  // Rule thân thẳng có thể đến sau (server trả rule bất đồng bộ) -> cập nhật ref.
  useEffect(() => {
    ref.current.bodyRule = bodyRule;
  }, [bodyRule]);

  const reset = useCallback((newTargetSeconds) => {
    const previous = ref.current;
    ref.current = {
      holdSeconds: 0,
      cleanSeconds: 0,
      dirtySeconds: 0,
      targetSeconds: newTargetSeconds ?? previous.targetSeconds,
      bodyRule: previous.bodyRule,
      setNumber: 1,
      completedSets: [],
      totalFrames: 0,
      goodFrames: 0,
      lastFeedback: "",
      feedbackTone: "good",
      bodyAngle: null,
    /** Lệch của hông so với đường thân vai -> cổ chân — phân biệt võng lưng / vồng hông. */
    hipDeviation: null,
      lastTimestamp: null,
      setStartedAt: Date.now(),
      // Giữ lại số liệu đo lỗi form đã có (reset chỉ xoá bộ đếm).
      formIssues: previous.formIssues,
      issueStats: previous.issueStats,
    };
    setState({
      holdSeconds: 0,
      cleanSeconds: 0,
      dirtySeconds: 0,
      targetSeconds: ref.current.targetSeconds,
      setNumber: 1,
      completedSetCount: 0,
      formScore: 100,
      lastFeedback: "",
      feedbackTone: "good",
      bodyAngle: null,
    /** Lệch của hông so với đường thân vai -> cổ chân — phân biệt võng lưng / vồng hông. */
    hipDeviation: null,
      setComplete: false,
      overTime: false,
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

    const finishedSet = {
      totalReps: 0,
      cleanReps: 0,
      totalSeconds,
      // Số giây giữ đúng tư thế đã tích luỹ thật (không suy ra từ tỉ lệ frame).
      cleanSeconds: Math.round(current.cleanSeconds),
    };

    // Set number không vượt quá maxSets.
    const nextSetNumber = Math.min(current.setNumber + 1, maxSets);

    ref.current = {
      ...current,
      holdSeconds: 0,
      cleanSeconds: 0,
      dirtySeconds: 0,
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
      cleanSeconds: 0,
      dirtySeconds: 0,
      targetSeconds: ref.current.targetSeconds,
      setNumber: nextSetNumber,
      completedSetCount: ref.current.completedSets.length,
      formScore: 100,
      lastFeedback: "",
      feedbackTone: "good",
      bodyAngle: current.bodyAngle,
      hipDeviation: current.hipDeviation,
      setComplete: false,
      overTime: false,
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
      cleanSeconds: 0,
      dirtySeconds: 0,
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
      cleanSeconds: 0,
      dirtySeconds: 0,
      targetSeconds: current.targetSeconds,
      setNumber,
      completedSetCount: sets.length,
      formScore: 100,
      lastFeedback: "",
      feedbackTone: "good",
      bodyAngle: null,
    /** Lệch của hông so với đường thân vai -> cổ chân — phân biệt võng lưng / vồng hông. */
    hipDeviation: null,
      setComplete: false,
      overTime: false,
    });
  }, [maxSets]);

  /**
   * Lấy kết quả tất cả set đã hoàn thành (bao gồm set đang tập dở).
   * @returns {Array<{ totalReps: number, cleanReps: number, totalSeconds: number, cleanSeconds: number }>}
   */
  const getSetResults = useCallback(() => {
    const current = ref.current;
    const results = [...current.completedSets];
    results.push({
      totalReps: 0,
      cleanReps: 0,
      totalSeconds: Math.round(current.holdSeconds),
      // Số giây giữ đúng tư thế đã tích luỹ thật.
      cleanSeconds: Math.round(current.cleanSeconds),
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
    const leftAnkle = lm[POSE_LANDMARKS.LEFT_ANKLE];
    const rightAnkle = lm[POSE_LANDMARKS.RIGHT_ANKLE];

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
    const ankleMid = midpoint(leftAnkle, rightAnkle);
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

    // --- Nguong goc theo tung bai (Content Manager khai bao) -----------------
    // Rule cua bai HOLD la mot DAI goc (min_angle..max_angle) — dung cho thang
    // "thân thẳng". Khong co rule thi dung moc fallback cua client.
    const rule = current.bodyRule;
    const hasRule = rule?.minAngle != null || rule?.maxAngle != null;
    const minAngle = hasRule ? (rule?.minAngle ?? null) : STRAIGHT_BODY_ANGLE;
    const maxAngle = hasRule ? (rule?.maxAngle ?? null) : STRAIGHT_MAX_ANGLE;
    // Dung sai (do) cho diem mem. Luon dung `DEFAULT_TOLERANCE` khi rule
    // khong khai bao tolerance HOAC khi bai khong co rule nao.
    //
    // Truoc day: khong co rule -> tolerance = 0 -> cham nhip han (100 diem neu
    // trong dai, 0 diem neu ngoai dai), trong khi co rule ma thieu tolerance
    // -> dung 15 (diem mem). Cung mot logic nhung hai do mem khac nhau -> khong
    // nhat quan. Bay gio ca hai nhanh deu cham mem voi dung sai 15 do, dung
    // chung voi mac dinh cua server (`FormRuleAdminService.DEFAULT_TOLERANCE`).
    const tolerance = rule?.tolerance ?? DEFAULT_TOLERANCE;
    // Bien duoi cua dai dung lam muc tieu hien thi tren man ket qua.
    const straightTarget = minAngle ?? STRAIGHT_BODY_ANGLE;

    // --- Diem form cua frame (diem mem 0..100) ------------------------------
    // Khong do duoc goc than -> khong coi la dung tu the (khong tinh goodFrames).
    let frameScore = 0;
    if (bodyAngle != null) {
      frameScore = scoreByRange(bodyAngle, minAngle, maxAngle, tolerance);
    }
    // Frame duoc tinh la "gia du tu the" khi diem >= PASS_SCORE.
    // Tuong duong vung dung chap nhan duoc, khong phai bang 100 diem.
    const isCorrectForm = frameScore >= PASS_SCORE;
    if (isCorrectForm) current.goodFrames += 1;

    // --- Tich luy thoi gian theo form --------------------------------------
    // Chi thoi gian giu DUNG tu the moi dem vao `cleanSeconds`.
    // Set duoc coi la dat muc tieu khi `cleanSeconds` du chu khong phai khi
    // tong thoi gian giu du chung.
    if (isCorrectForm) {
      current.cleanSeconds += delta;
    } else {
      current.dirtySeconds += delta;
    }

    current.bodyAngle = bodyAngle == null ? current.bodyAngle : Math.round(bodyAngle);
    // Lệch của hông so với đường thân vai -> cổ chân (dùng để phân biệt võng
    // lưng / vồng hông — góc thân không phân biệt được 2 lỗi này).
    const hipDeviation = hipDeviationFromBodyLine(shoulderMid, hipMid, ankleMid);
    if (hipDeviation) current.hipDeviation = hipDeviation;

    // --- Feedback -----------------------------------------------------------
    let feedback = current.lastFeedback;
    let tone = current.feedbackTone;

    if (!isCorrectForm) {
      const deviation = current.hipDeviation;
      feedback = bodyAngle == null
        ? t("member:tracking.feedback.braceCore")
        : deviation?.horizontal === true
          ? t(isHipSagging(deviation)
              ? "member:tracking.feedback.hipSag"
              : isHipPiked(deviation)
                ? "member:tracking.feedback.hipPike"
                : "member:tracking.feedback.braceCore")
          : t("member:tracking.feedback.braceCore");
      tone = "warn";
    } else if (current.cleanSeconds < current.targetSeconds) {
      feedback = t("member:tracking.feedback.holdSteady");
      tone = "good";
    } else {
      feedback = t("member:tracking.feedback.holdComplete");
      tone = "good";
    }

    current.lastFeedback = feedback;
    current.feedbackTone = tone;

    // --- Ghi nhan loi form de hien thi o man ket qua ------------------------
    // Phan biet 3 loi cua bai HOLD bang VI TRI HONG so voi duong thai
    // vai -> co chan (khong doi don vong goc):
    //   - Hong thap hon duong thai -> hong TUT (vong lung).
    //   - Hong cao hon duong thai -> hong NANG (vong lung nguoc).
    //   - Hong ngay tren duong thai, chi goc be do -> GOI GAP (khong ro loi).
    // Goc than be khong cho biet loi nao -> phai dung vi tri hong moi phan biet
    // duoc 2 huong tren.
    //
    // Chi ap dung khi co than NAM NGANG trong anh (plank, front lever, planche).
    // Voi co than DUNG (L-sit, dung tay) thi khong phan biet duoc 2 huong ->
    // dung loi chung "alignment" nhu truoc.
    if (!isCorrectForm && bodyAngle != null) {
      const deviation = current.hipDeviation;
      const canTellDirection = deviation?.horizontal === true;
      const isSag = isHipSagging(deviation);
      const isPike = isHipPiked(deviation);
      // Khong ro vong lung hay vong lung nguoc -> loi chung "alignment".
      const issueKey = !canTellDirection || (!isSag && !isPike)
        ? "alignment"
        : isSag
          ? "hipSag"
          : "hipPike";
      const issueLabel = !canTellDirection || (!isSag && !isPike)
        ? HOLD_FORM_ISSUES.alignment
        : isSag
          ? HOLD_FORM_ISSUES.hipSag
          : HOLD_FORM_ISSUES.hipPike;
      // Bien canh chinh: vong lung -> can nang hong len; vong lung nguoc -> can ha hong xuong.
      // Loi chung -> can nang hong len (gia tri bien duoi cua rule).
      const issueTarget = isSag || !isPike ? Math.round(minAngle) : Math.round(maxAngle);
      const direction = !isPike ? "min" : "max";

      current.formIssues.add(issueLabel);
      // So lieu do cho man Form correction: giu goc than xau nhat (lech nang nhat).
      const existing = current.issueStats.get(issueKey);
      const measured = Math.round(bodyAngle);
      if (!existing) {
        current.issueStats.set(issueKey, {
          key: issueKey,
          label: issueLabel,
          joint: "HIP",
          measured,
          target: issueTarget,
          direction,
          occurrences: 1,
        });
      } else if (direction === "min" && measured < existing.measured) {
        existing.measured = measured;
      } else if (direction === "max" && measured > existing.measured) {
        existing.measured = measured;
      }
    }

    // Diem form cua set = ti le thoi gian giu dung tu the.
    const formScore = current.holdSeconds > 0
      ? Math.round((current.cleanSeconds / current.holdSeconds) * 100)
      : 100;

    // Set dat muc tieu khi da giu DU thoi gian DUNG tu the.
    const setComplete = current.cleanSeconds >= current.targetSeconds;

    // Canh bao khi da giu qua lau ma tu the van chua dung.
    const overTime = !setComplete
      && current.holdSeconds > current.targetSeconds * MAX_TIME_RATIO;

    setState({
      holdSeconds: current.holdSeconds,
      cleanSeconds: current.cleanSeconds,
      dirtySeconds: current.dirtySeconds,
      targetSeconds: current.targetSeconds,
      setNumber: current.setNumber,
      completedSetCount: current.completedSets.length,
      formScore,
      lastFeedback: feedback,
      feedbackTone: tone,
      bodyAngle: current.bodyAngle,
      hipDeviation: current.hipDeviation,
      setComplete,
      overTime,
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
