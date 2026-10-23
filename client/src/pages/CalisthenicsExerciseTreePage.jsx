import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getExerciseTree } from "../api/library";

// Movement groups and their Calisthenics progression tree data
const TREE_DATA = {
  Push: {
    name: "Push",
    branchFromCol: 1, // Branch descends from Push-up (col 1)
    branchTargetCol: 2, // Connects to Pike push-up (col 2)
    nodes: [
      // Row 1 (Main progression)
      {
        id: "knee-push-up",
        name: "Knee push-up",
        level: "Lv 1",
        levelNumber: 1,
        difficulty: "Beginner",
        state: "mastered",
        muscleGroups: ["Chest", "Triceps", "Core"],
        previous: [],
        next: ["Push-up"],
        col: 0,
        row: 0,
      },
      {
        id: "push-up",
        name: "Push-up",
        level: "Lv 2",
        levelNumber: 2,
        difficulty: "Beginner",
        state: "current",
        muscleGroups: ["Chest", "Triceps", "Core"],
        previous: ["Knee push-up"],
        next: ["Diamond push-up", "Pike push-up"],
        col: 1,
        row: 0,
      },
      {
        id: "diamond-push-up",
        name: "Diamond push-up",
        level: "Lv 3",
        levelNumber: 3,
        difficulty: "Intermediate",
        state: "locked",
        muscleGroups: ["Chest", "Triceps"],
        previous: ["Push-up"],
        next: ["Archer push-up"],
        col: 2,
        row: 0,
      },
      {
        id: "archer-push-up",
        name: "Archer push-up",
        level: "Lv 4",
        levelNumber: 4,
        difficulty: "Advanced",
        state: "locked",
        muscleGroups: ["Chest", "Triceps", "Shoulders"],
        previous: ["Diamond push-up"],
        next: ["One arm push-up"],
        col: 3,
        row: 0,
      },
      {
        id: "one-arm-push-up",
        name: "One arm push-up",
        level: "Lv 5",
        levelNumber: 5,
        difficulty: "Expert",
        state: "locked",
        muscleGroups: ["Chest", "Triceps", "Core"],
        previous: ["Archer push-up"],
        next: [],
        col: 4,
        row: 0,
      },
      // Row 2 (Branching progression)
      {
        id: "pike-push-up",
        name: "Pike push-up",
        level: "Lv 3",
        levelNumber: 3,
        difficulty: "Intermediate",
        state: "locked",
        muscleGroups: ["Shoulders", "Triceps", "Upper Chest"],
        previous: ["Push-up"],
        next: ["Handstand push-up"],
        col: 2,
        row: 1,
      },
      {
        id: "handstand-push-up",
        name: "Handstand push-up",
        level: "Lv 4",
        levelNumber: 4,
        difficulty: "Advanced",
        state: "locked",
        muscleGroups: ["Shoulders", "Triceps", "Core"],
        previous: ["Pike push-up"],
        next: [],
        col: 3,
        row: 1,
      },
    ],
  },
  Pull: {
    name: "Pull",
    branchFromCol: 2, // From Pull-up (col 2)
    branchTargetCol: 2, // To Tuck front lever (col 2)
    nodes: [
      {
        id: "australian-pull-up",
        name: "Australian pull-up",
        level: "Lv 1",
        levelNumber: 1,
        difficulty: "Beginner",
        state: "mastered",
        muscleGroups: ["Back", "Biceps", "Rear Delts"],
        previous: [],
        next: ["Dead hang pull-up"],
        col: 0,
        row: 0,
      },
      {
        id: "dead-hang-pull-up",
        name: "Dead hang pull-up",
        level: "Lv 2",
        levelNumber: 2,
        difficulty: "Beginner",
        state: "mastered",
        muscleGroups: ["Back", "Forearms", "Biceps"],
        previous: ["Australian pull-up"],
        next: ["Pull-up"],
        col: 1,
        row: 0,
      },
      {
        id: "pull-up",
        name: "Pull-up",
        level: "Lv 3",
        levelNumber: 3,
        difficulty: "Intermediate",
        state: "current",
        muscleGroups: ["Lats", "Biceps", "Upper Back"],
        previous: ["Dead hang pull-up"],
        next: ["Chest to bar", "Tuck front lever"],
        col: 2,
        row: 0,
      },
      {
        id: "chest-to-bar",
        name: "Chest to bar",
        level: "Lv 4",
        levelNumber: 4,
        difficulty: "Advanced",
        state: "locked",
        muscleGroups: ["Lats", "Biceps", "Core"],
        previous: ["Pull-up"],
        next: ["Muscle-up"],
        col: 3,
        row: 0,
      },
      {
        id: "muscle-up",
        name: "Muscle-up",
        level: "Lv 5",
        levelNumber: 5,
        difficulty: "Expert",
        state: "locked",
        muscleGroups: ["Full Upper Body", "Lats", "Triceps"],
        previous: ["Chest to bar"],
        next: [],
        col: 4,
        row: 0,
      },
      {
        id: "tuck-front-lever",
        name: "Tuck front lever",
        level: "Lv 3",
        levelNumber: 3,
        difficulty: "Intermediate",
        state: "locked",
        muscleGroups: ["Lats", "Core", "Shoulders"],
        previous: ["Pull-up"],
        next: ["Full front lever"],
        col: 2,
        row: 1,
      },
      {
        id: "full-front-lever",
        name: "Full front lever",
        level: "Lv 4",
        levelNumber: 4,
        difficulty: "Advanced",
        state: "locked",
        muscleGroups: ["Lats", "Core", "Scapula"],
        previous: ["Tuck front lever"],
        next: [],
        col: 3,
        row: 1,
      },
    ],
  },
  Legs: {
    name: "Legs",
    branchFromCol: 1, // From Bodyweight squat (col 1)
    branchTargetCol: 2, // To Nordic curl (col 2)
    nodes: [
      {
        id: "assisted-squat",
        name: "Assisted squat",
        level: "Lv 1",
        levelNumber: 1,
        difficulty: "Beginner",
        state: "mastered",
        muscleGroups: ["Quadriceps", "Glutes"],
        previous: [],
        next: ["Bodyweight squat"],
        col: 0,
        row: 0,
      },
      {
        id: "bodyweight-squat",
        name: "Bodyweight squat",
        level: "Lv 2",
        levelNumber: 2,
        difficulty: "Beginner",
        state: "current",
        muscleGroups: ["Quadriceps", "Glutes", "Hamstrings"],
        previous: ["Assisted squat"],
        next: ["Bulgarian split squat", "Nordic curl"],
        col: 1,
        row: 0,
      },
      {
        id: "bulgarian-split-squat",
        name: "Bulgarian split squat",
        level: "Lv 3",
        levelNumber: 3,
        difficulty: "Intermediate",
        state: "locked",
        muscleGroups: ["Quadriceps", "Glutes", "Adductors"],
        previous: ["Bodyweight squat"],
        next: ["Pistol squat"],
        col: 2,
        row: 0,
      },
      {
        id: "pistol-squat",
        name: "Pistol squat",
        level: "Lv 4",
        levelNumber: 4,
        difficulty: "Advanced",
        state: "locked",
        muscleGroups: ["Quadriceps", "Glutes", "Balance"],
        previous: ["Bulgarian split squat"],
        next: ["Dragon pistol squat"],
        col: 3,
        row: 0,
      },
      {
        id: "dragon-pistol-squat",
        name: "Dragon pistol squat",
        level: "Lv 5",
        levelNumber: 5,
        difficulty: "Expert",
        state: "locked",
        muscleGroups: ["Full Leg", "Mobility", "Ankles"],
        previous: ["Pistol squat"],
        next: [],
        col: 4,
        row: 0,
      },
      {
        id: "nordic-curl",
        name: "Nordic curl",
        level: "Lv 3",
        levelNumber: 3,
        difficulty: "Intermediate",
        state: "locked",
        muscleGroups: ["Hamstrings", "Calves", "Glutes"],
        previous: ["Bodyweight squat"],
        next: ["Single leg calf raise"],
        col: 2,
        row: 1,
      },
      {
        id: "single-leg-calf-raise",
        name: "Single leg calf raise",
        level: "Lv 4",
        levelNumber: 4,
        difficulty: "Advanced",
        state: "locked",
        muscleGroups: ["Calves", "Ankles"],
        previous: ["Nordic curl"],
        next: [],
        col: 3,
        row: 1,
      },
    ],
  },
  Core: {
    name: "Core",
    branchFromCol: 1, // From Full plank (col 1)
    branchTargetCol: 2, // To Dragon flag (col 2)
    nodes: [
      {
        id: "knee-plank",
        name: "Knee plank",
        level: "Lv 1",
        levelNumber: 1,
        difficulty: "Beginner",
        state: "mastered",
        muscleGroups: ["Rectus Abdominis", "Transverse Abdominis"],
        previous: [],
        next: ["Full plank"],
        col: 0,
        row: 0,
      },
      {
        id: "full-plank",
        name: "Full plank",
        level: "Lv 2",
        levelNumber: 2,
        difficulty: "Beginner",
        state: "current",
        muscleGroups: ["Full Core", "Shoulders", "Glutes"],
        previous: ["Knee plank"],
        next: ["Hanging leg raise", "Dragon flag"],
        col: 1,
        row: 0,
      },
      {
        id: "hanging-leg-raise",
        name: "Hanging leg raise",
        level: "Lv 3",
        levelNumber: 3,
        difficulty: "Intermediate",
        state: "locked",
        muscleGroups: ["Lower Abs", "Hip Flexors", "Grip"],
        previous: ["Full plank"],
        next: ["L-sit"],
        col: 2,
        row: 0,
      },
      {
        id: "l-sit",
        name: "L-sit",
        level: "Lv 4",
        levelNumber: 4,
        difficulty: "Advanced",
        state: "locked",
        muscleGroups: ["Core", "Triceps", "Hip Flexors"],
        previous: ["Hanging leg raise"],
        next: ["V-sit"],
        col: 3,
        row: 0,
      },
      {
        id: "v-sit",
        name: "V-sit",
        level: "Lv 5",
        levelNumber: 5,
        difficulty: "Expert",
        state: "locked",
        muscleGroups: ["Core", "Hip Flexors", "Triceps"],
        previous: ["L-sit"],
        next: [],
        col: 4,
        row: 0,
      },
      {
        id: "dragon-flag",
        name: "Dragon flag",
        level: "Lv 3",
        levelNumber: 3,
        difficulty: "Intermediate",
        state: "locked",
        muscleGroups: ["Upper & Lower Abs", "Lats"],
        previous: ["Full plank"],
        next: ["Human flag"],
        col: 2,
        row: 1,
      },
      {
        id: "human-flag",
        name: "Human flag",
        level: "Lv 4",
        levelNumber: 4,
        difficulty: "Advanced",
        state: "locked",
        muscleGroups: ["Obliques", "Lats", "Shoulders"],
        previous: ["Dragon flag"],
        next: [],
        col: 3,
        row: 1,
      },
    ],
  },
};

