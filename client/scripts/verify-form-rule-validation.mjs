/**
 * Kiem thu validate nguong cham form + mapping loi server -> field.
 *
 * Chay: node scripts/verify-form-rule-validation.mjs
 *
 * Muc dich: dam bao khi CM tao bai tap, loi bao ra CHI RO field nao sai
 * (dung ngay tai o nhap) thay vi thong bao chung "du lieu khong hop le".
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = { console, Math, Number, Array, Set, Map, Object, String, isFinite, JSON };
vm.createContext(sandbox);

const utilsSource = readFileSync(
  new URL("../src/components/exercise/formRuleUtils.js", import.meta.url),
  "utf8",
);
vm.runInContext(
  utilsSource
    .replace(/export const (\w+) =/g, "globalThis.$1 =")
    .replace(/export function (\w+)\(/g, "globalThis.$1 = function ("),
  sandbox,
);

const validateFormRules = vm.runInContext("globalThis.validateFormRules", sandbox);
const groupRuleErrors = vm.runInContext("globalThis.groupRuleErrors", sandbox);

const results = [];
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
}

/** Rule hợp lệ cho bài HOLD. */
const validHold = { joint: "HIP", minAngle: "75", maxAngle: "105", weight: "0.6", tolerance: "15" };

// --- 1. Rule hợp lệ -> khong loi -----------------------------------------
check(
  "rule HOLD hop le -> khong loi",
  validateFormRules([validHold], "HOLD"),
  [],
);

check(
  "rule REPS hop le -> khong loi",
  validateFormRules(
    [{ joint: "KNEE", angleThreshold: "165", romDepth: "90", weight: "0.6", tolerance: "15" }],
    "REPS",
  ),
  [],
);

// --- 2. minAngle > maxAngle -> bao loi minGreaterThanMax --------------------
check(
  "minAngle > maxAngle -> bao loi",
  validateFormRules([{ ...validHold, minAngle: "120", maxAngle: "90" }], "HOLD"),
  [{ ruleIndex: 0, field: "minAngle", key: "minGreaterThanMax" }],
);

// --- 3. Goc ngoai 0-180 -> bao loi ------------------------------------------
check(
  "minAngle = 200 -> ngoai khoang",
  validateFormRules([{ ...validHold, minAngle: "200" }], "HOLD"),
  [{ ruleIndex: 0, field: "minAngle", key: "angleOutOfRange" }],
);

check(
  "tolerance = -5 -> ngoai khoang",
  validateFormRules([{ ...validHold, tolerance: "-5" }], "HOLD"),
  [{ ruleIndex: 0, field: "tolerance", key: "angleOutOfRange" }],
);

check(
  "weight = 1.5 -> ngoai khoang",
  validateFormRules([{ ...validHold, weight: "1.5" }], "HOLD"),
  [{ ruleIndex: 0, field: "weight", key: "weightOutOfRange" }],
);

// --- 4. Khong co nguong nao -> bao loi needThreshold ------------------------
check(
  "khong co goc nao -> bao loi",
  validateFormRules([{ joint: "HIP", weight: "0.6" }], "HOLD"),
  [{ ruleIndex: 0, field: "minAngle", key: "needThreshold" }],
);

// --- 5. Khac joint -> bao loi ---------------------------------------------
check(
  "joint rong -> bao loi",
  validateFormRules([{ ...validHold, joint: "" }], "HOLD"),
  [{ ruleIndex: 0, field: "joint", key: "jointRequired" }],
);

check(
  "joint la -> bao loi",
  validateFormRules([{ ...validHold, joint: "SPINE" }], "HOLD"),
  [{ ruleIndex: 0, field: "joint", key: "jointUnknown" }],
);

// --- 6. Bai REPS duoc bao loi o field "angleThreshold" ----------------------
check(
  "bai REPS khong co nguong -> bao loi o goc tren",
  validateFormRules([{ joint: "KNEE" }], "REPS"),
  [{ ruleIndex: 0, field: "angleThreshold", key: "needThreshold" }],
);

// --- 7. Qua 6 rule -> bao loi chung ---------------------------------------
const many = Array.from({ length: 7 }, () => validHold);
check(
  "7 rule -> bao loi qua so luong",
  validateFormRules(many, "HOLD"),
  [{ ruleIndex: -1, field: "count", key: "tooMany" }],
);

// --- 8. Nhieu rule sai -> bao loi tung rule, dung index --------------------
const two = [
  { ...validHold, minAngle: "120", maxAngle: "90" },
  { ...validHold, weight: "5" },
];
check(
  "2 rule sai -> bao loi tung rule",
  validateFormRules(two, "HOLD"),
  [
    { ruleIndex: 0, field: "minAngle", key: "minGreaterThanMax" },
    { ruleIndex: 1, field: "weight", key: "weightOutOfRange" },
  ],
);

// --- 9. groupRuleErrors gom theo rule ------------------------------------
const grouped = groupRuleErrors(validateFormRules(two, "HOLD"));
check(
  "group theo rule -> 2 nhom",
  grouped.size,
  2,
);
check(
  "group rule 0 -> field minAngle",
  [...grouped.get(0)],
  ["minAngle"],
);
check(
  "group rule 1 -> field weight",
  [...grouped.get(1)],
  ["weight"],
);

// --- 10. Rule rong -> khong loi (CM chua them rule) ------------------------
check(
  "danh sach rong -> khong loi",
  validateFormRules([], "HOLD"),
  [],
);

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} test passed`);
if (failed.length) process.exit(1);
