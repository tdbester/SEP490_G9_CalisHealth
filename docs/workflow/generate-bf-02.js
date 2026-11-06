/* Generates a classic UML-style activity diagram (swimlanes + decisions) as SVG. */
const fs = require("fs");
const path = require("path");

const W = 1440;
const LANES = [
  { id: "A", x0: 24, x1: 404, title: "Content Manager / Admin", sub: "" },
  { id: "B", x0: 404, x1: 784, title: "Member", sub: "" },
  { id: "C", x0: 784, x1: 1416, title: "System", sub: "" },
];
const H = 4520;

const n = {};
const box = (id, cx, y0, y1, w, lines, lane) => (n[id] = { id, kind: "box", cx, y0, y1, w, lines, lane });
const dec = (id, cx, cy, w, h, lines) => (n[id] = { id, kind: "dec", cx, cy, w, h, lines, lane: "C" });

// ---- PHASE 0 : Content Manager defines the level benchmark ----
box("a1", 214, 166, 220, 264, ["Open 'Level & Benchmark Criteria'"], "A");
box("a2", 214, 250, 316, 264, ["Add exercises and set the", "1-point / 2-point thresholds"], "A");
box("a3", 214, 346, 412, 264, ["Name the levels and their", "contiguous score ranges (N to 3N)"], "A");
box("a4", 214, 442, 496, 264, ["Click 'Save All Changes'"], "A");
dec("d1", 1170, 560, 236, 112, ["Configuration", "valid?"]);
box("e1", 900, 529, 591, 200, ["Send error: invalid", "configuration —", "nothing is saved"], "C");
box("p1", 1170, 650, 716, 300, ["Save the levels and the", "shared thresholds"], "C");
box("p2", 1170, 746, 838, 320, ["Auto-create the Level test", "questions (…_MAX_REPS /", "…_MAX_SECONDS) and link", "them to the LEVEL_TEST step"], "C");

// ---- PHASE 1 : Admin builds the survey steps ----
box("a5", 214, 890, 944, 264, ["Open 'Survey Management'"], "A");
box("a6", 214, 974, 1040, 264, ["Click 'Create step' and add", "questions from the bank"], "A");
box("a7", 214, 1070, 1152, 264, ["Set Required, validation rules", "and 'show only when…'", "conditions"], "A");
box("a8", 214, 1182, 1236, 264, ["Click 'Save changes'"], "A");
dec("d2", 1170, 1300, 240, 112, ["Step valid and", "revision current?"]);
box("e2", 900, 1267, 1333, 200, ["Send error: step changed", "or invalid questions"], "C");
box("p3", 1170, 1390, 1444, 280, ["Save the step as DRAFT"], "C");
box("a9", 214, 1474, 1556, 264, ["Preview (optional), reorder,", "then 'Save order'"], "A");
box("a10", 214, 1586, 1640, 264, ["Click 'Activate'"], "A");
dec("d3", 1170, 1700, 250, 112, ["At least one active", "question?"]);
box("e3", 900, 1667, 1733, 200, ["Send error: an empty", "step cannot go live"], "C");
box("p4", 1170, 1790, 1856, 300, ["Publish the step to the", "member journey"], "C");
box("a11", 214, 1886, 1984, 300, ["Configure the Result step:", "what to show, plan weeks,", "sessions and fallback level"], "A");
box("p5", 1170, 2014, 2068, 300, ["Save the result configuration"], "C");

// ---- PHASE 2 : Member takes the survey ----
box("b1", 594, 2110, 2176, 260, ["Log in and open the", "onboarding survey"], "B");
dec("d4", 1170, 2250, 250, 112, ["Survey session", "already started?"]);
box("p6", 1170, 2340, 2394, 300, ["Resume the session", "with its saved answers"], "C");
box("p7", 900, 2219, 2281, 200, ["Start a new session on", "the active survey version"], "C");
box("b2", 594, 2520, 2586, 280, ["Answer each step and", "click 'Continue'"], "B");
box("p8", 1170, 2626, 2692, 300, ["Validate and save the", "answers of that step"], "C");
dec("d6", 1170, 2756, 230, 108, ["All answers valid?"]);
box("e5", 900, 2725, 2787, 200, ["Send error: invalid", "answers — nothing saved"], "C");
box("p9", 1170, 2850, 2904, 300, ["Save the answers, show", "the next step"], "C");
box("b3", 594, 2944, 3010, 280, ["Complete the Level test", "(reps / seconds)"], "B");
box("b4", 594, 3050, 3104, 280, ["Click 'Finish'"], "B");
dec("d7", 1170, 3170, 250, 110, ["Every required answer", "present?"]);
box("e6", 900, 3137, 3203, 200, ["Send error: survey", "incomplete"], "C");
box("p10", 1170, 3265, 3331, 320, ["Score with the benchmark table", "(1, 2 or 3 points per exercise)"], "C");
box("p11", 1170, 3365, 3457, 340, ["Apply the rules: any zero rep →", "lowest level; an uneven result", "costs one level"], "C");
dec("d8", 1170, 3555, 250, 110, ["Level scored", "successfully?"]);
box("p13", 900, 3522, 3588, 200, ["Use the fallback level", "from the Result step"], "C");
box("p12", 1170, 3650, 3716, 300, ["Match the total score to", "a level range"], "C");
box("p14", 1170, 3756, 3822, 320, ["Build the recommended plan", "(level + days per week)"], "C");
box("p15", 1170, 3862, 3954, 340, ["Save the result, complete the", "session, sync the profile and", "the first BMI record"], "C");

