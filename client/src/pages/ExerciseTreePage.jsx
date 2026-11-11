import { useMemo, useRef, useState } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Card, CircularProgress, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import { contentManagerApi } from "../api/contentManager";
import { useApiQuery } from "../hooks";
import { useLevelNames } from "../useLevelNames";
import { CONTENT_PATHS, ContentPageHeader, DarkPill } from "../components/ContentShared";
import { CM } from "../theme-content";
import { GAP_X, GAP_Y, NODE_H, NODE_W, layoutChain, rootsOf } from "../exerciseTreeLayout";
import { routeEdges } from "../exerciseTreeRouting";

const BREADCRUMB = [
  { labelKey: "nav.contentManagerRole", to: CONTENT_PATHS.dashboard },
  { labelKey: "nav.progressionRules", to: CONTENT_PATHS.progressionRules },
  { labelKey: "nav.exerciseTree" },
];

const names = (list, t) => (list.length ? list.map((node) => node.name).join(", ") : t("contentManager.exerciseTree.none"));

/**
 * Một ô bài tập trong tree: bài gốc (check xanh), bài đang chọn (play tím), còn lại là ô thường.
 * Content Manager chỉ quản lý cấu trúc, nên không có trạng thái khóa / mở khóa như phía member.
 */
function TreeNode({ item, x, y, state, levelTone, onSelect, t }) {
  const { node, col } = item;
  const styles = {
    selected: { border: CM.violetBright, bg: "rgba(139,92,246,0.22)", badge: CM.violetBright, Icon: PlayArrowRoundedIcon },
    normal: { border: CM.border, bg: CM.surface, badge: null, Icon: null },
  }[state];
  return <Box
    component="button"
    type="button"
    onClick={onSelect}
    aria-pressed={state === "selected"}
    aria-label={t("contentManager.exerciseTree.nodeAria", {
      name: node.name,
      level: col + 1,
    }) + (node.difficultyLevel ? `, ${node.difficultyLevel}` : "")}
    sx={{
      position: "absolute", left: x, top: y, width: NODE_W, height: NODE_H, p: 1.25,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
      border: `1.5px solid ${styles.border}`, borderRadius: "14px", bgcolor: styles.bg, color: "#fff",
      cursor: "pointer", font: "inherit", textAlign: "center", transition: "border-color .15s ease, transform .15s ease",
      "&:hover": { borderColor: CM.violetBright, transform: "translateY(-2px)" },
      "&:focus-visible": { outline: `2px solid ${CM.violetBright}`, outlineOffset: 2 },
      "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:hover": { transform: "none" } },
    }}
  >
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: "100%" }}>
      {/* Ô thường giữ chỗ trống cùng kích thước để tên bài vẫn thẳng hàng giữa các ô. */}
      <Box aria-hidden sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: styles.badge || "transparent", display: "grid", placeItems: "center" }}>
        {styles.Icon && <styles.Icon sx={{ fontSize: 14, color: "#fff" }} />}
      </Box>
      <Typography sx={{ fontSize: 11, color: CM.textMuted }}>{t("contentManager.exerciseTree.nodeLevel", { count: col + 1 })}</Typography>
    </Stack>
    <Typography sx={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.25, px: 0.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
      {node.name}
    </Typography>
    <DarkPill tone={levelTone(node.difficultyLevel)} sx={{ height: 18, fontSize: 10 }}>{node.difficultyLevel || t("contentManager.exerciseTree.noLevel")}</DarkPill>
  </Box>;
}

function LegendDot({ color, hollow, label }) {
  return <Stack direction="row" spacing={0.75} alignItems="center">
    <Box aria-hidden sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: hollow ? "transparent" : color, border: `1.5px solid ${color}` }} />
    <Typography variant="caption" sx={{ color: CM.textMuted }}>{label}</Typography>
  </Stack>;
}

