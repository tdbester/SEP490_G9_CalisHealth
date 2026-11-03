// Bố cục cho Calisthenics Exercise Tree. Mỗi progression rule là một cạnh prerequisite -> exercise.
// Cột = độ sâu dài nhất tính từ bài gốc (bài không là đích của rule nào), hàng = nhánh.

export const NODE_W = 150;
export const NODE_H = 104;
// Khe giữa các ô đủ rộng để chứa vài làn đường nối song song.
export const GAP_X = 80;
export const GAP_Y = 48;

/** Bài gốc của mỗi chuỗi: có xuất hiện trong rule nhưng không là bài đích của rule nào. */
export function rootsOf(nodes, edges) {
  const targets = new Set(edges.map((edge) => edge.exerciseCode));
  const firstEdgeIndex = new Map();
  edges.forEach((edge, index) => {
    if (!firstEdgeIndex.has(edge.prerequisiteCode)) {
      firstEdgeIndex.set(edge.prerequisiteCode, index);
    }
  });
  return nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => !targets.has(node.code))
    .sort((a, b) =>
      (firstEdgeIndex.get(a.node.code) ?? Number.MAX_SAFE_INTEGER)
        - (firstEdgeIndex.get(b.node.code) ?? Number.MAX_SAFE_INTEGER)
      || a.index - b.index)
    .map(({ node }) => node);
}

/** Mọi bài đi tới được từ bài gốc theo chiều "mở khóa" (gồm cả bài gốc). */
function reachableFrom(rootCode, edges) {
  const seen = new Set([rootCode]);
  const queue = [rootCode];
  while (queue.length) {
    const current = queue.shift();
    edges.forEach((edge) => {
      if (edge.prerequisiteCode === current && !seen.has(edge.exerciseCode)) {
        seen.add(edge.exerciseCode);
        queue.push(edge.exerciseCode);
      }
    });
  }
  return seen;
}

/** Xếp một chuỗi bắt đầu từ rootCode. Trả về { items: [{ node, col, row }], edges, cols, rows }. */
export function layoutChain(nodes, edges, rootCode) {
  const codes = reachableFrom(rootCode, edges);
  const chainEdges = edges.filter((edge) => codes.has(edge.prerequisiteCode) && codes.has(edge.exerciseCode));
  const byCode = new Map(nodes.map((node) => [node.code, node]));

  // Độ sâu dài nhất: bài có nhiều đường vào nằm ở cột sau cùng. Giới hạn số vòng phòng khi dữ liệu có vòng.
  const depth = new Map([[rootCode, 0]]);
  for (let pass = 0; pass < codes.size; pass += 1) {
    let changed = false;
    chainEdges.forEach((edge) => {
      if (!depth.has(edge.prerequisiteCode)) return;
      const next = depth.get(edge.prerequisiteCode) + 1;
      if ((depth.get(edge.exerciseCode) ?? -1) < next) {
        depth.set(edge.exerciseCode, next);
        changed = true;
      }
    });
    if (!changed) break;
  }

  const children = new Map();
  chainEdges.forEach((edge) => {
    if (!children.has(edge.prerequisiteCode)) children.set(edge.prerequisiteCode, []);
    children.get(edge.prerequisiteCode).push(edge.exerciseCode);
  });

  const placed = new Map();
  const taken = new Set();
  let nextRow = 0;
  const place = (code, preferredRow) => {
    if (placed.has(code) || !depth.has(code)) return;
    const col = depth.get(code);
    let row = preferredRow;
    while (taken.has(`${col}:${row}`)) row += 1;
    taken.add(`${col}:${row}`);
    placed.set(code, { col, row });
    nextRow = Math.max(nextRow, row + 1);
    (children.get(code) || []).forEach((child, index) => place(child, index === 0 ? row : nextRow));
  };
  place(rootCode, 0);

  const items = [...placed.entries()].map(([code, spot]) => ({ node: byCode.get(code), ...spot }));
  return {
    items,
    edges: chainEdges,
    cols: Math.max(...items.map((item) => item.col)) + 1,
    rows: Math.max(...items.map((item) => item.row)) + 1,
  };
}