// ---- PHASE 3 : Result, preview, start ----
box("b5", 594, 3994, 4060, 280, ["See the level result", "and breakdown"], "B");
box("b6", 594, 4100, 4154, 280, ["Click 'Preview training plan'"], "B");
box("b7", 594, 4194, 4260, 280, ["Click 'Start my training plan'"], "B");
box("p16", 1170, 4267, 4333, 320, ["Confirm the plan: save the", "level and sessions per week"], "C");
box("b8", 594, 4373, 4427, 280, ["Redirect to the", "Member Dashboard"], "B");

const T = (o) => [o.cx, o.y0];
const Bm = (o) => [o.cx, o.y1];
const L = (o) => (o.kind === "dec" ? [o.cx - o.w / 2, o.cy] : [o.cx - o.w / 2, (o.y0 + o.y1) / 2]);
const R = (o) => (o.kind === "dec" ? [o.cx + o.w / 2, o.cy] : [o.cx + o.w / 2, (o.y0 + o.y1) / 2]);
const dB = (o) => [o.cx, o.cy + o.h / 2];
const dT = (o) => [o.cx, o.cy - o.h / 2];
const dL = (o) => [o.cx - o.w / 2, o.cy];

const edges = [];
const add = (pts, label, labelAt, style) => edges.push({ pts, label, labelAt, style });

const v = (a, b, label) => add([Bm(a), T(b)], label);
const A = (o) => o; // alias

// phase 0
add([[214, 144], T(n.a1)]);
v(n.a1, n.a2); v(n.a2, n.a3); v(n.a3, n.a4);
add([R(n.a4), [1170, 469], dT(n.d1)]);
add([dL(n.d1), R(n.e1)], "No", [1026, 552]);
add([L(n.e1), [60, 560], [60, 469], [84, 469]]);
add([dB(n.d1), T(n.p1)], "Yes", [1183, 630]);
v(n.p1, n.p2);
add([L(n.p2), [214, 792], T(n.a5)]);

// phase 1
v(n.a5, n.a6); v(n.a6, n.a7); v(n.a7, n.a8);
add([R(n.a8), [1170, 1209], dT(n.d2)]);
add([dL(n.d2), R(n.e2)], "No", [1024, 1292]);
add([L(n.e2), [60, 1300], [60, 1209], [84, 1209]]);
add([dB(n.d2), T(n.p3)], "Yes", [1183, 1372]);
add([L(n.p3), [214, 1417], T(n.a9)]);
v(n.a9, n.a10);
add([R(n.a10), [1170, 1613], dT(n.d3)]);
add([dL(n.d3), R(n.e3)], "No", [1022, 1692]);
add([L(n.e3), [74, 1700], [74, 1007], [84, 1007]]);
add([dB(n.d3), T(n.p4)], "Yes", [1183, 1772]);
add([L(n.p4), [214, 1823], T(n.a11)]);
add([R(n.a11), [1170, 1935], T(n.p5)]);
add([L(n.p5), [594, 2041], T(n.b1)]);

// phase 2
add([R(n.b1), [1170, 2143], dT(n.d4)]);
add([dL(n.d4), R(n.p7)], "No", [1022, 2242]);
add([dB(n.d4), T(n.p6)], "Yes", [1183, 2322]);
add([Bm(n.p6), [1170, 2420], [628, 2420], [628, 2520]]);
add([Bm(n.p7), [900, 2446], [560, 2446], [560, 2520]]);
add([R(n.b2), [1170, 2553], T(n.p8)]);
v(n.p8, dT(n.d6));
add([dL(n.d6), R(n.e5)], "No", [1024, 2748]);
add([L(n.e5), [60, 2756], [60, 2553], [454, 2553]]);
add([dB(n.d6), T(n.p9)], "Yes", [1183, 2830]);
add([L(n.p9), [594, 2877], T(n.b3)]);
v(n.b3, n.b4);
add([R(n.b4), [1170, 3077], dT(n.d7)]);
add([dL(n.d7), R(n.e6)], "No", [1022, 3162]);
add([L(n.e6), [74, 3170], [74, 2572], [454, 2572]]);
add([dB(n.d7), T(n.p10)], "Yes", [1183, 3245]);
v(n.p10, n.p11);
v(n.p11, dT(n.d8));
add([dL(n.d8), R(n.p13)], "No", [1022, 3547]);
add([dB(n.d8), T(n.p12)], "Yes", [1183, 3630]);
v(n.p12, n.p14);
add([Bm(n.p13), [900, 3789], [1020, 3789]]);
v(n.p14, n.p15);
add([L(n.p15), [594, 3908], T(n.b5)]);

