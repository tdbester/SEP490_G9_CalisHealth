const ExcelJS = require('exceljs');
(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('E:/Report-5.3_System Test_FRs.xlsx');
  console.log('SHEETS: ' + wb.worksheets.map((w) => w.name).join(' | '));
  let total = 0;
  for (const ws of wb.worksheets.slice(3)) {
    let cases = 0;
    let scenarios = 0;
    let bad = [];
    for (let r = 11; r <= 999; r++) {
      const a = ws.getRow(r).getCell(1).value;
      if (!a) continue;
      if (String(a).startsWith('Scenario')) { scenarios++; continue; }
      cases++;
      const id = String(a);
      if (!/^<[A-Z0-9]+>$/.test(id)) bad.push(r + ':id=' + id);
      for (const [c, label] of [[2, 'desc'], [3, 'proc'], [4, 'exp'], [5, 'pre']]) {
        const v = ws.getRow(r).getCell(c).value;
        if (!v || String(v).trim() === '') bad.push(r + ':' + label + ' empty');
      }
      for (let c = 6; c <= 12; c += 3) {
        const v = ws.getRow(r).getCell(c).value;
        if (!['Passed', 'Failed', 'Pending', 'N/A'].includes(v)) bad.push(r + ':F=' + JSON.stringify(v));
      }
    }
    total += cases;
    console.log('\n### ' + ws.name + ' : scenarios=' + scenarios + ' cases=' + cases + (bad.length ? '  PROBLEMS: ' + bad.slice(0, 8).join(', ') : '  OK'));
    // print first rows
    for (let r = 11; r <= 16; r++) {
      const a = ws.getRow(r).getCell(1).value;
      const b = ws.getRow(r).getCell(2).value;
      const f = ws.getRow(r).getCell(6).value;
      console.log('   R' + r + ' A=' + JSON.stringify(a) + ' B=' + JSON.stringify(String(b || '').slice(0, 70)) + ' F=' + JSON.stringify(f));
    }
  }
  console.log('\nTOTAL CASES: ' + total);
})();
