import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getExerciseTree } from "../api/library";
import { getLevelBadgeStyle } from "../utils/levelBadge";
import { getLevelLabel } from "../utils/levelLabel";
import { GAP_X, GAP_Y, NODE_H, NODE_W, layoutChain, rootsOf } from "../exerciseTreeLayout";
import { routeEdges } from "../exerciseTreeRouting";

function normalizeExerciseName(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Layout constants for the SVG grid
export default function CalisthenicsExerciseTreePage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationExercise = location.state?.selectedExercise || location.state?.exercise;

  const initialExerciseId =
      searchParams.get("exerciseId") ||
      navigationExercise?.id ||
      location.state?.exerciseId ||
      "";
  const initialExerciseCode =
      searchParams.get("highlight") ||
      searchParams.get("exerciseCode") ||
      navigationExercise?.code ||
      location.state?.exerciseCode ||
      "";
  const initialExerciseName =
      searchParams.get("exerciseName") ||
      searchParams.get("exercise") ||
      navigationExercise?.name ||
      location.state?.exerciseName ||
      "";
  const initialSearch = searchParams.get("search") || "";

  const [direction, setDirection] = useState("EASY_TO_HARD");
  const [selectedCode, setSelectedCode] = useState(null);
  const [exerciseFilter, setExerciseFilter] = useState(
      initialExerciseName || initialSearch || initialExerciseCode || initialExerciseId,
  );
  const [contextExerciseId, setContextExerciseId] = useState(String(initialExerciseId));
  const [contextExerciseCode, setContextExerciseCode] = useState(String(initialExerciseCode));
  const [treeResponse, setTreeResponse] = useState(null);
  const [treeError, setTreeError] = useState("");
  const [treeLoading, setTreeLoading] = useState(true);

  // Keep document title synced
  useEffect(() => {
    document.title = t("member.exerciseTree.documentTitle");
    return () => {
      document.title = "CalisHealth";
    };
  }, [t]);

  // Sync context if URL parameters or navigation state change externally.
  useEffect(() => {
    const nextExerciseId = String(
        searchParams.get("exerciseId") ||
        navigationExercise?.id ||
        location.state?.exerciseId ||
        "",
    );
    const nextExerciseCode = String(
        searchParams.get("highlight") ||
        searchParams.get("exerciseCode") ||
        navigationExercise?.code ||
        location.state?.exerciseCode ||
        "",
    );
    const nextExerciseName =
        searchParams.get("exerciseName") ||
        searchParams.get("exercise") ||
        navigationExercise?.name ||
        location.state?.exerciseName ||
        "";
    const nextSearch = searchParams.get("search") || "";
    setContextExerciseId(nextExerciseId);
    setContextExerciseCode(nextExerciseCode);
    setExerciseFilter(nextExerciseName || nextSearch || nextExerciseCode || nextExerciseId);
  }, [searchParams, navigationExercise, location.state]);

  useEffect(() => {
    let isMounted = true;
    setTreeLoading(true);
    setTreeError("");
    getExerciseTree({ order: "EASY_TO_HARD" })
        .then((data) => {
          if (isMounted) setTreeResponse(data);
        })
        .catch((error) => {
          console.error("Failed to load exercise tree:", error);
          if (isMounted) {
            setTreeResponse(null);
            setTreeError(t("member.exerciseTree.loadFailed"));
          }
        })
        .finally(() => {
          if (isMounted) setTreeLoading(false);
        });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const groupData = useMemo(() => {
    const rawNodes = treeResponse?.nodes || [];
    const rawNodeById = new Map(rawNodes.map((node) => [String(node.id), node]));
    const nodes = rawNodes.map((node) => ({
      ...node,
      levelNumber: Number(node.level) || 1,
      state: node.state?.toLowerCase(),
      muscleGroups: node.targetMuscle ? node.targetMuscle.split(",").map((muscle) => muscle.trim()) : [],
      previous: (node.prerequisiteIds || [])
          .map((id) => rawNodeById.get(String(id))?.name)
          .filter(Boolean),
      next: (node.nextExerciseIds || [])
          .map((id) => rawNodeById.get(String(id))?.name)
          .filter(Boolean),
    }));
    return {
      name: "All",
      nodes,
      legend: treeResponse?.legend,
    };
  }, [treeResponse]);

  // Find default selected exercise (prefer state 'current', else first node)
  const defaultExercise = useMemo(() => {
    return (
        groupData.nodes.find((n) => n.state === "current") || groupData.nodes[0]
    );
  }, [groupData]);

  const requestedExerciseName =
      searchParams.get("exercise") ||
      searchParams.get("exerciseName") ||
      navigationExercise?.name ||
      location.state?.exerciseName ||
      "";
  const matchingExercise = useMemo(() => {
    const normalizedCode = String(contextExerciseCode || "").trim().toLowerCase();
    const byCode = normalizedCode
        ? groupData.nodes.find((node) => String(node.code || "").trim().toLowerCase() === normalizedCode)
        : null;
    if (byCode) return byCode;

    const byId = contextExerciseId
        ? groupData.nodes.find((node) => String(node.id) === contextExerciseId)
        : null;
    if (byId) return byId;

    const normalizedFilter = normalizeExerciseName(exerciseFilter);
    const exactName = normalizedFilter
        ? groupData.nodes.find((node) => normalizeExerciseName(node.name) === normalizedFilter)
        : null;
    if (exactName) return exactName;

    const nameAliases = {
      "push up": ["standard push up"],
      "australian row": ["australian pull up"],
      "wall handstand": ["wall handstand hold"],
    };
    const aliasName = (nameAliases[normalizedFilter] || []).map(normalizeExerciseName);
    const aliasedName = aliasName.length
        ? groupData.nodes.find((node) => aliasName.includes(normalizeExerciseName(node.name)))
        : null;
    if (aliasedName) return aliasedName;

    if (!normalizedFilter) return null;

    return groupData.nodes.find(
        (node) => String(node.code || "").trim().toLowerCase() === normalizedFilter.toLowerCase(),
    ) || null;
  }, [contextExerciseCode, contextExerciseId, exerciseFilter, groupData]);
  const isSpecificExerciseContext = Boolean(
      contextExerciseId ||
      contextExerciseCode ||
      searchParams.get("search") ||
      searchParams.get("exerciseName") ||
      searchParams.get("exercise") ||
      navigationExercise?.name ||
      location.state?.exerciseName,
  );
  const selectedExercise = matchingExercise || (isSpecificExerciseContext ? null : defaultExercise);
  const selectedExerciseLabel =
      requestedExerciseName ||
      selectedExercise?.name ||
      exerciseFilter ||
      contextExerciseCode ||
      contextExerciseId;
  const treeGraph = useMemo(() => {
    const nodes = groupData.nodes
        .filter((node) => node.code)
        .map((node) => ({
          ...node,
          code: String(node.code),
          difficultyLevel: node.difficulty,
        }));
    const edges = (treeResponse?.edges || []).map((edge) => ({
      ...edge,
      status: String(edge.status || "").toUpperCase(),
    }));
    return { nodes, edges };
  }, [groupData, treeResponse]);
  const roots = useMemo(() => rootsOf(treeGraph.nodes, treeGraph.edges), [treeGraph]);
  const requestedRoot = searchParams.get("chain");
  const selectedExerciseRoot = roots.find((root) =>
    layoutChain(treeGraph.nodes, treeGraph.edges, root.code).items
        .some((item) => item.node.code === selectedExercise?.code),
  );
  const rootCode = roots.some((root) => root.code === requestedRoot)
      ? requestedRoot
      : (isSpecificExerciseContext ? selectedExerciseRoot?.code : roots[0]?.code)
        || roots[0]?.code;
  const chain = useMemo(
      () => (rootCode ? layoutChain(treeGraph.nodes, treeGraph.edges, rootCode) : null),
      [treeGraph, rootCode],
  );
  const isReverse = direction === "HARD_TO_EASY";
  const spots = useMemo(() => new Map((chain?.items || []).map((item) => {
    const col = isReverse ? chain.cols - 1 - item.col : item.col;
    return [item.node.code, {
      ...item,
      vcol: col,
      x: col * (NODE_W + GAP_X),
      y: item.row * (NODE_H + GAP_Y),
    }];
  })), [chain, isReverse]);
  const routed = useMemo(
      () => (chain ? routeEdges(spots, chain.edges, isReverse) : { paths: new Map(), maxY: 0 }),
      [chain, spots, isReverse],
  );
  const treeWidth = chain ? chain.cols * NODE_W + (chain.cols - 1) * GAP_X : 0;
  const treeHeight = chain
      ? Math.max(chain.rows * NODE_H + (chain.rows - 1) * GAP_Y, routed.maxY + 8)
      : 0;
  const selectedTreeItem = spots.get(selectedCode)
      || spots.get(selectedExercise?.code)
      || (rootCode ? spots.get(rootCode) : null);

  const handleNodeClick = (node) => {
    setExerciseFilter(node.name);
    setContextExerciseId(String(node.id));
    setContextExerciseCode(String(node.code || ""));
    setSearchParams({
      chain: rootCode,
      highlight: String(node.code || node.id),
      exerciseId: String(node.id),
      exerciseName: node.name,
    });
    setSelectedCode(node.code || null);
  };

  const handleViewExercise = () => {
    const exercise = selectedTreeItem?.node;
    if (!exercise) return;
    const slug =
        exercise.id ||
        exercise.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    navigate(`/library/exercise/${slug}`);
  };

  /**
   * Quay lại màn trước. Nếu member mở cây bài tập từ trang chi tiết bài tập
   * thì quay lại đúng bài đó, ngược lại về danh sách bài tập trong thư viện.
   */
  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/library/exercises");
  };

  return (
      <div className="exercise-tree-page w-full max-w-7xl mx-auto text-white pb-12">
        <style>{`
        .exercise-tree-page,
        .exercise-tree-page * {
          font-family: Arial, sans-serif;
        }
        .exercise-tree-page button {
          outline: none;
        }
        .exercise-tree-scroll {
          scrollbar-width: thin;
          scrollbar-color: #806bb8 #211a3c;
          scrollbar-gutter: stable;
        }
        .exercise-tree-scroll::-webkit-scrollbar {
          height: 8px;
        }
        .exercise-tree-scroll::-webkit-scrollbar-track {
          background: #211a3c;
          border-radius: 999px;
        }
        .exercise-tree-scroll::-webkit-scrollbar-thumb {
          background: #806bb8;
          border: 2px solid #211a3c;
          border-radius: 999px;
        }
        .exercise-tree-scroll::-webkit-scrollbar-thumb:hover {
          background: #a78bfa;
        }
        .exercise-tree-scroll::-webkit-scrollbar-button {
          display: none;
        }
      `}</style>

        {/* 1. HEADER */}
        <header className="mb-6">
          <button
            type="button"
            onClick={goBack}
            className="mb-4 inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-xs text-slate-400 transition-colors hover:text-white"
            aria-label={t("member.exerciseTree.backAria")}
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                clipRule="evenodd"
              />
            </svg>
            <span>{t("member.exerciseTree.back")}</span>
          </button>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {t("member.exerciseTree.title")}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {t("member.exerciseTree.subtitle")}
          </p>
        </header>

        {/* 2. TREE ORDER CONTROL */}
        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-end gap-4">
            {isSpecificExerciseContext && (
              <div className="inline-flex items-center rounded-full border border-[#8068c4] bg-[#2b1d5e] px-4 py-2 text-xs font-medium text-violet-100">
                {selectedExerciseLabel}
              </div>
            )}
            {/* Order toggle changes edge direction only; node coordinates remain stable. */}
            <div className="flex items-center gap-1.5 rounded-full border border-[#51427f] bg-[#0c0820] p-1.5 shadow-inner shadow-black/30">
            <button
                type="button"
                onClick={() => setDirection("EASY_TO_HARD")}
                className={`min-w-[112px] rounded-full border px-5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                    direction === "EASY_TO_HARD"
                        ? "border-[#9b83ff] bg-[#643bf6] text-white shadow-md shadow-purple-950/50"
                        : "border-[#403464] bg-[#1a1435] text-[#c4b5fd] hover:border-[#8068c4] hover:bg-[#261c4b] hover:text-white"
                }`}
            >
              {t("member.exerciseTree.easyToHard")}
            </button>
            <button
                type="button"
                onClick={() => setDirection("HARD_TO_EASY")}
                className={`min-w-[112px] rounded-full border px-5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                    direction === "HARD_TO_EASY"
                        ? "border-[#9b83ff] bg-[#643bf6] text-white shadow-md shadow-purple-950/50"
                        : "border-[#403464] bg-[#1a1435] text-[#c4b5fd] hover:border-[#8068c4] hover:bg-[#261c4b] hover:text-white"
                }`}
            >
              {t("member.exerciseTree.hardToEasy")}
            </button>
            </div>
          </div>

        </div>

        {/* Member uses the same progression layout and edge routing as Content Manager. */}
        <section className="exercise-tree-scroll rounded-2xl border border-[#382b68] bg-[#171133] p-6 mt-5 relative shadow-2xl overflow-x-auto">
          {treeLoading && <p className="mb-4 text-sm text-slate-400">{t("member.exerciseTree.loading")}</p>}
          {treeError && (
              <p role="alert" className="mb-4 rounded-lg border border-amber-900/70 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
                {treeError}
              </p>
          )}
          {!treeLoading && !treeError && !chain?.items.length && (
              <p className="py-12 text-center text-sm text-slate-400">
                {t("member.exerciseTree.empty")}
              </p>
          )}
          {chain?.items.length > 0 && <div className="mx-auto" style={{ width: `${treeWidth}px` }}>
            <div
                className="relative select-none"
                style={{
                  width: `${treeWidth}px`,
                  height: `${treeHeight}px`,
                }}
            >
            {/* SVG Connection Lines & Arrows */}
            <svg
                className="absolute inset-0 z-0 pointer-events-none"
                width={treeWidth}
                height={treeHeight}
                viewBox={`0 0 ${treeWidth} ${treeHeight}`}
            >
              <defs>
                <marker
                    id="tree-arrow"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#806bb8" />
                </marker>
              </defs>

              {chain.edges.map((edge) => (
                    <path
                        key={edge.ruleId}
                        d={routed.paths.get(edge.ruleId)}
                        fill="none"
                        stroke="#806bb8"
                        strokeOpacity={edge.status === "ACTIVE" ? 1 : 0.45}
                        strokeDasharray={edge.status === "ACTIVE" ? undefined : "5 5"}
                        strokeWidth="1.5"
                        markerEnd="url(#tree-arrow)"
                    />
              ))}
            </svg>

            {/* Exercise Nodes */}
            {[...spots.values()].map((item) => {
              const { node } = item;
              const isSelected = selectedTreeItem?.node.code === node.code;

              const isMastered = node.state === "mastered";
              const isCurrent = node.state === "current";

              return (
                  <button
                      type="button"
                      key={node.code}
                      onClick={() => handleNodeClick(node)}
                      aria-pressed={isSelected}
                      style={{
                        position: "absolute",
                        left: `${item.x}px`,
                        top: `${item.y}px`,
                        width: `${NODE_W}px`,
                        height: `${NODE_H}px`,
                      }}
                      className={`relative z-10 rounded-2xl p-3.5 flex flex-col justify-between cursor-pointer transition-all select-none ${
                          isMastered
                              ? "border-2 border-emerald-500/80 bg-[#131f24] hover:border-emerald-400"
                              : isCurrent
                                  ? "border-2 border-[#643bf6] bg-[#22174c] shadow-lg shadow-purple-900/40"
                                  : "border border-[#403464] bg-[#1b1538] hover:border-[#7460a8]"
                      } ${
                          isSelected
                              ? "ring-2 ring-purple-300 ring-offset-2 ring-offset-[#171133] z-10"
                              : "hover:scale-[1.01]"
                      }`}
                  >
                    {/* Status icon + Level badge */}
                    <div className="flex items-center justify-between">
                      {isMastered ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                              />
                            </svg>
                          </div>
                      ) : isCurrent ? (
                          <div className="w-6 h-6 rounded-full bg-[#643bf6] flex items-center justify-center text-white shadow-sm flex-shrink-0">
                            <svg className="w-3 h-3 ml-0.5 fill-white" viewBox="0 0 24 24">
                              <path d="M8 5.14v13.72a1 1 0 001.54.84l11-6.86a1 1 0 000-1.68l-11-6.86A1 1 0 008 5.14z" />
                            </svg>
                          </div>
                      ) : (
                          <div className="w-6 h-6 rounded-full bg-[#29204f] border border-[#62518e] flex items-center justify-center text-slate-200 shadow-sm flex-shrink-0">
                            <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                              <path
                                  fillRule="evenodd"
                                  d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 00-7.5 0v3h7.5z"
                                  clipRule="evenodd"
                              />
                            </svg>
                          </div>
                      )}

                      <span className="text-xs text-[#c4b5fd] font-semibold">
                    {t("member.exerciseTree.levelBadge", { level: item.col + 1 })}
                  </span>
                    </div>

                    {/* Exercise Name */}
                    <div className="line-clamp-3 break-words text-xs font-bold text-white text-center tracking-tight leading-snug px-1">
                      {node.name}
                    </div>

                    {/* Difficulty badge */}
                    <div className="flex justify-center">
                  <span
                      className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border capitalize ${getLevelBadgeStyle(node.difficulty)}`}
                  >
                    {getLevelLabel(node.difficulty)}
                  </span>
                    </div>
                  </button>
              );
            })}
            </div>
          </div>}

          {/* Footer Legend */}
          <div className="mt-8 pt-4 border-t border-[#1e173e] flex items-center justify-between flex-wrap gap-4 text-xs select-none">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-sm" />
                <span className="text-slate-300 font-medium">{groupData.legend?.MASTERED || t("member.exerciseTree.legendMastered")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#643bf6] inline-block shadow-sm" />
                <span className="text-slate-300 font-medium">{groupData.legend?.CURRENT || t("member.exerciseTree.legendCurrent")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full border border-slate-500 inline-block bg-transparent" />
                <span className="text-slate-300 font-medium">{groupData.legend?.LOCKED || t("member.exerciseTree.legendLocked")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 border-t border-dashed border-slate-500 inline-block" />
                <span className="text-slate-300 font-medium">{t("member.exerciseTree.legendInactiveRule")}</span>
              </div>
            </div>

            <div className="text-slate-500 italic">
              {isReverse ? t("member.exerciseTree.arrowsRightToLeft") : t("member.exerciseTree.arrowsLeftToRight")}
            </div>
          </div>
        </section>

        {/* 4. EXERCISE DETAILS PANEL */}
        {selectedTreeItem && (
            <section className="rounded-2xl border border-[#382b68] bg-[#171133] p-5 mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    {selectedTreeItem.node.name}
                  </h2>
                  <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${
                          selectedTreeItem.node.state === "current"
                              ? "border-purple-400/70 bg-purple-900/50 text-purple-200"
                              : selectedTreeItem.node.state === "mastered"
                                  ? "border-emerald-500/50 bg-emerald-900/30 text-emerald-300"
                                  : "border-slate-500/70 bg-slate-800/60 text-slate-300"
                      }`}
                  >
                {selectedTreeItem.node.state === "current"
                    ? t("member.exerciseTree.stateCurrent")
                    : selectedTreeItem.node.state === "mastered"
                        ? t("member.exerciseTree.stateMastered")
                        : t("member.exerciseTree.stateLocked")}
              </span>
                </div>

                <p className="text-xs text-slate-300 mt-1.5">
                  {t("member.exerciseTree.detailMeta", {
                    level: selectedTreeItem.col + 1,
                    difficulty: selectedTreeItem.node.difficulty || t("member.exerciseTree.noLevel"),
                    muscles: (selectedTreeItem.node.muscleGroups || []).join(", "),
                  })}
                </p>

                <p className="text-xs text-slate-300 mt-1">
                  {t("member.exerciseTree.previousLabel")}:{" "}
                  {selectedTreeItem.node.previous && selectedTreeItem.node.previous.length > 0
                      ? selectedTreeItem.node.previous.join(", ")
                      : t("member.exerciseTree.none")}{" "}
                  · {t("member.exerciseTree.nextLabel")}:{" "}
                  {selectedTreeItem.node.next && selectedTreeItem.node.next.length > 0
                      ? selectedTreeItem.node.next.join(", ")
                      : t("member.exerciseTree.none")}
                </p>
              </div>

              <div className="flex items-center flex-shrink-0">
                <button
                    type="button"
                    onClick={handleViewExercise}
                    className="rounded-xl bg-[#643bf6] hover:bg-[#522cd9] text-white text-xs font-semibold px-6 py-3 shadow-md transition-all active:scale-95 cursor-pointer whitespace-nowrap outline-none border-0"
                >
                  {t("member.exerciseTree.viewExercise")}
                </button>
              </div>
            </section>
        )}
      </div>
  );
}