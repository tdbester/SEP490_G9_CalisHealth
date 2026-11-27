/**
 * Kiem thu logic cham form + dem giay giu cho bai HOLD ma khong can camera.
 * Chay: node scripts/verify-hold-tracker.mjs
 *
 * Bai HOLD cham diem theo HONG B (diem mem theo `tolerance`):
 *   - Diem cua 1 frame nam trong [0, 100].
 *   - Vung dung rong tolerance/2 quanh muc tieu -> 100 diem.
 *   - Lech >= tolerance -> 0 diem.
 *   - Frame duoc tinh la "gia du tu the" khi diem >= 60.
 *   - `cleanSeconds` = tong thoi gian giu DUNG tu the.
 *   - Set dat muc tieu khi `cleanSeconds >= targetSeconds`.
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";

const noop = () => {};

/**
 * useState gia: gia tri tra ve la Proxy doc truc tiep tu o nho,
 * nen test doc state sau khi hook goi setState se thay gia tri moi.
 */
function useState(init) {
  const cell = { v: typeof init === "function" ? init() : init };
  const proxy = new Proxy(
    {},
    {
      get: (_t, key) => cell.v[key],
      set: (_t, key, value) => {
        cell.v = { ...cell.v, [key]: value };
        return true;
      },
      has: (_t, key) => key in cell.v,
      ownKeys: () => Reflect.ownKeys(cell.v),
      getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
    },
  );
  const set = (update) => {
    cell.v = typeof update === "function" ? update(cell.v) : update;
  };
  return [proxy, set];
}

const useRef = (init) => ({ current: init });
const useCallback = (fn) => fn;
const useEffect = noop;

const sandbox = {
  useState,
  useRef,
  useCallback,
  useEffect,
  console,
  Math,
  Date,
  JSON,
  i18n: {
    t: (key) => key,
  },
};
vm.createContext(sandbox);

// Nap usePoseDetection.js de co POSE_LANDMARKS / angleBetween / midpoint.
const poseSource = readFileSync(
  new URL("../src/hooks/usePoseDetection.js", import.meta.url),
  "utf8",
);
vm.runInContext(
  poseSource
    .replace(/import\s+\{[^}]+\}\s+from\s+"[^"]+";/g, "")
    .replace(/import\s+\w+\s+from\s+"[^"]+";/g, "")
    .replace(/export const (\w+) =/g, "globalThis.$1 =")
    .replace(/export function (\w+)\(/g, "globalThis.$1 = function (")
    .replace(/export default function /g, "globalThis.__usePoseDetection = function "),
  sandbox,
);
vm.runInContext(
  "var POSE_LANDMARKS = globalThis.POSE_LANDMARKS, angleBetween = globalThis.angleBetween, midpoint = globalThis.midpoint;",
  sandbox,
);

// Nap utils/formScore.js (ham cham diem dung chung voi usePushUpTracker.js).
const formScoreSource = readFileSync(
  new URL("../src/utils/formScore.js", import.meta.url),
  "utf8",
);
vm.runInContext(
  formScoreSource
    .replace(/import\s+\{[^}]+\}\s+from\s+"[^"]+";/g, "")
    .replace(/import\s+\w+\s+from\s+"[^"]+";/g, "")
    .replace(/export const (\w+) =/g, "globalThis.$1 =")
    .replace(/export function (\w+)\(/g, "globalThis.$1 = function ("),
  sandbox,
);
vm.runInContext(
  "var scoreByDeviation = globalThis.scoreByDeviation, scoreByRange = globalThis.scoreByRange;",
  sandbox,
);

