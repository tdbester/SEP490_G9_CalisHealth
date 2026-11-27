/**
 * So sanh cach tinh giua hai bai HOLD: Plank (than thang) va L-sit / Boat hold
 * (co the DUNG, chan ngang).
 *
 * Chay: node scripts/demo-hold-scoring.mjs
 *
 * Muc dich: cho thay ro khac biet cua Hinh B giua hai dang co the:
 *   - Plank  : vai + co chan cung cao, thang, goc than ~180 do.
 *   - L-sit  : vai tren, co chan duoi, chan ngang, goc than ~90 do.
 *
 * Ca hai dung CHUNG mot hook (useHoldTracker) va CHUNG mot ham cham diem
 * (scoreByRange) — khac nhau o RULE (dai goc) lay tu bang form_rules.
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";

const noop = () => {};

/** useState gia: gia tri tra ve la Proxy doc truc tiep tu o nho. */
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
  i18n: { t: (key) => key },
};
vm.createContext(sandbox);

const strip = (src) =>
  src
    .replace(/import\s+\{[^}]+\}\s+from\s+"[^"]+";/g, "")
    .replace(/import\s+\w+\s+from\s+"[^"]+";/g, "")
    .replace(/export const (\w+) =/g, "globalThis.$1 =")
    .replace(/export function (\w+)\(/g, "globalThis.$1 = function (")
    .replace(/^function (\w+)\(/gm, "globalThis.$1 = function (")
    .replace(/export default /, "globalThis.__tracker = ");

vm.runInContext(
  strip(
    readFileSync(new URL("../src/hooks/usePoseDetection.js", import.meta.url), "utf8"),
  ),
  sandbox,
);
vm.runInContext(
  "var POSE_LANDMARKS = globalThis.POSE_LANDMARKS, angleBetween = globalThis.angleBetween, midpoint = globalThis.midpoint;",
  sandbox,
);

vm.runInContext(
  strip(readFileSync(new URL("../src/utils/formScore.js", import.meta.url), "utf8")),
  sandbox,
);
vm.runInContext(
  "var scoreByRange = globalThis.scoreByRange;",
  sandbox,
);

vm.runInContext(
  strip(readFileSync(new URL("../src/hooks/useHoldTracker.js", import.meta.url), "utf8")),
  sandbox,
);

const tracker = vm.runInContext("globalThis.__tracker", sandbox);

const L = {
  LS: 11, RS: 12, LE: 13, RE: 14, LW: 15, RW: 16,
  LH: 23, RH: 24, LK: 25, RK: 26, LA: 27, RA: 28,
};

/**
 * Tao landmark cho co the.
 *
 * @param {number} bodyAngleDeg - goc than tai hong (vai-hop-goi)
 * @param {object} options
 * @param {number} options.visibility
 * @param {number} options.hipDrop - lech Y cua hong so voi duong than.
 *        > 0 -> hong thap hon duong than (vong lung).
 *        < 0 -> hong cao hon duong than (vong lung nguoc).
 * @param {"horizontal"|"vertical"} options.posture - dang co the
 */
function makePose(bodyAngleDeg, { visibility = 0.95, hipDrop = 0, posture = "horizontal" } = {}) {
  const lm = new Array(33).fill(null).map(() => ({ x: 0, y: 0, z: 0, visibility: 0 }));

  // Co the NAM NGANG (plank): vai (trai) -> co chan (phai), cung cao.
  let shoulder = { x: 0.30, y: 0.50 };
  let hip = { x: 0.50, y: 0.50 + hipDrop };
  let ankle = { x: 0.70, y: 0.50 };

  // Co the DUNG (L-sit): vai o tren, co chan o duoi.
  // `hipDrop` o day la lech X (ngang), vi than dung -> lech doc khong co y nghia.
  if (posture === "vertical") {
    shoulder = { x: 0.50, y: 0.25 };
    hip = { x: 0.50 + hipDrop, y: 0.50 };
    ankle = { x: 0.50, y: 0.75 };
  }

  // Goc tai hip giua vector (vai - hip) va (goi - hip) = bodyAngleDeg.
  const v1 = { x: shoulder.x - hip.x, y: shoulder.y - hip.y };
  const rad = (bodyAngleDeg * Math.PI) / 180;
  const legLength = 0.15;
  const v2 = {
    x: (v1.x * Math.cos(rad) + v1.y * Math.sin(rad)) * legLength,
    y: (-v1.x * Math.sin(rad) + v1.y * Math.cos(rad)) * legLength,
  };
  const knee = { x: hip.x + v2.x, y: hip.y + v2.y };

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

function feed(t, bodyAngleDeg, frameCount, frameMs = 100, options = {}) {
  let clock = t.state.__clock ?? 0;
  for (let i = 0; i < frameCount; i += 1) {
    clock += frameMs;
    t.onFrame(makePose(bodyAngleDeg, options), clock);
  }
  t.state.__clock = clock;
}

/** Rule lay tu bang form_rules trong DB (V91). */
const RULES = {
  plank: { minAngle: 165, maxAngle: 180, tolerance: 15 },
  lsit: { minAngle: 75, maxAngle: 105, tolerance: 15 },
};

function line(char = "-", n = 74) {
  return char.repeat(n);
}

console.log(line("="));
console.log("SO SANH: PLANK vs L-SIT (BOAT HOLD) — cung hook, cung ham cham diem");
console.log(line("="));

// ---------------------------------------------------------------------------
// 1. Bang diem goc theo tung bai
// ---------------------------------------------------------------------------
console.log("\n[1] BANG DIEM GOC — cung 1 ham scoreByRange, khac o DAI GOC\n");

for (const [name, rule] of Object.entries(RULES)) {
  const label = name === "plank" ? "PLANK  (EX_4)" : "L-SIT  (EX_38)";
  console.log(`${label}  rule: min=${rule.minAngle} max=${rule.maxAngle} tol=${rule.tolerance}`);
  const angles =
    name === "plank"
      ? [180, 172, 165, 160, 157, 155, 150, 145, 140]
      : [105, 100, 90, 80, 75, 70, 65, 60, 45];
  console.log("   goc than |  diem  | xep loai");
  for (const a of angles) {
    const s = vm.runInContext("scoreByRange", sandbox)(a, rule.minAngle, rule.maxAngle, rule.tolerance);
    console.log(
      `   ${String(a).padStart(8)} | ${String(s).padStart(6)} | ${s >= 60 ? "CLEAN" : "dirty"}`,
    );
  }
  console.log("");
}

// ---------------------------------------------------------------------------
// 2. Cung mot nguoi, cung mot loi sai — ket qua khac nhau ra sao?
// ---------------------------------------------------------------------------
console.log(line("="));
console.log("[2] CUNG MOT LOI SAI — 'HA NGANG GOC MOT CHUT' — ket qua ra sao?");
console.log(line("="));

// Plank: nguoi giu than thang 172 do (tot), roi rut xuong 160 (vong lung nhe).
{
  const t = tracker({ targetSeconds: 30, bodyRule: RULES.plank });
  feed(t, 172, 200, 100, { posture: "horizontal" }); // 20s tot
  feed(t, 160, 100, 100, { posture: "horizontal" }); // 10s rut xuong
  const s = t.state;
  console.log("\nPLANK  (dai 165-180):");
  console.log(`  tong giu      : ${Math.round(s.holdSeconds)}s`);
  console.log(`  cleanSeconds  : ${Math.round(s.cleanSeconds)}s  (muc tieu 30s)`);
  console.log(`  dirtySeconds  : ${Math.round(s.dirtySeconds)}s`);
  console.log(`  formScore     : ${s.formScore}%`);
  console.log(`  setComplete   : ${s.setComplete}`);
  console.log(`  feedback      : ${s.lastFeedback}`);
}

// L-sit: nguoi giu chan ngang 90 do (tot), roi rut xuong 70 (hong tụt).
{
  const t = tracker({ targetSeconds: 30, bodyRule: RULES.lsit });
  feed(t, 90, 200, 100, { posture: "vertical" }); // 20s tot
  feed(t, 70, 100, 100, { posture: "vertical" }); // 10s rut xuong
  const s = t.state;
  console.log("\nL-SIT  (dai 75-105):");
  console.log(`  tong giu      : ${Math.round(s.holdSeconds)}s`);
  console.log(`  cleanSeconds  : ${Math.round(s.cleanSeconds)}s  (muc tieu 30s)`);
  console.log(`  dirtySeconds  : ${Math.round(s.dirtySeconds)}s`);
  console.log(`  formScore     : ${s.formScore}%`);
  console.log(`  setComplete   : ${s.setComplete}`);
  console.log(`  feedback      : ${s.lastFeedback}`);
}

// ---------------------------------------------------------------------------
// 3. LOI VONG LUNG: hong TUT khoi duong than (khong phai chi goc be)
// ---------------------------------------------------------------------------
console.log("\n" + line("="));
console.log("[3] VONG LUNG — hop nhat 'goc be' va 'hong tut' thanh mot hien tuong");
console.log(line("="));

{
  // Plank: goc be 150 do VA hong tut khoi duong than -> vong lung that.
  const t = tracker({ targetSeconds: 30, bodyRule: RULES.plank });
  feed(t, 172, 200, 100, { posture: "horizontal" });
  feed(t, 150, 100, 100, { posture: "horizontal", hipDrop: 0.06 });
  console.log("\nPLANK  goc 150 do + hong tut (hipDrop=+0.06):");
  console.log(`  cleanSeconds : ${Math.round(t.state.cleanSeconds)}s`);
  console.log(`  feedback     : ${t.state.lastFeedback}`);
  console.log(`  issue key    : ${t.getIssueStats()[0]?.key}`);
  console.log(`  sag          : ${t.state.hipDeviation?.sag?.toFixed(4)}`);
}

{
  // Plank: goc be 150 do nhưng hong VAN ngay tren duong than
  // -> khong doan duoc vong lung hay vong lung nguoc -> loi chung.
  const t = tracker({ targetSeconds: 30, bodyRule: RULES.plank });
  feed(t, 172, 200, 100, { posture: "horizontal" });
  feed(t, 150, 100, 100, { posture: "horizontal", hipDrop: 0 });
  console.log("\nPLANK  goc 150 do, hong ngay tren duong than (hipDrop=0):");
  console.log(`  cleanSeconds : ${Math.round(t.state.cleanSeconds)}s`);
  console.log(`  feedback     : ${t.state.lastFeedback}`);
  console.log(`  issue key    : ${t.getIssueStats()[0]?.key}`);
  console.log(`  sag          : ${t.state.hipDeviation?.sag?.toFixed(4)}`);
}

{
  // Plank: vong lung nguoc — hong cao hon duong than.
  const t = tracker({ targetSeconds: 30, bodyRule: RULES.plank });
  feed(t, 172, 200, 100, { posture: "horizontal" });
  feed(t, 150, 100, 100, { posture: "horizontal", hipDrop: -0.06 });
  console.log("\nPLANK  goc 150 do + hong nang (hipDrop=-0.06):");
  console.log(`  cleanSeconds : ${Math.round(t.state.cleanSeconds)}s`);
  console.log(`  feedback     : ${t.state.lastFeedback}`);
  console.log(`  issue key    : ${t.getIssueStats()[0]?.key}`);
  console.log(`  sag          : ${t.state.hipDeviation?.sag?.toFixed(4)}`);
}

// ---------------------------------------------------------------------------
// 4. VAI - CAMERA: bai nao can camera ben hong, bai nao khong?
// ---------------------------------------------------------------------------
console.log("\n" + line("="));
console.log("[4] CAI DAT CAMERA — suy ra tu 'co than nam ngang hay dung'");
console.log(line("="));

for (const [name, rule] of Object.entries(RULES)) {
  const t = tracker({ targetSeconds: 30, bodyRule: rule });
  const posture = name === "plank" ? "horizontal" : "vertical";
  feed(t, name === "plank" ? 172 : 90, 10, 100, { posture });
  const dev = t.state.hipDeviation;
  console.log(
    `${name.padEnd(6)} co than ${posture.padEnd(10)} -> horizontal=${dev?.horizontal}  sag=${dev?.sag?.toFixed(4)}`,
  );
}
console.log(
  "\n=> PLANK (nam ngang): phan biet duoc vong lung / vong lung nguoc.",
);
console.log(
  "=> L-SIT (dung):     khong phan biet duoc -> dung loi chung 'alignment'.",
);

// ---------------------------------------------------------------------------
// 5. Ket qua gui len server
// ---------------------------------------------------------------------------
console.log("\n" + line("="));
console.log("[5] DU LIEU GUI LEN SERVER (set moi) — server tu tinh lai");
console.log(line("="));

for (const [name, rule] of Object.entries(RULES)) {
  const t = tracker({ targetSeconds: 30, bodyRule: rule });
  const posture = name === "plank" ? "horizontal" : "vertical";
  feed(t, name === "plank" ? 172 : 90, 200, 100, { posture }); // 20s tot
  feed(t, name === "plank" ? 150 : 70, 100, 100, { posture }); // 10s sai
  const sets = t.getSetResults();
  const s = sets[sets.length - 1];
  const cleanRate = Math.round((s.cleanSeconds / s.totalSeconds) * 100);
  console.log(`\n${name}:`);
  console.log(`  totalSeconds : ${s.totalSeconds}s`);
  console.log(`  cleanSeconds : ${s.cleanSeconds}s`);
  console.log(`  % clean       : ${cleanRate}%  (server tinh lai tu 2 so lieu nay)`);
  console.log(
    `  set dat (can cleanSeconds >= 30): ${s.cleanSeconds >= 30}`,
  );
}

console.log("\n" + line("="));
console.log("KET LUAN");
console.log(line("="));
console.log(`
Hai bai dung CHUNG:
  - cung hook useHoldTracker
  - cung ham scoreByRange
  - cung co che cleanSeconds / dirtySeconds / setComplete theo cleanSeconds
  - cung co che feedback phan biet loi

Khac nhau CHI o rule (dai goc) lay tu bang form_rules:
  - Plank : than thang, goc than 165-180 do
  - L-sit : chan ngang, goc than 75-105 do

Neu KHONG co rule (bai chua seed), ca hai rơi ve fallback 150-180 do ->
  L-sit se bi chiem diem SAI 100% thoi gian (gia tri 90 do < 150).
  => Day la ly do V91 phai seed rule cho tung bai.
`);