/** Calisthenics Exercise Tree: xem các chuỗi progression rule dưới dạng cây. */
export default function ExerciseTreePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = useApiQuery(() => contentManagerApi.progressionTree());
  const { levelTone } = useLevelNames();
  const [reverse, setReverse] = useState(false);
  const [selectedCode, setSelectedCode] = useState(null);
  // Kéo để cuộn tree (thay cho thanh cuộn). Chỉ coi là kéo khi chuột đi quá DRAG_THRESHOLD px,
  // để click vào ô bài tập vẫn chọn được bài.
  const DRAG_THRESHOLD = 5;
  const viewportRef = useRef(null);
  const drag = useRef(null);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (event) => {
    if (event.button !== 0 || event.pointerType === "touch") return; // cảm ứng đã cuộn tự nhiên
    const el = viewportRef.current;
    drag.current = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false, id: event.pointerId };
  };
  const onPointerMove = (event) => {
    const state = drag.current;
    if (!state) return;
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (!state.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!state.moved) {
      state.moved = true;
      setDragging(true);
      viewportRef.current.setPointerCapture(state.id);
    }
    viewportRef.current.scrollLeft = state.left - dx;
    viewportRef.current.scrollTop = state.top - dy;
  };
  const endDrag = () => {
    const el = viewportRef.current;
    if (drag.current?.moved && el?.hasPointerCapture(drag.current.id)) el.releasePointerCapture(drag.current.id);
    // Giữ cờ moved tới sau sự kiện click để chặn click ngay sau khi kéo.
    setTimeout(() => { drag.current = null; }, 0);
    setDragging(false);
  };
  const onClickCapture = (event) => {
    if (drag.current?.moved) { event.stopPropagation(); event.preventDefault(); }
  };

  const nodes = query.data?.nodes || [];
  const edges = query.data?.edges || [];
  const roots = useMemo(() => rootsOf(nodes, edges), [nodes, edges]);
  const highlightCode = params.get("highlight");
  // Mở từ màn chi tiết bài tập (Content Manager) — tự chọn chuỗi chứa bài đó và highlight nó.
  const highlightRootCode = useMemo(() => {
    if (!highlightCode || !nodes.length) return null;
    const match = roots.find((root) =>
      layoutChain(nodes, edges, root.code).items.some((item) => item.node.code === highlightCode)
    );
    return match?.code || null;
  }, [highlightCode, nodes, edges, roots]);
  const rootCode = roots.some((root) => root.code === params.get("chain"))
    ? params.get("chain")
    : highlightRootCode || roots[0]?.code;
  const chain = useMemo(() => (rootCode ? layoutChain(nodes, edges, rootCode) : null), [nodes, edges, rootCode]);

  if (query.isLoading) return <Box sx={{ py: 10, display: "grid", placeItems: "center" }}><CircularProgress /></Box>;

  const backButton = <Button component={RouterLink} to={CONTENT_PATHS.progressionRules} variant="outlined" startIcon={<ArrowBackRoundedIcon />}>{t("contentManager.exerciseTree.back")}</Button>;
  const header = <ContentPageHeader
    breadcrumb={BREADCRUMB}
    title={t("contentManager.exerciseTree.title")}
    description={t("contentManager.exerciseTree.description")}
    action={backButton}
  />;
  if (query.error) {
    return <Box sx={{ maxWidth: 1100, mx: "auto", px: 3, py: 2.5 }}>
      {header}
      <Alert severity="error" sx={{ mt: 2 }} action={<Button color="inherit" size="small" onClick={query.refetch}>{t("contentManager.exerciseTree.retry")}</Button>}>{query.error.message}</Alert>
    </Box>;
  }
  if (!chain) {
    return <Box sx={{ maxWidth: 1100, mx: "auto", px: 3, py: 2.5 }}>
      {header}
      <Card sx={{ mt: 2.5, p: 6, textAlign: "center" }}>
        <Typography sx={{ color: CM.textMuted }}>{t("contentManager.exerciseTree.empty")}</Typography>
        <Button component={RouterLink} to={`${CONTENT_PATHS.progressionRules}/new`} variant="contained" sx={{ mt: 2 }}>{t("contentManager.exerciseTree.createRule")}</Button>
      </Card>
    </Box>;
  }

  // Toạ độ từng ô; Hard -> Easy lật cột để bài khó nhất nằm bên trái.
  const spot = new Map(chain.items.map((item) => {
    const col = reverse ? chain.cols - 1 - item.col : item.col;
    return [item.node.code, { ...item, vcol: col, x: col * (NODE_W + GAP_X), y: item.row * (NODE_H + GAP_Y) }];
  }));
  const routed = routeEdges(spot, chain.edges, reverse);
  const width = chain.cols * NODE_W + (chain.cols - 1) * GAP_X;
  // Có thể có làn chạy dưới hàng cuối, nên nới chiều cao cho đủ.
  const height = Math.max(chain.rows * NODE_H + (chain.rows - 1) * GAP_Y, routed.maxY + 8);
  const selected = spot.get(selectedCode) || spot.get(highlightCode) || spot.get(rootCode);
  const incoming = chain.edges.filter((edge) => edge.exerciseCode === selected.node.code);
  const outgoing = chain.edges.filter((edge) => edge.prerequisiteCode === selected.node.code);
  const nodeOf = (code) => spot.get(code).node;
  const stateOf = (code) => (code === selected.node.code ? "selected" : "normal");
  const openRule = (ruleId) => navigate(`${CONTENT_PATHS.progressionRules}/${ruleId}`, { state: { from: "tree", chain: rootCode } });

  return <Box sx={{ maxWidth: 1240, mx: "auto", px: { xs: 2, sm: 3 }, py: 2.5 }}>
    {header}

    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} gap={1.5} sx={{ mt: 2.5 }}>
      <Stack direction="row" gap={1} flexWrap="wrap" role="tablist" aria-label={t("contentManager.exerciseTree.chainsAria")}>
        {roots.map((root) => {
          const active = root.code === rootCode;
          return <Button
            key={root.code}
            role="tab"
            aria-selected={active}
            size="small"
            variant={active ? "contained" : "outlined"}
            onClick={() => { setParams({ chain: root.code }); setSelectedCode(null); }}
            sx={{ borderRadius: 999, px: 2 }}
          >
            {root.name}
          </Button>;
        })}
      </Stack>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={reverse ? "hard" : "easy"}
        onChange={(_, value) => value && setReverse(value === "hard")}
        aria-label={t("contentManager.exerciseTree.directionAria")}
        sx={{ alignSelf: { xs: "flex-start", md: "auto" } }}
      >
        <ToggleButton value="easy" sx={{ px: 2, textTransform: "none" }}>{t("contentManager.exerciseTree.easyToHard")}</ToggleButton>
        <ToggleButton value="hard" sx={{ px: 2, textTransform: "none" }}>{t("contentManager.exerciseTree.hardToEasy")}</ToggleButton>
      </ToggleButtonGroup>
    </Stack>

    <Card sx={{ mt: 2, p: { xs: 2, sm: 2.5 } }}>
      <Box
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        onDragStart={(event) => event.preventDefault()}
        aria-label={t("contentManager.exerciseTree.viewportAria")}
        sx={{
          overflow: "auto", pb: 1, cursor: dragging ? "grabbing" : "grab", userSelect: "none",
          scrollbarWidth: "none", msOverflowStyle: "none", "&::-webkit-scrollbar": { display: "none" },
          "& button": { cursor: dragging ? "grabbing" : "pointer" },
        }}
      >
        <Box sx={{ position: "relative", width, height, mx: "auto" }}>
          <svg width={width} height={height} style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden="true">
            <defs>
              <marker id="tree-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill={CM.textMuted} />
              </marker>
              <marker id="tree-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill={CM.violetBright} />
              </marker>
            </defs>
            {/* Đường của bài đang chọn vẽ sau cùng để nằm trên các đường khác. */}
            {[...chain.edges].sort((a, b) => {
              const rel = (edge) => (edge.prerequisiteCode === selected.node.code || edge.exerciseCode === selected.node.code ? 1 : 0);
              return rel(a) - rel(b);
            }).map((edge) => {
              const inactive = edge.status !== "ACTIVE";
              const related = edge.prerequisiteCode === selected.node.code || edge.exerciseCode === selected.node.code;
              return <path
                key={edge.ruleId}
                d={routed.paths.get(edge.ruleId)}
                fill="none"
                strokeLinejoin="round"
                stroke={related ? CM.violetBright : CM.textMuted}
                strokeOpacity={inactive ? 0.45 : related ? 1 : 0.7}
                strokeWidth={related ? 2 : 1.5}
                strokeDasharray={inactive ? "5 5" : undefined}
                markerEnd={related ? "url(#tree-arrow-active)" : "url(#tree-arrow)"}
              />;
            })}
          </svg>
          {[...spot.values()].map((item) => <TreeNode
            key={item.node.code}
            item={item}
            x={item.x}
            y={item.y}
            state={stateOf(item.node.code)}
            levelTone={levelTone}
            onSelect={() => setSelectedCode(item.node.code)}
            t={t}
          />)}
        </Box>
      </Box>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1} sx={{ mt: 2 }}>
      <Stack direction="row" gap={2} flexWrap="wrap">
        <LegendDot color={CM.violetBright} label={t("contentManager.exerciseTree.legendSelected")} />
        <LegendDot color={CM.textMuted} hollow label={t("contentManager.exerciseTree.legendOther")} />
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Box aria-hidden sx={{ width: 18, borderTop: `1.5px dashed ${CM.textMuted}` }} />
            <Typography variant="caption" sx={{ color: CM.textMuted }}>{t("contentManager.exerciseTree.legendInactive")}</Typography>
          </Stack>
        </Stack>
        <Typography variant="caption" sx={{ color: CM.textMuted }}>{t("contentManager.exerciseTree.arrowsHint")}</Typography>
      </Stack>
    </Card>

    <Card sx={{ mt: 2, p: { xs: 2, sm: 2.5 } }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} gap={2}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>{selected.node.name}</Typography>
            <DarkPill tone="primary">{t("contentManager.exerciseTree.selectedPill")}</DarkPill>
          </Stack>
          <Typography variant="body2" sx={{ color: CM.textMuted, mt: 0.75 }}>
            {t("contentManager.exerciseTree.detailMeta", {
              level: selected.col + 1,
              difficulty: selected.node.difficultyLevel || t("contentManager.exerciseTree.noLevel"),
              type: selected.node.type === "SKILL"
                ? t("contentManager.exerciseTree.typeSkill")
                : t("contentManager.exerciseTree.typeHealth"),
              category: selected.node.category === "HOLD"
                ? t("contentManager.exerciseTree.categoryHold")
                : t("contentManager.exerciseTree.categoryReps"),
            })}
          </Typography>
          <Typography variant="caption" sx={{ color: CM.textDim, display: "block", mt: 0.5 }}>
            {t("contentManager.exerciseTree.previousNext", {
              previous: names(incoming.map((edge) => nodeOf(edge.prerequisiteCode)), t),
              next: names(outgoing.map((edge) => nodeOf(edge.exerciseCode)), t),
            })}
          </Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ flexShrink: 0 }}>
          {incoming.length === 0 && <Typography variant="body2" sx={{ color: CM.textMuted, alignSelf: "center" }}>{t("contentManager.exerciseTree.startOfChain")}</Typography>}
          {incoming.map((edge) => <Button key={edge.ruleId} variant="contained" onClick={() => openRule(edge.ruleId)} sx={{ minWidth: 180 }}>
            {incoming.length > 1
              ? t("contentManager.exerciseTree.viewRuleFrom", { name: nodeOf(edge.prerequisiteCode).name })
              : t("contentManager.exerciseTree.viewRule")}
          </Button>)}
        </Stack>
      </Stack>
    </Card>
  </Box>;
}
