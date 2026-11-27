/**
 * Kiem thu logic dem reps + cham form cho push-up ma khong can camera.
 * Chay: node scripts/verify-pushup-tracker.mjs
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
    t: (key) =>
      key === "member:tracking.feedback.stepIntoFrame"
        ? "Step into the frame so I can track you."
        : key,
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

// Nap utils/formScore.js de co scoreByDeviation / scoreByRange (dung chung
// voi useHoldTracker.js).
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

// Nap usePushUpTracker.js
const trackerSource = readFileSync(
  new URL("../src/hooks/usePushUpTracker.js", import.meta.url),
  "utf8",
);
vm.runInContext(
  trackerSource
    .replace(/import\s+\{[^}]+\}\s+from\s+"[^"]+";/g, "")
    .replace(/import\s+\w+\s+from\s+"[^"]+";/g, "")
    .replace(/export const (\w+) =/g, "globalThis.$1 =")
    .replace(/export function (\w+)\(/g, "globalThis.$1 = function (")
    .replace(/export default /, "globalThis.__tracker = "),
  sandbox,
);

const tracker = vm.runInContext("globalThis.__tracker", sandbox);
const scoreDepthRatio = vm.runInContext("globalThis.scoreDepthRatio", sandbox);
const scoreControl = vm.runInContext("globalThis.scoreControl", sandbox);

const L = {
  LS: 11, RS: 12, LE: 13, RE: 14, LW: 15, RW: 16,
  LH: 23, RH: 24, LK: 25, RK: 26, LA: 27, RA: 28,
};

/**
 * Tao 33 landmark cho push-up o goc may nghieng (side view).
 *
 * @param {number} elbowAngleDeg - goc khu yu tai (0 = thang, 180 = gap nguoc)
 * @param {object} options
 * @param {number} options.wristY - toa do Y cua co tay (px trong anh, 0..1)
 * @param {number} options.visibility
 */