// Nap useHoldTracker.js
const trackerSource = readFileSync(
  new URL("../src/hooks/useHoldTracker.js", import.meta.url),
  "utf8",
);
vm.runInContext(
  trackerSource
    .replace(/import\s+\{[^}]+\}\s+from\s+"[^"]+";/g, "")
    .replace(/import\s+\w+\s+from\s+"[^"]+";/g, "")
    .replace(/export const (\w+) =/g, "globalThis.$1 =")
    .replace(/export function (\w+)\(/g, "globalThis.$1 = function (")
    // Ham `function ten(...)` (khong export) -> gan vao globalThis de onFrame
    // goi duoc trong sandbox.
    .replace(/^function (\w+)\(/gm, "globalThis.$1 = function (")
    .replace(/export default /, "globalThis.__tracker = "),
  sandbox,
);

const tracker = vm.runInContext("globalThis.__tracker", sandbox);
const scoreByDeviationFn = vm.runInContext("globalThis.scoreByDeviation", sandbox);
const scoreByRangeFn = vm.runInContext("globalThis.scoreByRange", sandbox);

const L = {
  LS: 11, RS: 12, LE: 13, RE: 14, LW: 15, RW: 16,
  LH: 23, RH: 24, LK: 25, RK: 26, LA: 27, RA: 28,
};

/**
 * Tao 33 landmark cho bai HOLD o goc may nghieng (side view).
 *
 * Bieu dien co the NAM NGANG trong anh (nhu plank): vai va co chan cung cao.
 * Hong o giua duong thai, lech `hipDrop` theo truc Y:
 *   - `hipDrop > 0` -> hong thap hon duong thai (vong lung).
 *   - `hipDrop < 0` -> hong cao hon duong thai (vong lung nguoc).
 *
 * `bodyAngleDeg` la goc than tai hong (vai-hop-goi). Khi do lech goc can
 * nghien vo duong thai de goc do dung gia tri truyen vao.
 *
 * @param {number} bodyAngleDeg - goc than tai hong (vai-hop-goi)
 * @param {object} options
 * @param {number} options.visibility
 * @param {number} options.hipDrop - do lech Y cua hong so voi duong than.
 * @param {boolean} options.vertical - co than DUNG trong anh (L-sit, dung tay)
 *        thay vi nam ngang. Khi do khong suy ra vong lung du goc be.
 */
function makeHoldPose(bodyAngleDeg, { visibility = 0.95, hipDrop = 0, vertical = false } = {}) {
  const lm = new Array(33).fill(null).map(() => ({ x: 0, y: 0, z: 0, visibility: 0 }));

  // Co than nam ngang: vai (trai) -> co chan (phai).
  const shoulder = { x: 0.30, y: 0.50 };
  const ankle = { x: 0.70, y: 0.50 };

  // Hong o giua duong thai, lech `hipDrop` theo truc Y (y lon hon = thap hon).
  const hip = { x: 0.50, y: 0.50 + hipDrop };

  // Goc tai hip giua vector (vai - hong) va (goi - hong) = bodyAngleDeg.
  // Xoay vector (vai - hong) mot goc bodyAngleDeg theo huong xuong-phai de
  // tim vi tri goi. Cong thuc nay dam bao goc do luon dung bang
  // bodyAngleDeg ke ca khi hong lech khoi duong thai.
  const v1 = { x: shoulder.x - hip.x, y: shoulder.y - hip.y };
  const rad = (bodyAngleDeg * Math.PI) / 180;
  const legLength = 0.15;
  const v2 = {
    x: (v1.x * Math.cos(rad) + v1.y * Math.sin(rad)) * legLength,
    y: (-v1.x * Math.sin(rad) + v1.y * Math.cos(rad)) * legLength,
  };
  const knee = { x: hip.x + v2.x, y: hip.y + v2.y };

  // Co than DUNG: xoay toan bo khung quanh vai 90 do nguoc chieu kim dong ho
  // (vai o tren, co chan o duoi) — dung cho L-sit, dung tay.
  if (vertical) {
    const rotate = (point) => ({
      x: shoulder.x + (point.y - shoulder.y),
      y: shoulder.y - (point.x - shoulder.x),
    });
    const rotatedHip = rotate(hip);
    const rotatedKnee = rotate(knee);
    const rotatedAnkle = rotate(ankle);
    hip.x = rotatedHip.x;
    hip.y = rotatedHip.y;
    knee.x = rotatedKnee.x;
    knee.y = rotatedKnee.y;
    ankle.x = rotatedAnkle.x;
    ankle.y = rotatedAnkle.y;
  }

  lm[L.LS] = { ...shoulder, visibility };
  lm[L.RS] = { ...shoulder, visibility };
  lm[L.LH] = { ...hip, visibility };
  lm[L.RH] = { ...hip, visibility };
  lm[L.LK] = { ...knee, visibility };
  lm[L.RK] = { ...knee, visibility };
  lm[L.LA] = { ...ankle, visibility };
  lm[L.RA] = { ...ankle, visibility };
  return lm;
}

const results = [];
function check(name, actual, expected) {
  const ok = actual === expected;
  results.push({ name, actual, expected, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: actual=${actual} expected=${expected}`);
}

/**
 * Feed mot chuoi frame. Moi frame them `frameMs` ms vao dong ho.
 */
function feed(t, bodyAngleDeg, frameCount, frameMs = 100, options = {}) {
  let clock = t.state.__clock ?? 0;
  for (let i = 0; i < frameCount; i += 1) {
    clock += frameMs;
    t.onFrame(makeHoldPose(bodyAngleDeg, options), clock);
  }
  t.state.__clock = clock;
}

// --- 1. Diem mem theo dung sai (scoreByDeviation) --------------------------
check("diem 100% khi lech <= tolerance/2", scoreByDeviationFn(170, 165, 15), 100);
check("diem 0% khi lech >= tolerance", scoreByDeviationFn(150, 165, 15), 0);
check("diem ~50% khi lech = 3/4 tolerance", scoreByDeviationFn(153.75, 165, 15), 50);
check("diem 0% khi khong do duoc goc", scoreByDeviationFn(null, 165, 15), 0);

// --- 2. Diem theo dai goc (scoreByRange) -----------------------------------
check("diem 100% khi goc trong dai", scoreByRangeFn(170, 165, 180, 15), 100);
check("diem 0% khi goc duoi bien duoi", scoreByRangeFn(150, 165, 180, 15), 0);
check("diem 0% khi goc tren bien tren", scoreByRangeFn(195, 165, 180, 15), 0);
check("diem ~50% khi lech 3/4 tolerance", scoreByRangeFn(153.75, 165, 180, 15), 50);

// --- 3. Khong co nguoi -> dong ho dung, khong tinh gia ---------------------
let t = tracker({ targetSeconds: 10 });
for (let i = 0; i < 10; i += 1) t.onFrame([], i * 100);
check("khong co nguoi => holdSeconds = 0", t.state.holdSeconds, 0);
check("khong co nguoi => cleanSeconds = 0", t.state.cleanSeconds, 0);
check(
  "khong co nguoi => feedback yeu cau buoc vao khung",
  t.state.lastFeedback,
  "member:tracking.feedback.stepIntoFrame",
);

// --- 4. Giu dung tu the: cleanSeconds tang theo thoi gian -----------------
// Rule: goc than 165-180 (nhu EV_PLANK_ADULTFIT_2025), dung sai 15.
t = tracker({ targetSeconds: 30, bodyRule: { minAngle: 165, maxAngle: 180, tolerance: 15 } });
feed(t, 172, 100); // 100 frame x 100ms = 10s
check("giu tot => cleanSeconds = 10", Math.round(t.state.cleanSeconds), 10);
check("giu tot => dirtySeconds = 0", Math.round(t.state.dirtySeconds), 0);
check("giu tot => setComplete = false", t.state.setComplete, false);
check("giu tot => formScore = 100", t.state.formScore, 100);
check("giu tot => overTime = false", t.state.overTime, false);

// --- 5. Set dat muc tieu khi cleanSeconds du targetSeconds -----------------
t = tracker({ targetSeconds: 5, bodyRule: { minAngle: 165, maxAngle: 180, tolerance: 15 } });
feed(t, 172, 60); // 6s giu tot
check("cleanSeconds >= target => setComplete = true", t.state.setComplete, true);
check("holdSeconds = 6", Math.round(t.state.holdSeconds), 6);

// --- 6. Giu SAI tu the: khong tinh vao cleanSeconds ------------------------
t = tracker({ targetSeconds: 5, bodyRule: { minAngle: 165, maxAngle: 180, tolerance: 15 } });
feed(t, 140, 60, 100, { hipDrop: 0.05 }); // goc 140 do -> lech 25 do >= tolerance 15 -> diem 0
check("giu sai => cleanSeconds = 0", Math.round(t.state.cleanSeconds), 0);
check("giu sai => dirtySeconds = 6", Math.round(t.state.dirtySeconds), 6);
check("giu sai => setComplete = false", t.state.setComplete, false);
check("giu sai => formScore = 0", t.state.formScore, 0);
check(
  "giu sai (vong lung) => feedback bao hong tut",
  t.state.lastFeedback,
  "member:tracking.feedback.hipSag",
);

// --- 7. Tong thoi gian du ma giu sai => VAN chua dat (diem chinh) ----------
t = tracker({ targetSeconds: 5, bodyRule: { minAngle: 165, maxAngle: 180, tolerance: 15 } });
feed(t, 140, 60); // 6s giu sai
check("giu sai 6s => holdSeconds = 6", Math.round(t.state.holdSeconds), 6);
check("giu sai 6s => setComplete = false", t.state.setComplete, false);

// --- 8. Vung dung rong: lech 5 do van duoc tinh la dung -------------------
// tolerance 15 -> vung dung rong 7.5 do quanh 165 (va 180).
t = tracker({ targetSeconds: 5, bodyRule: { minAngle: 165, maxAngle: 180, tolerance: 15 } });
feed(t, 160, 20); // 160 do -> trong vung dung rong -> diem 100
check("lech 5 do => cleanSeconds = 2", Math.round(t.state.cleanSeconds), 2);

// --- 9. Fallback khi bai khong co rule -------------------------------------
// Khong co bodyRule -> dung moc 150 do, dung sai 15.
t = tracker({ targetSeconds: 5 });
feed(t, 172, 20);
check("khong co rule => goc 172 duoc tinh la dung", Math.round(t.state.cleanSeconds), 2);

t = tracker({ targetSeconds: 5 });
feed(t, 140, 20);
check("khong co rule => goc 140 khong duoc tinh la dung", Math.round(t.state.cleanSeconds), 0);

// --- 10. Ghi nhan loi form khi giu sai -------------------------------------
// Vong lung: hong thap hon duong than (hipDrop > 0).
t = tracker({ targetSeconds: 5, bodyRule: { minAngle: 165, maxAngle: 180, tolerance: 15 } });
feed(t, 140, 20, 100, { hipDrop: 0.05 });
const issues = t.getFormIssues();
check("ghi nhan loi khi hong tut", issues.length, 1);
const stats = t.getIssueStats();
check("co so lieu do loi khi hong tut", stats.length, 1);
check("measured = goc than thap nhat", stats[0].measured, 140);
check("target = nguong duoi cua rule", stats[0].target, 165);
check("key = hipSag", stats[0].key, "hipSag");
check(
  "feedback bao hong tut",
  t.state.lastFeedback,
  "member:tracking.feedback.hipSag",
);

// Vong lung nguoc: hong cao hon duong than (hipDrop < 0).
t = tracker({ targetSeconds: 5, bodyRule: { minAngle: 165, maxAngle: 180, tolerance: 15 } });
feed(t, 140, 20, 100, { hipDrop: -0.05 });
const pikeStats = t.getIssueStats();
check("key = hipPike khi hong nang", pikeStats[0].key, "hipPike");
check("direction = max khi hong nang", pikeStats[0].direction, "max");
check("target = nguong tren cua rule", pikeStats[0].target, 180);
check(
  "feedback bao hong nang",
  t.state.lastFeedback,
  "member:tracking.feedback.hipPike",
);

// Khong ro vong lung hay vong lung nguoc: hong ngay tren duong thai, chi
// goc than be -> dung loi CHUNG "alignment", KHONG doan lung lung.
t = tracker({ targetSeconds: 5, bodyRule: { minAngle: 165, maxAngle: 180, tolerance: 15 } });
feed(t, 140, 20, 100, { hipDrop: 0 });
const ambiguousStats = t.getIssueStats();
check("khong ro huong -> dung loi chung alignment", ambiguousStats[0].key, "alignment");
check(
  "khong ro huong -> feedback yeu cau siet co loi",
  t.state.lastFeedback,
  "member:tracking.feedback.braceCore",
);

// Co than DUNG (L-sit) -> khong phan biet duoc vong lung / vong lung nguoc,
// phai dung loi CHUNG "alignment".
t = tracker({ targetSeconds: 5, bodyRule: { minAngle: 165, maxAngle: 180, tolerance: 15 } });
feed(t, 140, 20, 100, { hipDrop: 0.05, vertical: true });
const verticalStats = t.getIssueStats();
check("co than dung -> dung loi chung alignment", verticalStats[0].key, "alignment");
check("co than dung -> feedback yeu cau siet co loi", t.state.lastFeedback, "member:tracking.feedback.braceCore");

// --- 11. getSetResults tra cleanSeconds that ------------------------------
t = tracker({ targetSeconds: 30, bodyRule: { minAngle: 165, maxAngle: 180, tolerance: 15 } });
feed(t, 172, 100); // 10s giu tot
feed(t, 140, 50); // 5s giu sai
const setResults = t.getSetResults();
check("getSetResults co 1 set", setResults.length, 1);
check("set totalSeconds = 15", setResults[0].totalSeconds, 15);
check("set cleanSeconds = 10 (thoi gian giu dung)", setResults[0].cleanSeconds, 10);

// --- 12. nextSet chuyen set va giu tong so set da hoan thanh --------------
t = tracker({ targetSeconds: 30, bodyRule: { minAngle: 165, maxAngle: 180, tolerance: 15 } });
feed(t, 172, 100);
t.nextSet(30);
check("sau nextSet: setNumber = 2", t.state.setNumber, 2);
check("sau nextSet: cleanSeconds reset 0", Math.round(t.state.cleanSeconds), 0);
check("sau nextSet: completedSets = 1", t.getSetResults().length, 2);
check("sau nextSet: set complete truoc do = 10s", t.getSetResults()[0].cleanSeconds, 10);

// --- 13. restore sau khi member quay lai tu man nghi ------------------------
t = tracker({ targetSeconds: 30 });
t.restore([{ totalReps: 0, cleanReps: 0, totalSeconds: 30, cleanSeconds: 25 }], 2);
check("restore: setNumber = 2", t.state.setNumber, 2);
check("restore: completedSetCount = 1", t.state.completedSetCount, 1);
check("restore: cleanSeconds reset 0", Math.round(t.state.cleanSeconds), 0);

// --- 14. Canh bao giu qua lau ma tu the chua dung -------------------------
t = tracker({ targetSeconds: 5, bodyRule: { minAngle: 165, maxAngle: 180, tolerance: 15 } });
feed(t, 140, 100); // 10s giu sai -> > 5 * 1.5 = 7.5s
check("giu qua lau => overTime = true", t.state.overTime, true);
check("giu qua lau => setComplete = false", t.state.setComplete, false);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} test passed`);
if (failed.length) process.exit(1);