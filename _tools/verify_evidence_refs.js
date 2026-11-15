/* Kiem chung evidence_refs: ma nguon trong profile/alert rules phai ton tai
   trong thu vien file tinh physiology-evidence-library.json.
   Chay: node _tools/verify_evidence_refs.js   */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LIB = path.join(ROOT, 'server', 'src', 'main', 'resources', 'physiology-evidence-library.json');
const MIGR = path.join(ROOT, 'server', 'src', 'main', 'resources', 'db', 'migration', 'V76__physiology_module.sql');

if (!fs.existsSync(LIB)) {
  console.error('Khong tim thay thu vien: ' + LIB);
  process.exit(1);
}
const lib = JSON.parse(fs.readFileSync(LIB, 'utf8'));
const known = new Set(lib.map(e => e.code));

/* Thu thap moi ma nguon xuat hien trong V76 */
const sql = fs.readFileSync(MIGR, 'utf8');
const used = new Set();
const re = /JSON_ARRAY\(\s*'([A-Z0-9_]+)'\s*(?:,\s*'([A-Z0-9_]+)'\s*)*\)/g;
let m;
while ((m = re.exec(sql)) !== null) {
  const block = m[0];
  const codes = block.match(/'([A-Z0-9_]+)'/g) || [];
  codes.forEach(c => used.add(c.replace(/'/g, '')));
}

const missing = [...used].filter(c => !known.has(c)).sort();
const unused = [...known].filter(c => !used.has(c)).sort();

console.log('=== KIEM CHUNG THU VIEN BANG CHUNG ===');
console.log('nguon trong thu vien :', known.size);
console.log('ma duoc su dung     :', used.size);
console.log('ma khong ton tai     :', missing.length, missing.join(', '));
console.log('nguon chua duoc dung  :', unused.length, unused.join(', '));

/* Kiem tra muc A/B: moi profile phai co it nhat 1 nguon A hoac B */
const grade = new Map(lib.map(e => [e.code, e.evidence_grade]));
const profileRefs = new Set();
const pre = /UNION ALL SELECT 'EX_[^']*'[^\n]*\n?[^\n]*JSON_ARRAY\(([^)]*)\)/g;
while ((m = pre.exec(sql)) !== null) {
  (m[1].match(/'([A-Z0-9_]+)'/g) || []).forEach(c => profileRefs.add(c.replace(/'/g, '')));
}
const weak = [];
const profileBlocks = sql.split(/UNION ALL SELECT 'EX_/).slice(1);
profileBlocks.forEach(b => {
  const codes = (b.match(/JSON_ARRAY\(([^)]*)\)/g) || []).pop();
  if (!codes) return;
  const list = (codes.match(/'([A-Z0-9_]+)'/g) || []).map(c => c.replace(/'/g, ''));
  if (!list.length) { weak.push('(khong co nguon)'); return; }
  if (!list.some(c => ['A', 'B'].includes(grade.get(c)))) weak.push(list.join(','));
});

console.log('profile chi dung nguon C/D:', weak.length, weak.join(' | '));
const ok = missing.length === 0 && weak.length === 0;
console.log('KET QUA              :', ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
