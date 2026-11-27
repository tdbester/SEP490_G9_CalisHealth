/**
 * Cong thuc cham diem form dung chung cho ca bai REPS va bai HOLD.
 *
 * Tac ra file rieng de:
 *   - `usePushUpTracker.js` va `useHoldTracker.js` dung chung 1 ham cham diem
 *     -> khong phai copy-paste cong thuc (truoc day 2 ban co the lech nhau).
 *   - Script kiem thu (`scripts/verify-*-tracker.mjs`) nap duoc file nay ma
 *     khong phai noi Mock cua React hook.
 *
 * Nguyên tắc chung:
 *   - Điểm luôn nằm trong [0, 100].
 *   - Vung dung rong `tolerance / 2` quanh muc tieu -> 100 diem.
 *   - Lech `tolerance` tro len -> 0 diem.
 *   - Giua hai bien -> noi suy tuyen tinh (diem giam dan, khong nhay giap).
 *
 * Nguon goc nguong: `doc-caps/module-docs/tracking/EXERCISE_ANGLE_CRITERIA_EVIDENCE.md`
 * (bang §3) — moi nguong deu truy duoc ve mot nguon hoc thuat da duoc danh gia.
 */

/**
 * Diem cua mot thanh phan theo do lech so voi muc tieu.
 *
 * @param {number|null} measured - gia tri do duoc
 * @param {number} target - gia tri muc tieu
 * @param {number} tolerance - ban kinh vung dung (do). 0 = phai bang het muc tieu.
 * @returns {number} 0..100
 */
export function scoreByDeviation(measured, target, tolerance) {
  if (measured == null || !Number.isFinite(measured)) return 0;
  if (target == null || !Number.isFinite(target)) return 0;
  if (!tolerance || tolerance <= 0) return measured === target ? 100 : 0;
  const deviation = Math.abs(measured - target);
  if (deviation <= tolerance / 2) return 100;
  if (deviation >= tolerance) return 0;
  const ratio = (deviation - tolerance / 2) / (tolerance / 2);
  return Math.round((1 - ratio) * 100);
}

/**
 * Diem cua mot thanh phan khi muc tieu la MOT DAI goc (khong phai 1 diem).
 *
 * Do lech tinh tu bien gan nhat cua dai:
 *   - gia tri nam trong dai  -> lech 0 -> 100 diem
 *   - gia tri ngoài dai      -> lech = khoang cach toi bien do
 *
 * Dung cho bai HOLD co bien tren thuc su (vd Wall sit: goc dau goi 85-95).
 *
 * @param {number|null} measured - gia tri do duoc
 * @param {number|null} minAngle - bien duoi cua dai (null = khong gioi han duoi)
 * @param {number|null} maxAngle - bien tren cua dai (null = khong gioi han tren)
 * @param {number} tolerance - ban kinh vung dung (do)
 * @returns {number} 0..100
 */
export function scoreByRange(measured, minAngle, maxAngle, tolerance) {
  if (measured == null || !Number.isFinite(measured)) return 0;
  const hasMin = minAngle != null && Number.isFinite(minAngle);
  const hasMax = maxAngle != null && Number.isFinite(maxAngle);
  if (!hasMin && !hasMax) return 100;

  // Gia tri trong dai -> lech 0 -> 100 diem.
  if (hasMin && hasMax && measured >= minAngle && measured <= maxAngle) return 100;

  // Ngoài dai -> lech = khoang cach toi bien gan nhat.
  let deviation = 0;
  if (hasMin && measured < minAngle) deviation = minAngle - measured;
  else if (hasMax && measured > maxAngle) deviation = measured - maxAngle;

  if (!tolerance || tolerance <= 0) return deviation === 0 ? 100 : 0;
  if (deviation <= tolerance / 2) return 100;
  if (deviation >= tolerance) return 0;
  const ratio = (deviation - tolerance / 2) / (tolerance / 2);
  return Math.round((1 - ratio) * 100);
}