const MOVEMENT_GROUPS = ["Push", "Pull", "Legs", "Core"];

// Layout constants for the SVG grid
const CARD_WIDTH = 144;
const CARD_HEIGHT = 144;
const GAP_X = 48;
const GAP_Y = 48;
const GRID_WIDTH = 5 * CARD_WIDTH + 4 * GAP_X;
export default function CalisthenicsExerciseTreePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Read path query param (e.g. ?path=push)
  const pathParam = searchParams.get("path")?.toLowerCase();
  const initialGroup =
    MOVEMENT_GROUPS.find((g) => g.toLowerCase() === pathParam) || "Push";

  const [selectedGroup, setSelectedGroup] = useState(initialGroup);
  const [direction, setDirection] = useState("Easy → Hard");
  const [treeResponse, setTreeResponse] = useState(null);
  const [treeError, setTreeError] = useState("");
  const [treeLoading, setTreeLoading] = useState(true);

  // Keep document title synced to match mockup window header: CalisHealth - Explore
  useEffect(() => {
    document.title = "CalisHealth - Explore";
    return () => {
      document.title = "CalisHealth";
    };
  }, []);

  // Sync state if URL query param changes externally
  useEffect(() => {
    if (pathParam) {
      const match = MOVEMENT_GROUPS.find((g) => g.toLowerCase() === pathParam);
      if (match && match !== selectedGroup) {
        setSelectedGroup(match);
      }
    }
  }, [pathParam]);

  useEffect(() => {
    let isMounted = true;
    setTreeLoading(true);
    setTreeError("");
    getExerciseTree({
      movementGroup: selectedGroup.toUpperCase(),
      order: direction === "Hard → Easy" ? "HARD_TO_EASY" : "EASY_TO_HARD",
    })
      .then((data) => {
        if (isMounted) setTreeResponse(data);
      })
      .catch((error) => {
        console.error("Failed to load exercise tree:", error);
        if (isMounted) {
          setTreeResponse(null);
          setTreeError("Unable to load this exercise tree. Please try again.");
        }
      })
      .finally(() => {
        if (isMounted) setTreeLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedGroup, direction]);

  const groupData = useMemo(() => {
    const expectedGroup = selectedGroup.toUpperCase();
    if (!treeResponse || treeResponse.movementGroup !== expectedGroup) {
      return { ...(TREE_DATA[selectedGroup] || TREE_DATA.Push), nodes: [] };
    }

    const sortedNodes = [...(treeResponse.nodes || [])].sort(
      (first, second) => first.level - second.level || first.id - second.id
    );
    const rowsByLevel = new Map();
    const nodes = sortedNodes.map((node) => {
      const level = node.level || 1;
      const row = rowsByLevel.get(level) || 0;
      rowsByLevel.set(level, row + 1);
      return {
        ...node,
        level: `Lv ${level}`,
        levelNumber: level,
        state: node.state?.toLowerCase(),
        col: Math.max(0, Math.min(4, level - 1)),
        row,
        muscleGroups: node.targetMuscle ? node.targetMuscle.split(",").map((muscle) => muscle.trim()) : [],
        previous: (node.prerequisiteIds || [])
          .map((id) => sortedNodes.find((candidate) => candidate.id === id)?.name)
          .filter(Boolean),
        next: (node.nextExerciseIds || [])
          .map((id) => sortedNodes.find((candidate) => candidate.id === id)?.name)
          .filter(Boolean),
      };
    });
    return {
      name: selectedGroup,
      nodes,
      legend: treeResponse.legend,
    };
  }, [selectedGroup, treeResponse]);
  const maxRow = Math.max(0, ...groupData.nodes.map((node) => node.row || 0));
  const gridHeight = Math.max(1, maxRow + 1) * CARD_HEIGHT + maxRow * GAP_Y;
  const nodeById = new Map(groupData.nodes.map((node) => [node.id, node]));
  const treeEdges = groupData.nodes.flatMap((node) =>
    (node.nextExerciseIds || [])
      .map((nextId) => ({ from: node, to: nodeById.get(nextId) }))
      .filter((edge) => edge.to)
  );

  // Find default selected exercise (prefer state 'current', else first node)
  const defaultExercise = useMemo(() => {
    return (
      groupData.nodes.find((n) => n.state === "current") || groupData.nodes[0]
    );
  }, [groupData]);

  const [selectedExercise, setSelectedExercise] = useState(defaultExercise);

  // Update selectedExercise whenever selectedGroup changes
  useEffect(() => {
    setSelectedExercise(defaultExercise);
  }, [defaultExercise]);

  const handleGroupSelect = (group) => {
    setSelectedGroup(group);
    setSearchParams({ path: group.toLowerCase() });
  };

  const handleNodeClick = (node) => {
    setSelectedExercise(node);
  };

  const handleViewExercise = () => {
    if (!selectedExercise) return;
    const slug =
      selectedExercise.id ||
      selectedExercise.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    navigate(`/library/exercise/${slug}`);
  };

  // Node position calculation
  const isReverse = direction === "Hard → Easy";

  const getNodeX = (col) => {
    const effectiveCol = isReverse ? 4 - col : col;
    return effectiveCol * (CARD_WIDTH + GAP_X);
  };

  const getNodeY = (row) => {
    return row * (CARD_HEIGHT + GAP_Y);
  };

  // Arrow lines calculations based on direction
  return (
    <div className="exercise-tree-page w-full max-w-7xl mx-auto text-white pb-12">
      {/* Explicit scoped style reset for buttons */}
      <style>{`
        .exercise-tree-page button {
          border: none;
          outline: none;
        }
      `}</style>

      {/* 1. HEADER */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Calisthenics Exercise Tree
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Browse exercises and workouts, or build your own.
        </p>
      </header>

      {/* 2. CONTROLS (MOVEMENT GROUP CHIPS & ORDER TOGGLE) */}
      <div className="flex items-center justify-between mt-6 flex-wrap gap-4">
        {/* Movement group chips */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {MOVEMENT_GROUPS.map((group) => {
            const isActive = selectedGroup === group;
            return (
              <button
                key={group}
                type="button"
                onClick={() => handleGroupSelect(group)}
                className={`rounded-full px-5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#5b32e8] text-white shadow-md shadow-purple-900/30"
                    : "bg-[#18133a] border border-[#44366f] text-[#c4b5fd] hover:text-white hover:border-[#8068c4]"
                }`}
              >
                {group}
              </button>
            );
          })}
        </div>

        {/* Order toggle: Easy -> Hard / Hard -> Easy */}
        <div className="flex items-center gap-1.5 rounded-full border border-[#51427f] bg-[#0c0820] p-1.5 shadow-inner shadow-black/30">
          <button
            type="button"
            onClick={() => setDirection("Easy → Hard")}
            className={`min-w-[112px] rounded-full border px-5 py-2 text-xs font-semibold transition-all cursor-pointer ${
              direction === "Easy → Hard"
                ? "border-[#9b83ff] bg-[#643bf6] text-white shadow-md shadow-purple-950/50"
                : "border-[#403464] bg-[#1a1435] text-[#c4b5fd] hover:border-[#8068c4] hover:bg-[#261c4b] hover:text-white"
            }`}
          >
            Easy → Hard
          </button>
          <button
            type="button"
            onClick={() => setDirection("Hard → Easy")}
            className={`min-w-[112px] rounded-full border px-5 py-2 text-xs font-semibold transition-all cursor-pointer ${
              direction === "Hard → Easy"
                ? "border-[#9b83ff] bg-[#643bf6] text-white shadow-md shadow-purple-950/50"
                : "border-[#403464] bg-[#1a1435] text-[#c4b5fd] hover:border-[#8068c4] hover:bg-[#261c4b] hover:text-white"
            }`}
          >
            Hard → Easy
          </button>
        </div>
      </div>

      {/* 3. KHUNG CÂY TIẾN TRÌNH (EXERCISE TREE BOX) */}
      <section className="rounded-2xl border border-[#382b68] bg-[#171133] p-6 mt-5 relative shadow-2xl overflow-x-auto">
        {treeLoading && <p className="mb-4 text-sm text-slate-400">Loading exercise tree…</p>}
        {treeError && (
          <p role="alert" className="mb-4 rounded-lg border border-rose-900/70 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
            {treeError}
          </p>
        )}
        {!treeError && treeResponse?.movementGroup === selectedGroup.toUpperCase() && groupData.nodes.length === 0 && (
          <p className="mb-4 text-sm text-slate-400">No exercises are configured for this movement group yet.</p>
        )}
        <div
          className="relative mx-auto select-none"
          style={{ width: `${GRID_WIDTH}px`, height: `${gridHeight}px` }}
        >
          {/* SVG Connection Lines & Arrows */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={GRID_WIDTH}
            height={gridHeight}
            viewBox={`0 0 ${GRID_WIDTH} ${gridHeight}`}
          >
            <defs>
              <marker
                id="tree-arrow"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#523d8c" />
              </marker>
            </defs>

            {treeEdges.map(({ from, to }) => (
              <line
                key={`${from.id}-${to.id}`}
                x1={getNodeX(from.col) + CARD_WIDTH / 2}
                y1={getNodeY(from.row) + CARD_HEIGHT / 2}
                x2={getNodeX(to.col) + CARD_WIDTH / 2}
                y2={getNodeY(to.row) + CARD_HEIGHT / 2}
                stroke="#806bb8"
                strokeWidth="2"
                markerEnd="url(#tree-arrow)"
              />
            ))}
          </svg>

          {/* Exercise Nodes */}
          {groupData.nodes.map((node) => {
            const posX = getNodeX(node.col);
            const posY = getNodeY(node.row);
            const isSelected = selectedExercise?.id === node.id;

            const isMastered = node.state === "mastered";
            const isCurrent = node.state === "current";
            const isLocked = node.state === "locked";

            const diff = node.difficulty?.toLowerCase();
            const isBeginner = diff === "beginner";
            const isIntermediate = diff === "intermediate";
            const isAdvanced = diff === "advanced";

            return (
              <div
                key={node.id}
                onClick={() => handleNodeClick(node)}
                style={{
                  position: "absolute",
                  left: `${posX}px`,
                  top: `${posY}px`,
                  width: `${CARD_WIDTH}px`,
                  height: `${CARD_HEIGHT}px`,
                }}
                className={`rounded-2xl p-3.5 flex flex-col justify-between cursor-pointer transition-all select-none ${
                  isMastered
                    ? "border-2 border-emerald-500/80 bg-[#131f24] hover:border-emerald-400"
                    : isCurrent
                    ? "border-2 border-[#643bf6] bg-[#22174c] shadow-lg shadow-purple-900/40"
                    : "border border-[#403464] bg-[#1b1538] hover:border-[#7460a8]"
                } ${
                  isSelected
                    ? "ring-2 ring-purple-300 ring-offset-2 ring-offset-[#171133] scale-[1.02]"
                    : "hover:scale-[1.01]"
                }`}
              >
                {/* Góc trên: Icon trạng thái bên trái và nhãn Level bên phải */}
                <div className="flex items-center justify-between">
                  {/* Icon trạng thái */}
                  {isMastered ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  ) : isCurrent ? (
                    <div className="w-6 h-6 rounded-full bg-[#643bf6] flex items-center justify-center text-white shadow-sm flex-shrink-0">
                      <svg
                        className="w-3 h-3 ml-0.5 fill-white"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="M8 5.14v13.72a1 1 0 001.54.84l11-6.86a1 1 0 000-1.68l-11-6.86A1 1 0 008 5.14z" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#29204f] border border-[#62518e] flex items-center justify-center text-slate-200 shadow-sm flex-shrink-0">
                      <svg
                        className="w-3 h-3 text-slate-400"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 00-7.5 0v3h7.5z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}

                  {/* Nhãn Level (Lv 1 - Lv 5) */}
                  <span className="text-xs text-[#c4b5fd] font-semibold">
                    {node.level}
                  </span>
                </div>

                {/* Ở giữa: Tên bài tập in đậm, căn giữa */}
                <div className="text-xs font-bold text-white text-center tracking-tight leading-snug px-1">
                  {node.name}
                </div>

                {/* Góc dưới: Badge độ khó căn giữa */}
                <div className="flex justify-center">
                  <span
                    className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border capitalize ${
                      isBeginner
                        ? "border-emerald-800/80 bg-emerald-950/50 text-emerald-400"
                        : isIntermediate
                        ? "border-amber-800/80 bg-amber-950/50 text-amber-400"
                        : isAdvanced
                        ? "border-rose-800/80 bg-rose-950/50 text-rose-400"
                        : "border-amber-600/80 bg-amber-900/40 text-amber-300"
                    }`}
                  >
                    {node.difficulty}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Chân khung Tree (Footer Legend & Note) */}
        <div className="mt-8 pt-4 border-t border-[#1e173e] flex items-center justify-between flex-wrap gap-4 text-xs select-none">
          {/* Bên trái: Chú thích (Legend) */}
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-sm" />
              <span className="text-slate-300 font-medium">{groupData.legend?.MASTERED || "Mastered"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7] inline-block shadow-sm" />
              <span className="text-slate-300 font-medium">{groupData.legend?.CURRENT || "Current"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full border border-slate-500 inline-block bg-transparent" />
              <span className="text-slate-300 font-medium">{groupData.legend?.LOCKED || "Locked"}</span>
            </div>
          </div>

          {/* Bên phải: Ghi chú */}
          <div className="text-slate-500 italic">
            Arrows point to harder exercises
          </div>
        </div>
      </section>

      {/* 4. BẢNG CHI TIẾT BÀI TẬP ĐƯỢC CHỌN (EXERCISE DETAILS PANEL) */}
      {selectedExercise && (
        <section className="rounded-2xl border border-[#382b68] bg-[#171133] p-5 mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
          <div className="flex flex-col min-w-0">
            {/* Dòng 1: Tên bài tập + State chip */}
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-bold text-white tracking-tight">
                {selectedExercise.name}
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${
                  selectedExercise.state === "current"
                    ? "border-purple-400/70 bg-purple-900/50 text-purple-200"
                    : selectedExercise.state === "mastered"
                    ? "border-emerald-500/50 bg-emerald-900/30 text-emerald-300"
                    : "border-slate-500/70 bg-slate-800/60 text-slate-300"
                }`}
              >
                {selectedExercise.state === "current"
                  ? "Current"
                  : selectedExercise.state === "mastered"
                  ? "Mastered"
                  : "Locked"}
              </span>
            </div>

            {/* Dòng 2: Level · Difficulty · Muscle groups */}
            <p className="text-xs text-slate-300 mt-1.5">
              Level {selectedExercise.levelNumber || 2} ·{" "}
              {selectedExercise.difficulty} ·{" "}
              {(selectedExercise.muscleGroups || []).join(", ")}
            </p>

            {/* Dòng 3: Previous: ... · Next: ... */}
            <p className="text-xs text-slate-300 mt-1">
              Previous:{" "}
              {selectedExercise.previous && selectedExercise.previous.length > 0
                ? selectedExercise.previous.join(", ")
                : "None"}{" "}
              · Next:{" "}
              {selectedExercise.next && selectedExercise.next.length > 0
                ? selectedExercise.next.join(", ")
                : "None"}
            </p>
          </div>

          {/* Nút "View exercise" */}
          <div className="flex items-center flex-shrink-0">
            <button
              type="button"
              onClick={handleViewExercise}
              className="rounded-xl bg-[#643bf6] hover:bg-[#522cd9] text-white text-xs font-semibold px-6 py-3 shadow-md transition-all active:scale-95 cursor-pointer whitespace-nowrap outline-none border-0"
            >
              View exercise
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
