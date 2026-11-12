/**
 * Kiểm tra mọi key `t("...")` trong các màn hình Storage đều có trong cả hai file locale.
 *
 * Chạy: node scripts/check-storage-i18n.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import en from "../src/i18n/locales/en/storage.js";
import vi from "../src/i18n/locales/vi/storage.js";

const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? flatten(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );

const enKeys = new Set(flatten(en));
const viKeys = new Set(flatten(vi));

const missingInVi = [...enKeys].filter((k) => !viKeys.has(k));
const missingInEn = [...viKeys].filter((k) => !enKeys.has(k));

console.log(`locale keys — en: ${enKeys.size} · vi: ${viKeys.size}`);
if (missingInVi.length) console.log(`MISSING IN VI:\n  ${missingInVi.join("\n  ")}`);
if (missingInEn.length) console.log(`MISSING IN EN:\n  ${missingInEn.join("\n  ")}`);
if (!missingInVi.length && !missingInEn.length) console.log("OK — the two locale files have the same keys.");

// ---- The keys the screens ask for -----------------------------------------------

const PAGES = join(import.meta.dirname, "..", "src", "pages");
const FILES = [
  join(PAGES, "AdminStoragePage.jsx"),
  ...readdirSync(join(PAGES, "storage")).map((f) => join(PAGES, "storage", f)),
];

/** Every `t("...")` / `t(`...`)` literal of a file. */
const usedKeys = (source) => {
  const keys = new Set();
  const pattern = /\bt\(\s*["'`]([a-zA-Z0-9_.]+)["'`]/g;
  let match;
  while ((match = pattern.exec(source)) !== null) keys.add(match[1]);
  return keys;
};

const problems = [];
for (const file of FILES) {
  const source = readFileSync(file, "utf8");
  for (const key of usedKeys(source)) {
    // The plural forms of i18next: `key_one` / `key_other`.
    const hasPlural = [...enKeys].some((k) => k === key || k.startsWith(`${key}_`));
    if (!hasPlural) problems.push(`${file.split(/[\\/]/).pop()}: t("${key}")`);
  }
}

if (problems.length) {
  console.log(`\nUNKNOWN KEYS (${problems.length}):\n  ${problems.join("\n  ")}`);
} else {
  console.log("OK — every t() key of the storage screens exists in the locale files.");
}
