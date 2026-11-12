/**
 * Kiểm thử logic đếm reps squat mà không cần camera.
 * Chạy: node scripts/verify-squat-tracker.mjs
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";

const noop = () => {};

/**
 * useState giả: giá trị trả về là Proxy đọc trực tiếp từ ô nhớ,
 * nên test đọc state sau khi hook gọi setState sẽ thấy giá trị mới.
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

// Nạp usePoseDetection.js để có POSE_LANDMARKS / angleBetween / midpoint.
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
// Tracker tham chiếu tên trần -> expose vào global của context.
vm.runInContext(
  "var POSE_LANDMARKS = globalThis.POSE_LANDMARKS, angleBetween = globalThis.angleBetween, midpoint = globalThis.midpoint;",
  sandbox,
);

// Nạp useSquatTracker.js
const trackerSource = readFileSync(
  new URL("../src/hooks/useSquatTracker.js", import.meta.url),
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

const L = {
  LS: 11, RS: 12, LH: 23, RH: 24, LK: 25, RK: 26, LA: 27, RA: 28,
};

/** Tạo 33 landmark sao cho góc hip-knee-ankle đúng bằng góc yêu cầu. */
function makePose(kneeAngleDeg, { visibility = 0.95 } = {}) {
  const hip = { x: 0.5, y: 0.5 };
  const knee = { x: 0.5, y: 0.72 };
  // Xoay vector knee->hip quanh knee theo góc yêu cầu để tạo cẳng chân.
  const len = Math.hypot(hip.x - knee.x, hip.y - knee.y);
  const rad = (kneeAngleDeg * Math.PI) / 180;
  const ankle = {
    x: knee.x + Math.sin(rad) * len,
    y: knee.y - Math.cos(rad) * len,
  };
  const lm = new Array(33).fill(null).map(() => ({ x: 0, y: 0, z: 0, visibility: 0 }));
  lm[L.LH] = { ...hip, visibility };
  lm[L.RH] = { ...hip, visibility };
  lm[L.LK] = { ...knee, visibility };
  lm[L.RK] = { ...knee, visibility };
  lm[L.LA] = { ...ankle, visibility };
  lm[L.RA] = { ...ankle, visibility };
  // Vai thẳng trên hông -> góc thân ~180 (lưng thẳng).
  lm[L.LS] = { x: 0.45, y: 0.2, visibility };
  lm[L.RS] = { x: 0.55, y: 0.2, visibility };
  return lm;
}

const results = [];
function check(name, actual, expected) {
  const ok = actual === expected;
  results.push({ name, actual, expected, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: actual=${actual} expected=${expected}`);
}

const feed = (t, deg, n) => {
  for (let i = 0; i < n; i += 1) t.onFrame(makePose(deg));
};

// --- 1. Không có người -> không đếm rep -------------------------------
let t = tracker({ targetReps: 12 });
for (let i = 0; i < 30; i += 1) t.onFrame([]);
check("không có người => reps = 0", t.state.reps, 0);
check("không có người => form 100%", t.state.formScore, 100);
check(
  "không có người => feedback yêu cầu bước vào khung",
  t.state.lastFeedback,
  "Step into the frame so I can track you.",
);

// --- 2. Landmark giả (visibility thấp) -> không đếm rep ----------------
t = tracker({ targetReps: 12 });
for (let i = 0; i < 30; i += 1) t.onFrame(makePose(80, { visibility: 0.2 }));
check("landmark visibility thấp => reps = 0", t.state.reps, 0);

// --- 3. Một rep hợp lệ: đứng -> xuống sâu -> đứng -----------------------
t = tracker({ targetReps: 12 });
feed(t, 175, 6);
feed(t, 150, 3);
feed(t, 85, 10);
feed(t, 175, 6);
check("1 rep hợp lệ => reps = 1", t.state.reps, 1);
check("1 rep hợp lệ => cleanReps = 1", t.state.cleanReps, 1);
check("1 rep hợp lệ => setReps = 1", t.state.setReps, 1);
check("knee angle cập nhật", t.state.kneeAngle, 175);

// --- 4. Ba rep liên tiếp ------------------------------------------------
t = tracker({ targetReps: 12 });
for (let rep = 0; rep < 3; rep += 1) {
  feed(t, 175, 5);
  feed(t, 140, 3);
  feed(t, 85, 10);
  feed(t, 175, 5);
}
check("3 rep => reps = 3", t.state.reps, 3);
check("3 rep => cleanReps = 3", t.state.cleanReps, 3);
check("repsLeft = 12 - 3", t.state.repsLeft, 9);

// --- 5. Rep nông (không đủ sâu) vẫn đếm nhưng không sạch ---------------
t = tracker({ targetReps: 12 });
feed(t, 175, 5);
feed(t, 140, 3);
feed(t, 120, 3);
feed(t, 175, 5);
check("rep nông => reps = 1", t.state.reps, 1);
check("rep nông => cleanReps = 0", t.state.cleanReps, 0);

// --- 6. getSetResults trả về set hiện tại --------------------------------
t = tracker({ targetReps: 12 });
feed(t, 175, 5);
feed(t, 140, 3);
feed(t, 85, 10);
feed(t, 175, 5);
const setResults = t.getSetResults();
check("getSetResults có 1 set", setResults.length, 1);
check("set totalReps = 1", setResults[0].totalReps, 1);
check("set cleanReps = 1", setResults[0].cleanReps, 1);
check("set totalSeconds > 0", setResults[0].totalSeconds > 0, true);

// --- 7. nextSet chuyển set, giữ tổng reps --------------------------------
t.nextSet(12);
check("sau nextSet: setNumber = 2", t.state.setNumber, 2);
check("sau nextSet: setReps reset 0", t.state.setReps, 0);
check("sau nextSet: reps tổng giữ nguyên", t.state.reps, 1);
check("sau nextSet: completedSets = 1", t.getSetResults().length, 2);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} test passed`);
if (failed.length) process.exit(1);