function makePushUpPose(elbowAngleDeg, { wristY = 0.5, visibility = 0.95 } = {}) {
  const lm = new Array(33).fill(null).map(() => ({ x: 0, y: 0, z: 0, visibility: 0 }));

  // Co tay nam ngang phia duoi, vai nam ngang phia tren.
  const wrist = { x: 0.35, y: wristY };
  const shoulder = { x: 0.35, y: wristY - 0.25 };

  // Khu yu: goc tai khu yu = elbowAngle.
  // Vai va co tay cung X, cach nhau D. Dat khu yu ngoai tam giac vuong:
  // canh doi = (D/2) / tan(goc/2) -> goc tai khu yu dung bang goc mong muon.
  const rad = (elbowAngleDeg * Math.PI) / 180;
  const span = Math.abs(wrist.y - shoulder.y);
  const opposite = span / 2 / Math.tan(rad / 2);
  const elbow = {
    x: shoulder.x - opposite,
    y: (shoulder.y + wrist.y) / 2,
  };

  lm[L.LS] = { ...shoulder, visibility };
  lm[L.RS] = { ...shoulder, visibility };
  lm[L.LE] = { ...elbow, visibility };
  lm[L.RE] = { ...elbow, visibility };
  lm[L.LW] = { ...wrist, visibility };
  lm[L.RW] = { ...wrist, visibility };

  // Than thang: vai - hong - cot chan deu tren mot duong thang.
  const hip = { x: 0.35, y: wristY - 0.5 };
  const knee = { x: 0.35, y: wristY - 0.75 };
  const ankle = { x: 0.35, y: wristY - 1.0 };
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
 * Feed mot chuoi frame: goc khu yu + do sau (khoang cach doc vai-co tay).
 */
function feed(t, elbowDeg, wristY, n) {
  for (let i = 0; i < n; i += 1) t.onFrame(makePushUpPose(elbowDeg, { wristY }));
}

// --- 1. Khong co nguoi -> khong dem rep ---------------------------------
let t = tracker({ targetReps: 12 });
for (let i = 0; i < 30; i += 1) t.onFrame([]);
check("khong co nguoi => reps = 0", t.state.reps, 0);
check("khong co nguoi => form 100%", t.state.formScore, 100);
check(
  "khong co nguoi => feedback yeu cau buoc vao khung",
  t.state.lastFeedback,
  "Step into the frame so I can track you.",
);

// --- 2. Landmark gia (visibility thap) -> khong dem rep ------------------
t = tracker({ targetReps: 12 });
for (let i = 0; i < 30; i += 1) {
  t.onFrame(makePushUpPose(170, { visibility: 0.2 }));
}
check("landmark visibility thap => reps = 0", t.state.reps, 0);

// --- 3. Mot rep hop le: tay duoi het -> xuong sau -> duoi het -----------
// Tai duoi het: co tay y = 0.75 (xa vai). Xuong sau: co tay y = 0.55.
t = tracker({ targetReps: 12 });
feed(t, 170, 0.75, 6);
feed(t, 130, 0.65, 3);
feed(t, 90, 0.55, 8);
feed(t, 170, 0.75, 6);
check("1 rep hop le => reps = 1", t.state.reps, 1);
check("1 rep hop le => cleanReps = 1", t.state.cleanReps, 1);
check("1 rep hop le => setReps = 1", t.state.setReps, 1);
check("elbow angle cap nhat", t.state.elbowAngle, 170);

// --- 4. Ba rep lien tiep --------------------------------------------------
t = tracker({ targetReps: 12 });
for (let rep = 0; rep < 3; rep += 1) {
  feed(t, 170, 0.75, 5);
  feed(t, 130, 0.65, 3);
  feed(t, 90, 0.55, 8);
  feed(t, 170, 0.75, 5);
}
check("3 rep => reps = 3", t.state.reps, 3);
check("3 rep => cleanReps = 3", t.state.cleanReps, 3);
check("repsLeft = 12 - 3", t.state.repsLeft, 9);

// --- 5. Rep nong (khong du sau) dem nhung khong sach --------------------
t = tracker({ targetReps: 12 });
feed(t, 170, 0.75, 5);
feed(t, 140, 0.72, 3);
feed(t, 130, 0.70, 4);
feed(t, 170, 0.75, 5);
check("rep nong => reps = 1", t.state.reps, 1);
check("rep nong => cleanReps = 0", t.state.cleanReps, 0);

// --- 6. getSetResults tra ve set hien tai --------------------------------
t = tracker({ targetReps: 12 });
feed(t, 170, 0.75, 5);
feed(t, 130, 0.65, 3);
feed(t, 90, 0.55, 8);
feed(t, 170, 0.75, 5);
const setResults = t.getSetResults();
check("getSetResults co 1 set", setResults.length, 1);
check("set totalReps = 1", setResults[0].totalReps, 1);
check("set cleanReps = 1", setResults[0].cleanReps, 1);
check("set totalSeconds > 0", setResults[0].totalSeconds > 0, true);

// --- 7. nextSet chuyen set, giu tong reps --------------------------------
t.nextSet(12);
check("sau nextSet: setNumber = 2", t.state.setNumber, 2);
check("sau nextSet: setReps reset 0", t.state.setReps, 0);
check("sau nextSet: reps tong giu nguyen", t.state.reps, 1);
check("sau nextSet: completedSets = 1", t.getSetResults().length, 2);

// --- 8. Diem do sau theo goc khu yu -------------------------------------
// Dat khi goc day da dat nguong day (lech <= tolerance/2).
check("do sau 100% khi goc day = nguong day", scoreDepthRatio(97, 97, 20), 100);
check("do sau 0% khi lech >= tolerance", scoreDepthRatio(77, 97, 20), 0);
check("do sau 50% khi lech = 3/4 tolerance", scoreDepthRatio(82, 97, 20), 50);
check("do sau 0% khi khong co goc", scoreDepthRatio(null, 97, 20), 0);

// --- 9. Diem control theo jitter ----------------------------------------
check("control 100% khi goc bat bien", scoreControl([90, 90, 90, 90, 90]), 100);
check("control < 100% khi goc dao don", scoreControl([90, 150, 90, 150, 90]) < 100, true);

// --- 10. Rep co diem duoi nguong sach ------------------------------------
// Diem = depth 100 + alignment 100 + control 100 + extension 100 = 100 >= 85.
t = tracker({ targetReps: 12 });
feed(t, 170, 0.75, 5);
feed(t, 130, 0.65, 3);
feed(t, 90, 0.55, 8);
feed(t, 170, 0.75, 5);
const repScores = t.getRepScores();
check("co 1 diem rep", repScores.length, 1);
check("diem rep >= 85 (rep sach)", repScores[0] >= 85, true);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} test passed`);
if (failed.length) process.exit(1);