// phase 3
v(n.b5, n.b6); v(n.b6, n.b7);
add([R(n.b7), [1170, 4227], T(n.p16)]);
add([L(n.p16), [594, 4300], T(n.b8)]);
add([Bm(n.b8), [594, 4460]]);

// ------------------------------------------------------------------ render
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif">`);
out.push(`<defs>
  <marker id="ah" viewBox="0 0 10 10" refX="9.2" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M1,1 L9,5 L1,9" fill="none" stroke="#111" stroke-width="1" stroke-linecap="round"/>
  </marker>
</defs>`);
out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`);

// frame + title
out.push(`<rect x="24" y="18" width="1392" height="${H - 40}" fill="none" stroke="#111" stroke-width="1.2"/>`);
out.push(`<line x1="24" y1="56" x2="1416" y2="56" stroke="#111" stroke-width="1.2"/>`);
out.push(`<text x="720" y="43" text-anchor="middle" font-size="15" font-weight="bold">BF-02: Onboarding Survey &amp; Level Recommendation Flow</text>`);

// lanes
for (const lane of LANES) {
  out.push(`<rect x="${lane.x0}" y="56" width="${lane.x1 - lane.x0}" height="${H - 78}" fill="none" stroke="#111" stroke-width="1"/>`);
  out.push(`<line x1="${lane.x0}" y1="96" x2="${lane.x1}" y2="96" stroke="#111" stroke-width="1"/>`);
  out.push(`<text x="${(lane.x0 + lane.x1) / 2}" y="82" text-anchor="middle" font-size="12.5" font-weight="bold">${esc(lane.title)}</text>`);
}

// nodes
for (const o of Object.values(n)) {
  const lh = 14.5;
  if (o.kind === "dec") {
    const hw = o.w / 2, hh = o.h / 2;
    out.push(`<polygon points="${o.cx},${o.cy - hh} ${o.cx + hw},${o.cy} ${o.cx},${o.cy + hh} ${o.cx - hw},${o.cy}" fill="#fff" stroke="#111" stroke-width="1.1"/>`);
    const y0 = o.cy - ((o.lines.length - 1) * lh) / 2 + 4;
    o.lines.forEach((t, i) => out.push(`<text x="${o.cx}" y="${y0 + i * lh}" text-anchor="middle" font-size="11.5">${esc(t)}</text>`));
  } else {
    const h = o.y1 - o.y0;
    out.push(`<rect x="${o.cx - o.w / 2}" y="${o.y0}" width="${o.w}" height="${h}" fill="#fff" stroke="#111" stroke-width="1.1"/>`);
    const y0 = o.y0 + h / 2 - ((o.lines.length - 1) * lh) / 2 + 4;
    o.lines.forEach((t, i) => out.push(`<text x="${o.cx}" y="${y0 + i * lh}" text-anchor="middle" font-size="11.5">${esc(t)}</text>`));
  }
}

// start / end
out.push(`<circle cx="214" cy="130" r="13" fill="#fff" stroke="#111" stroke-width="1.1"/>`);
out.push(`<circle cx="594" cy="4478" r="15" fill="#111" stroke="#111" stroke-width="1.1"/>`);

// edges
for (const e of edges) {
  const pts = e.pts;
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  out.push(`<path d="${d}" fill="none" stroke="#111" stroke-width="1.05" marker-end="url(#ah)"/>`);
  if (e.label) {
    const [lx, ly] = e.labelAt;
    out.push(`<rect x="${lx - 13}" y="${ly - 8}" width="26" height="13" fill="#fff"/>`);
    out.push(`<text x="${lx}" y="${ly + 2}" text-anchor="middle" font-size="10.5">${esc(e.label)}</text>`);
  }
}

out.push(`</svg>`);

const svg = out.join("\n");
const dir = "e:/SEP490_G9_CalisHealth-main (1)/SEP490_G9_CalisHealth-main/docs/workflow";
fs.writeFileSync(path.join(dir, "BF-02-onboarding-survey-flow.svg"), svg);

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>BF-02 Onboarding Survey &amp; Level Recommendation</title>
<style>
 body{margin:0;padding:18px;background:#f2f2f2;font-family:Arial,Helvetica,sans-serif}
 .sheet{background:#fff;max-width:1480px;margin:0 auto;padding:6px;box-shadow:0 6px 24px rgba(0,0,0,.18)}
 svg{display:block;width:100%;height:auto}
</style></head><body><div class="sheet">${svg}</div></body></html>`;
fs.writeFileSync(path.join(dir, "BF-02-onboarding-survey-flow.html"), html);
console.log("written", Object.keys(n).length, "nodes", edges.length, "edges");
