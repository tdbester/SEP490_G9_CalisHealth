// Định tuyến đường nối cho Calisthenics Exercise Tree. Chỉ có hai kiểu đường, các đường được phép trùng nhau:
//   1. Cùng hàng: đi thẳng từ cạnh phải của bài nguồn sang cạnh trái của bài đích.
//   2. Khác hàng, bài đích nằm dưới và đường trống: đi từ cạnh dưới của bài nguồn xuống, rồi kéo sang phải tới bài đích.
//   3. Còn lại (bài đích nằm trên, hoặc đường xuống bị ô khác chắn): đi từ cạnh phải sang phải tới khe giữa hai cột,
//      kéo dọc trong khe, rồi sang phải tới bài đích. Đoạn dọc luôn nằm trong khe nên không đè lên ô nào.
// Khi `reverse` (Hard -> Easy) các cột bị lật nên "phải" thành "trái".

import { GAP_X, GAP_Y, NODE_H, NODE_W } from "./exerciseTreeLayout";

const gapCenterX = (gap) => gap * (NODE_W + GAP_X) + NODE_W + GAP_X / 2;

/**
 * `spots`: Map code -> { x, y, row, vcol } (vcol là cột hiển thị, đã lật khi reverse).
 * Trả về { paths: Map ruleId -> d, maxY }.
 */
export function routeEdges(spots, edges, reverse) {
  const occupied = new Set([...spots.values()].map((spot) => `${spot.vcol}:${spot.row}`));
  const isFree = (col, row) => !occupied.has(`${col}:${row}`);
  const centerY = (spot) => spot.y + NODE_H / 2;

  // Mỗi bài nguồn có một làn riêng nhỏ trong khe để các đường kéo dọc của nguồn khác nhau không dính vào nhau.
  const laneOf = new Map();
  const sourcesByGap = new Map();
  edges.forEach((edge) => {
    const from = spots.get(edge.prerequisiteCode);
    const gap = reverse ? from.vcol - 1 : from.vcol;
    if (!sourcesByGap.has(gap)) sourcesByGap.set(gap, []);
    if (!sourcesByGap.get(gap).includes(edge.prerequisiteCode)) sourcesByGap.get(gap).push(edge.prerequisiteCode);
  });
  sourcesByGap.forEach((codes, gap) => {
    const step = codes.length > 1 ? Math.min(12, (GAP_X - 32) / (codes.length - 1)) : 0;
    codes.forEach((code, index) => laneOf.set(code, gapCenterX(gap) + (index - (codes.length - 1) / 2) * step));
  });

  const step = reverse ? -1 : 1;
  const paths = new Map();
  edges.forEach((edge) => {
    const from = spots.get(edge.prerequisiteCode);
    const to = spots.get(edge.exerciseCode);
    const exitX = reverse ? from.x : from.x + NODE_W;
    const entryX = reverse ? to.x + NODE_W : to.x;
    const fromY = centerY(from);
    const toY = centerY(to);
    let points;

    const betweenCols = [];
    for (let col = from.vcol + step; col !== to.vcol; col += step) betweenCols.push(col);
    const rowClear = (row) => betweenCols.every((col) => isFree(col, row));
    // Đường vòng qua khe ngang ngay trên hàng của bài đích (hoặc dưới hàng 0), dùng khi các kiểu chính bị chắn.
    const detour = () => {
      const farX = laneOf.get(edge.prerequisiteCode);
      const nearX = gapCenterX(reverse ? to.vcol : to.vcol - 1);
      const gapY = to.row > 0 ? to.y - GAP_Y / 2 : to.y + NODE_H + GAP_Y / 2;
      return [[exitX, fromY], [farX, fromY], [farX, gapY], [nearX, gapY], [nearX, toY], [entryX, toY]];
    };

    if (from.row === to.row) {
      points = rowClear(from.row) ? [[exitX, fromY], [entryX, toY]] : detour();
    } else {
      // Kiểu 2: xuống từ cạnh dưới, rồi sang phải trên hàng của bài đích.
      let downClear = to.row > from.row && rowClear(to.row);
      for (let row = from.row + 1; downClear && row <= to.row; row += 1) downClear = isFree(from.vcol, row);

      if (downClear) {
        const startX = from.x + NODE_W / 2;
        points = [[startX, from.y + NODE_H], [startX, toY], [entryX, toY]];
      } else {
        // Kiểu 3: ra cạnh phải, dọc trong khe. Chọn khe đầu nếu hàng của bài đích trống, khe cuối nếu hàng của
        // bài nguồn trống; cả hai đều chắn thì đi vòng.
        if (rowClear(to.row)) {
          const laneX = laneOf.get(edge.prerequisiteCode);
          points = [[exitX, fromY], [laneX, fromY], [laneX, toY], [entryX, toY]];
        } else if (rowClear(from.row)) {
          const laneX = gapCenterX(reverse ? to.vcol : to.vcol - 1);
          points = [[exitX, fromY], [laneX, fromY], [laneX, toY], [entryX, toY]];
        } else {
          points = detour();
        }
      }
    }
    paths.set(edge.ruleId, points.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join(" "));
  });
  return { paths, maxY: 0 };
}
