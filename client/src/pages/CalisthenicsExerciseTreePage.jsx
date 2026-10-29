import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { getExerciseTree } from "../api/library";
import { getLevelBadgeStyle } from "../utils/levelBadge";

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
        prerequisiteIds: [],
        nextExerciseIds: ["push-up"],
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
        prerequisiteIds: ["knee-push-up"],
        nextExerciseIds: ["diamond-push-up", "pike-push-up"],
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
        prerequisiteIds: ["push-up"],
        nextExerciseIds: ["archer-push-up"],
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
        prerequisiteIds: ["diamond-push-up"],
        nextExerciseIds: ["one-arm-push-up"],
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
        prerequisiteIds: ["archer-push-up"],
        nextExerciseIds: [],
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
        prerequisiteIds: ["push-up"],
        nextExerciseIds: ["handstand-push-up"],
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
        prerequisiteIds: ["pike-push-up"],
        nextExerciseIds: [],
        previous: ["Pike push-up"],
        next: [],
        col: 3,
        row: 1,
      },
    ],
  },
  Pull: {
    name: "Pull",
    branchFromCol: 2,
    branchTargetCol: 2,
    nodes: [
      {
        id: "australian-pull-up",
        name: "Australian pull-up",
        level: "Lv 1",
        levelNumber: 1,
        difficulty: "Beginner",
        state: "mastered",
        muscleGroups: ["Back", "Biceps", "Rear Delts"],
        prerequisiteIds: [],
        nextExerciseIds: ["dead-hang-pull-up"],
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
        prerequisiteIds: ["australian-pull-up"],
        nextExerciseIds: ["pull-up"],
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
        prerequisiteIds: ["dead-hang-pull-up"],
        nextExerciseIds: ["chest-to-bar", "tuck-front-lever"],
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
        prerequisiteIds: ["pull-up"],
        nextExerciseIds: ["muscle-up"],
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
        prerequisiteIds: ["chest-to-bar"],
        nextExerciseIds: [],
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
        prerequisiteIds: ["pull-up"],
        nextExerciseIds: ["full-front-lever"],
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
        prerequisiteIds: ["tuck-front-lever"],
        nextExerciseIds: [],
        previous: ["Tuck front lever"],
        next: [],
        col: 3,
        row: 1,
      },
    ],
  },
  Legs: {
    name: "Legs",
    branchFromCol: 1,
    branchTargetCol: 2,
    nodes: [
      {
        id: "assisted-squat",
        name: "Assisted squat",
        level: "Lv 1",
        levelNumber: 1,
        difficulty: "Beginner",
        state: "mastered",
        muscleGroups: ["Quadriceps", "Glutes"],
        prerequisiteIds: [],
        nextExerciseIds: ["bodyweight-squat"],
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
        prerequisiteIds: ["assisted-squat"],
        nextExerciseIds: ["bulgarian-split-squat", "nordic-curl"],
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
        prerequisiteIds: ["bodyweight-squat"],
        nextExerciseIds: ["pistol-squat"],
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
        prerequisiteIds: ["bulgarian-split-squat"],
        nextExerciseIds: ["dragon-pistol-squat"],
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
        prerequisiteIds: ["pistol-squat"],
        nextExerciseIds: [],
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
        prerequisiteIds: ["bodyweight-squat"],
        nextExerciseIds: ["single-leg-calf-raise"],
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
        prerequisiteIds: ["nordic-curl"],
        nextExerciseIds: [],
        previous: ["Nordic curl"],
        next: [],
        col: 3,
        row: 1,
      },
    ],
  },
  Core: {
    name: "Core",
    branchFromCol: 1,
    branchTargetCol: 2,
    nodes: [
      {
        id: "knee-plank",
        name: "Knee plank",
        level: "Lv 1",
        levelNumber: 1,
        difficulty: "Beginner",
        state: "mastered",
        muscleGroups: ["Rectus Abdominis", "Transverse Abdominis"],
        prerequisiteIds: [],
        nextExerciseIds: ["full-plank"],
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
        prerequisiteIds: ["knee-plank"],
        nextExerciseIds: ["hanging-leg-raise", "dragon-flag"],
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
        prerequisiteIds: ["full-plank"],
        nextExerciseIds: ["l-sit"],
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
        prerequisiteIds: ["hanging-leg-raise"],
        nextExerciseIds: ["v-sit"],
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
        prerequisiteIds: ["l-sit"],
        nextExerciseIds: [],
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
        prerequisiteIds: ["full-plank"],
        nextExerciseIds: ["human-flag"],
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
        prerequisiteIds: ["dragon-flag"],
        nextExerciseIds: [],
        previous: ["Dragon flag"],
        next: [],
        col: 3,
        row: 1,
      },
    ],
  },
};

const MOVEMENT_GROUPS = ["Push", "Pull", "Legs", "Core"];

function normalizeExerciseName(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferMovementGroup(exerciseName, muscleGroups = "") {
  const normalizedName = normalizeExerciseName(exerciseName);
  const matchingTreeGroup = MOVEMENT_GROUPS.find((group) =>
    (TREE_DATA[group]?.nodes || []).some(
      (node) => normalizeExerciseName(node.name) === normalizedName,
    ),
  );
  if (matchingTreeGroup) return matchingTreeGroup;

  if (/\b(pull|row|lever|muscle up|chin up)\b/.test(normalizedName)) return "Pull";
  if (/\b(plank|hollow|sit|flag|abs|core|leg raise|knee tuck|knee raise)\b/.test(normalizedName)) return "Core";
  if (/\b(squat|lunge|calf|leg|nordic)\b/.test(normalizedName)) return "Legs";
  if (/\bhang\b/.test(normalizedName)) return "Pull";
  if (/\b(push|dip|press|planche|handstand)\b/.test(normalizedName)) return "Push";

  const normalizedMuscles = normalizeExerciseName(muscleGroups);
  if (/\b(core|abdominal|abs|oblique)\b/.test(normalizedMuscles)) return "Core";
  if (/\b(leg|legs|quadricep|hamstring|calf|glute)\b/.test(normalizedMuscles)) return "Legs";
  if (/\b(back|lat|bicep|forearm)\b/.test(normalizedMuscles)) return "Pull";
  if (/\b(chest|tricep|shoulder|arm)\b/.test(normalizedMuscles)) return "Push";
  return "Push";
}

// Layout constants for the SVG grid
const CARD_WIDTH = 144;
const CARD_HEIGHT = 144;
const GAP_X = 48;
const GAP_Y = 48;
const GRID_WIDTH = 5 * CARD_WIDTH + 4 * GAP_X;
export default function CalisthenicsExerciseTreePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationExercise = location.state?.selectedExercise || location.state?.exercise;

  const requestedGroup = [
      searchParams.get("group") || "",
      searchParams.get("movementGroup") || "",
      searchParams.get("skillGroup") || "",
      searchParams.get("path") || "",
      navigationExercise?.movementGroup || "",
      location.state?.movementGroup || "",
  ]
      .map((group) => MOVEMENT_GROUPS.find((candidate) => candidate.toLowerCase() === group.toLowerCase()))
      .find(Boolean);
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
  const initialMuscleGroups = navigationExercise?.targetMuscle
      || navigationExercise?.muscleGroup
      || navigationExercise?.muscleGroups?.join?.(" ")
      || "";
  const inferredGroup = inferMovementGroup(initialExerciseName, initialMuscleGroups);
  const initialGroup = requestedGroup || inferredGroup || "Push";

  const [selectedGroup, setSelectedGroup] = useState(initialGroup);
  const [direction, setDirection] = useState("Easy → Hard");
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
    document.title = "CalisHealth - Explore";
    return () => {
      document.title = "CalisHealth";
    };
  }, []);

  // Sync context if URL parameters or navigation state change externally.
  useEffect(() => {
    const match = requestedGroup;
    if (match && match !== selectedGroup) setSelectedGroup(match);

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
    const nextMuscleGroups = navigationExercise?.targetMuscle
        || navigationExercise?.muscleGroup
        || navigationExercise?.muscleGroups?.join?.(" ")
        || "";
    const inferredNextGroup = requestedGroup
        || inferMovementGroup(nextExerciseName, nextMuscleGroups);
    if (inferredNextGroup && inferredNextGroup !== selectedGroup) {
      setSelectedGroup(inferredNextGroup);
    }
    const nextSearch = searchParams.get("search") || "";
    setContextExerciseId(nextExerciseId);
    setContextExerciseCode(nextExerciseCode);
    setExerciseFilter(nextExerciseName || nextSearch || nextExerciseCode || nextExerciseId);
  }, [requestedGroup, searchParams, navigationExercise, location.state, selectedGroup]);

  // If navigation supplies an exercise but no group, resolve its group from the API.
  useEffect(() => {
    if (
        requestedGroup ||
        (!contextExerciseId && !contextExerciseCode && !exerciseFilter.trim())
    ) return undefined;
    let isMounted = true;
    Promise.all(
        MOVEMENT_GROUPS.map((group) =>
            getExerciseTree({ movementGroup: group.toUpperCase(), order: "EASY_TO_HARD" }),
        ),
    )
        .then((responses) => {
          if (!isMounted) return;
      const normalizedName = normalizeExerciseName(exerciseFilter);
      const matchingCodeIndex = contextExerciseCode
          ? responses.findIndex((response) =>
            (response.nodes || []).some(
                (node) => String(node.code || "").toLowerCase() === contextExerciseCode.toLowerCase(),
            ),
        )
          : -1;
      const matchingNameIndex = responses.findIndex((response) =>
          (response.nodes || []).some(
          (node) =>
              normalizeExerciseName(node.name) === normalizedName ||
              normalizeExerciseName(node.code) === normalizedName,
          ),
      );
      const matchingIdIndex = contextExerciseId
          ? responses.findIndex((response) =>
            (response.nodes || []).some(
                (node) => String(node.id) === contextExerciseId,
            ),
        )
          : -1;
      const matchIndex = matchingCodeIndex >= 0
          ? matchingCodeIndex
          : matchingNameIndex >= 0 ? matchingNameIndex : matchingIdIndex;
      if (matchIndex >= 0) setSelectedGroup(MOVEMENT_GROUPS[matchIndex]);
        })
        .catch((error) => {
          console.error("Failed to resolve exercise tree group:", error);
        });
    return () => {
      isMounted = false;
    };
  }, [requestedGroup, contextExerciseCode, contextExerciseId, exerciseFilter]);

  useEffect(() => {
    let isMounted = true;
    setTreeLoading(true);
    setTreeError("");
    getExerciseTree({
      movementGroup: selectedGroup.toUpperCase(),
      order: "EASY_TO_HARD",
    })
        .then((data) => {
          if (isMounted) setTreeResponse(data);
        })
        .catch((error) => {
          console.error("Failed to load exercise tree:", error);
          if (isMounted) {
            setTreeResponse(null);
            setTreeError("Unable to load live exercise tree. Displaying cached tree layout.");
          }
        })
        .finally(() => {
          if (isMounted) setTreeLoading(false);
        });
    return () => {
      isMounted = false;
    };
  }, [selectedGroup]);

  const groupData = useMemo(() => {
    const fallbackGroup = TREE_DATA[selectedGroup] || TREE_DATA.Push;
    const expectedGroup = selectedGroup.toUpperCase();

    if (!treeResponse || treeResponse.movementGroup !== expectedGroup || !treeResponse.nodes?.length) {
      return fallbackGroup;
    }

    // Stable level-and-ID ordering defines coordinates independently of arrow direction.
    const levelOf = (node) => {
      const parsed = Number.parseInt(String(node.level ?? node.levelNumber ?? ""), 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    };
    const sortedNodes = [...(treeResponse.nodes || [])].sort(
        (first, second) =>
            levelOf(first) - levelOf(second) ||
            String(first.id).localeCompare(String(second.id), undefined, { numeric: true }) ||
            first.name.localeCompare(second.name),
    );
    const nodeIdAliases = new Map();
    const nodeByIdentity = new Map();
    const uniqueNodes = [];
    sortedNodes.forEach((node) => {
      const nameKey = normalizeExerciseName(node.name);
      const codeKey = String(node.code || "").trim().toLowerCase();
      const canonicalId = (codeKey && nodeByIdentity.get(`code:${codeKey}`))
          || nodeByIdentity.get(`name:${nameKey}`);
      if (canonicalId) {
        nodeIdAliases.set(String(node.id), canonicalId);
        if (codeKey) nodeByIdentity.set(`code:${codeKey}`, canonicalId);
        return;
      }

      const id = String(node.id);
      nodeIdAliases.set(id, id);
      nodeByIdentity.set(`name:${nameKey}`, id);
      if (codeKey) nodeByIdentity.set(`code:${codeKey}`, id);
      uniqueNodes.push(node);
    });
    const rowsByLevel = new Map();
    const rowsById = new Map();
    const nodes = uniqueNodes.map((node) => {
      const level = levelOf(node);
      const prerequisiteIds = [...new Set((node.prerequisiteIds || [])
          .map((id) => nodeIdAliases.get(String(id)) || String(id))
          .filter((id) => id !== String(node.id)))];
      const nextExerciseIds = [...new Set((node.nextExerciseIds || [])
          .map((id) => nodeIdAliases.get(String(id)) || String(id))
          .filter((id) => id !== String(node.id)))];
      const occupiedRows = rowsByLevel.get(level) || new Set();
      const parentRows = prerequisiteIds
          .map((id) => rowsById.get(String(id)))
          .filter((row) => row !== undefined);
      let row = parentRows.find((candidate) => !occupiedRows.has(candidate));
      if (row === undefined) {
        row = 0;
        while (occupiedRows.has(row)) row += 1;
      }
      occupiedRows.add(row);
      rowsByLevel.set(level, occupiedRows);
      rowsById.set(String(node.id), row);
      return {
        ...node,
        level: `Lv ${level}`,
        levelNumber: level,
        state: node.state?.toLowerCase(),
        col: Math.max(0, Math.min(4, level - 1)),
        row,
        prerequisiteIds,
        nextExerciseIds,
        muscleGroups: node.targetMuscle ? node.targetMuscle.split(",").map((m) => m.trim()) : [],
      };
    });
    const uniqueNodeById = new Map(nodes.map((node) => [String(node.id), node]));
    nodes.forEach((node) => {
      node.previous = node.prerequisiteIds
          .map((id) => uniqueNodeById.get(String(id))?.name)
          .filter(Boolean);
      node.next = node.nextExerciseIds
          .map((id) => uniqueNodeById.get(String(id))?.name)
          .filter(Boolean);
    });
    return {
      name: selectedGroup,
      nodes,
      legend: treeResponse.legend,
    };
  }, [selectedGroup, treeResponse]);

  const nodeById = useMemo(() => new Map(groupData.nodes.map((node) => [String(node.id), node])), [groupData]);

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

    const normalizedCode = String(contextExerciseCode || "").trim().toLowerCase();
    const byCode = normalizedCode
        ? groupData.nodes.find((node) => String(node.code || "").trim().toLowerCase() === normalizedCode)
        : null;
    if (byCode) return byCode;

    const byId = contextExerciseId
        ? groupData.nodes.find((node) => String(node.id) === contextExerciseId)
        : null;
    if (byId) return byId;
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
  const fallbackExercise = useMemo(() => {
    if (!isSpecificExerciseContext || !groupData.nodes.length) return null;
    const ignoredWords = new Set(["reviewed", "submission", "exercise", "custom", "member"]);
    const searchWords = normalizeExerciseName(exerciseFilter)
        .split(" ")
        .filter((word) => word && !ignoredWords.has(word));
    const nearest = groupData.nodes
        .map((node) => {
          const nodeWords = new Set(normalizeExerciseName(node.name).split(" "));
          const overlap = searchWords.reduce(
              (score, word) => score + (nodeWords.has(word) ? 1 : 0),
              0,
          );
          return { node, overlap };
        })
        .sort((first, second) =>
            second.overlap - first.overlap ||
            (first.node.levelNumber || 1) - (second.node.levelNumber || 1),
        )[0];
    return nearest?.overlap > 0 ? nearest.node : defaultExercise || groupData.nodes[0];
  }, [defaultExercise, exerciseFilter, groupData, isSpecificExerciseContext]);
  const selectedExercise = matchingExercise || (
      isSpecificExerciseContext && requestedExerciseName
          ? {
            ...(navigationExercise || {}),
            id: navigationExercise?.id || contextExerciseId || `context-${normalizeExerciseName(requestedExerciseName).replace(/\s+/g, "-")}`,
            code: navigationExercise?.code || contextExerciseCode,
            name: requestedExerciseName,
            levelNumber: fallbackExercise?.levelNumber || 2,
            level: `Lv ${fallbackExercise?.levelNumber || 2}`,
            difficulty: navigationExercise?.difficulty || fallbackExercise?.difficulty || "Intermediate",
            movementGroup: selectedGroup.toUpperCase(),
            state: "current",
            muscleGroups: String(
                navigationExercise?.targetMuscle ||
                navigationExercise?.muscleGroup ||
                navigationExercise?.muscleGroups?.join?.(", ") ||
                "",
            ).split(",").map((muscle) => muscle.trim()).filter(Boolean),
            prerequisiteIds: fallbackExercise?.prerequisiteIds || [],
            nextExerciseIds: fallbackExercise?.nextExerciseIds || [],
            previous: fallbackExercise?.previous || [],
            next: fallbackExercise?.next || [],
            col: fallbackExercise?.col ?? 1,
            row: Math.max(
                -1,
                ...groupData.nodes
                    .filter((node) => node.col === (fallbackExercise?.col ?? 1))
                    .map((node) => node.row || 0),
            ) + 1,
          }
          : isSpecificExerciseContext ? fallbackExercise : defaultExercise
  );
  const selectedExerciseLabel =
      requestedExerciseName ||
      selectedExercise?.name ||
      exerciseFilter ||
      contextExerciseCode ||
      contextExerciseId;
  const visibleNodes = useMemo(() => {
    if (!isSpecificExerciseContext) return groupData.nodes;
    if (!selectedExercise) return groupData.nodes;

    const nodeById = new Map(groupData.nodes.map((node) => [String(node.id), node]));
    const collectProgression = (startingIds, relation) => {
      const collectedIds = new Set();
      const pendingIds = [...startingIds].map(String);
      while (pendingIds.length > 0) {
        const currentId = pendingIds.pop();
        if (collectedIds.has(currentId)) continue;
        collectedIds.add(currentId);
        const currentNode = nodeById.get(currentId);
        if (currentNode) pendingIds.push(...relation(currentNode).map(String));
      }
      return collectedIds;
    };

    const ancestorIds = collectProgression(
        selectedExercise.prerequisiteIds || [],
        (node) => node.prerequisiteIds || [],
    );
    const descendantIds = collectProgression(
        selectedExercise.nextExerciseIds || [],
        (node) => node.nextExerciseIds || [],
    );
    const progressionIds = new Set([
      String(selectedExercise.id),
      ...ancestorIds,
      ...descendantIds,
    ]);
    const progressionNodes = groupData.nodes.filter((node) => progressionIds.has(String(node.id)));
    if (!nodeById.has(String(selectedExercise.id))) {
      progressionNodes.push(selectedExercise);
      return progressionNodes.map((node) => (
        selectedExercise.prerequisiteIds?.some((id) => String(id) === String(node.id))
            ? {
              ...node,
              nextExerciseIds: [...new Set([...(node.nextExerciseIds || []), String(selectedExercise.id)])],
              next: [...new Set([...(node.next || []), selectedExercise.name])],
            }
            : node
      ));
    }
    return progressionNodes;
  }, [groupData, isSpecificExerciseContext, selectedExercise]);
  const maxRow = Math.max(0, ...visibleNodes.map((node) => node.row || 0));
  const gridHeight = Math.max(1, maxRow + 1) * CARD_HEIGHT + maxRow * GAP_Y;

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => String(node.id))), [visibleNodes]);

  const treeEdges = useMemo(() => {
    const visibleNodeById = new Map(visibleNodes.map((node) => [String(node.id), node]));
    return visibleNodes.flatMap((node) =>
        (node.nextExerciseIds || [])
            .map((nextId) => ({ from: node, to: visibleNodeById.get(String(nextId)) }))
            .filter((edge) => edge.to && visibleNodeIds.has(String(edge.to.id)))
    );
  }, [visibleNodes, visibleNodeIds]);

  const handleNodeClick = (node) => {
    setExerciseFilter(node.name);
    setContextExerciseId(String(node.id));
    setContextExerciseCode(String(node.code || ""));
    setSearchParams({
      group: selectedGroup.toLowerCase(),
      highlight: String(node.code || node.id),
      exerciseId: String(node.id),
      exerciseName: node.name,
    });
  };

  const handleGroupChange = (group) => {
    setSelectedGroup(group);
    setExerciseFilter("");
    setContextExerciseId("");
    setContextExerciseCode("");
    navigate(
        { pathname: location.pathname, search: `?group=${group.toLowerCase()}` },
        { replace: true, state: null },
    );
  };

  const handleViewExercise = () => {
    if (!selectedExercise) return;
    const slug =
        selectedExercise.id ||
        selectedExercise.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    navigate(`/library/exercise/${slug}`);
  };

  // Sorting changes only edge flow; node order and X/Y positions stay fixed.
  const isReverse = direction === "Hard → Easy";

  const getNodeX = (col) => col * (CARD_WIDTH + GAP_X);
  const getNodeY = (row) => row * (CARD_HEIGHT + GAP_Y);
  const getEdgePath = ({ from, to }) => {
    const fromX = getNodeX(from.col);
    const fromY = getNodeY(from.row);
    const toX = getNodeX(to.col);
    const toY = getNodeY(to.row);
    const fromCenterY = fromY + CARD_HEIGHT / 2;
    const toCenterY = toY + CARD_HEIGHT / 2;
    let points;
    if (from.row === to.row) {
      const movesRight = to.col >= from.col;
      points = [
        { x: fromX + (movesRight ? CARD_WIDTH : 0), y: fromCenterY },
        { x: toX + (movesRight ? 0 : CARD_WIDTH), y: toCenterY },
      ];
    } else {
      const movesRight = to.col >= from.col;
      const sourceX = fromX + (movesRight ? CARD_WIDTH : 0);
      const targetX = toX + (movesRight ? 0 : CARD_WIDTH);
      const elbowX = (sourceX + targetX) / 2;
      points = [
        { x: sourceX, y: fromCenterY },
        { x: elbowX, y: fromCenterY },
        { x: elbowX, y: toCenterY },
        { x: targetX, y: toCenterY },
      ];
    }

    if (isReverse) points.reverse();
    return points.map((point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
    ).join(" ");
  };

  return (
      <div className="exercise-tree-page w-full max-w-7xl mx-auto text-white pb-12">
        <style>{`
        .exercise-tree-page button {
          outline: none;
        }
      `}</style>

        {/* 1. HEADER */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Calisthenics Exercise Tree
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse exercises and progression paths for your training.
          </p>
        </header>

        {/* 2. CONTROLS (MOVEMENT GROUP CHIPS & ORDER TOGGLE) */}
        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {isSpecificExerciseContext ? (
              <div className="inline-flex items-center rounded-full border border-[#8068c4] bg-[#2b1d5e] px-4 py-2 text-xs font-medium text-violet-100">
                {selectedExerciseLabel}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Movement group">
                {MOVEMENT_GROUPS.map((group) => (
                  <button
                    key={group}
                    type="button"
                    aria-pressed={selectedGroup === group}
                    onClick={() => handleGroupChange(group)}
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                      selectedGroup === group
                        ? "border-[#9b83ff] bg-[#643bf6] text-white"
                        : "border-[#403464] bg-[#1a1435] text-[#c4b5fd] hover:border-[#8068c4] hover:bg-[#261c4b]"
                    }`}
                  >
                    {group}
                  </button>
                ))}
              </div>
            )}

            {/* Order toggle changes edge direction only; node coordinates remain stable. */}
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

        </div>

        {/* 3. EXERCISE TREE BOX */}
        <section className="rounded-2xl border border-[#382b68] bg-[#171133] p-6 mt-5 relative shadow-2xl overflow-x-auto">
          {treeLoading && <p className="mb-4 text-sm text-slate-400">Loading exercise tree…</p>}
          {treeError && (
              <p role="alert" className="mb-4 rounded-lg border border-amber-900/70 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
                {treeError}
              </p>
          )}
          <div
              className="relative mx-auto grid select-none"
              style={{
                width: `${GRID_WIDTH}px`,
                height: `${gridHeight}px`,
                gridTemplateColumns: `repeat(5, ${CARD_WIDTH}px)`,
                gridTemplateRows: `repeat(${Math.max(1, maxRow + 1)}, ${CARD_HEIGHT}px)`,
                columnGap: `${GAP_X}px`,
                rowGap: `${GAP_Y}px`,
              }}
          >
            {/* SVG Connection Lines & Arrows */}
            <svg
                className="absolute inset-0 z-0 pointer-events-none"
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
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#806bb8" />
                </marker>
              </defs>

              {treeEdges.map((edge) => {
                return (
                    <path
                        key={`${edge.from.id}-${edge.to.id}`}
                        d={getEdgePath(edge)}
                        fill="none"
                        stroke="#806bb8"
                        strokeWidth="2"
                        markerEnd="url(#tree-arrow)"
                    />
                );
              })}
            </svg>

            {/* Exercise Nodes */}
            {visibleNodes.map((node) => {
              const isSelected = String(selectedExercise?.id) === String(node.id);

              const isMastered = node.state === "mastered";
              const isCurrent = node.state === "current";

              return (
                  <div
                      key={node.id}
                      onClick={() => handleNodeClick(node)}
                      style={{
                        gridColumn: node.col + 1,
                        gridRow: node.row + 1,
                        width: `${CARD_WIDTH}px`,
                        height: `${CARD_HEIGHT}px`,
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
                    {node.level}
                  </span>
                    </div>

                    {/* Exercise Name */}
                    <div className="text-xs font-bold text-white text-center tracking-tight leading-snug px-1">
                      {node.name}
                    </div>

                    {/* Difficulty badge */}
                    <div className="flex justify-center">
                  <span
                      className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border capitalize ${getLevelBadgeStyle(node.difficulty)}`}
                  >
                    {node.difficulty}
                  </span>
                    </div>
                  </div>
              );
            })}
          </div>

          {/* Footer Legend */}
          <div className="mt-8 pt-4 border-t border-[#1e173e] flex items-center justify-between flex-wrap gap-4 text-xs select-none">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-sm" />
                <span className="text-slate-300 font-medium">{groupData.legend?.MASTERED || "Mastered"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#643bf6] inline-block shadow-sm" />
                <span className="text-slate-300 font-medium">{groupData.legend?.CURRENT || "Current"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full border border-slate-500 inline-block bg-transparent" />
                <span className="text-slate-300 font-medium">{groupData.legend?.LOCKED || "Locked"}</span>
              </div>
            </div>

            <div className="text-slate-500 italic">
              {isReverse ? "Arrows point to easier exercises" : "Arrows point to harder exercises"}
            </div>
          </div>
        </section>

        {/* 4. EXERCISE DETAILS PANEL */}
        {selectedExercise && (
            <section className="rounded-2xl border border-[#382b68] bg-[#171133] p-5 mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
              <div className="flex flex-col min-w-0">
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

                <p className="text-xs text-slate-300 mt-1.5">
                  Level {selectedExercise.levelNumber || 2} ·{" "}
                  {selectedExercise.difficulty} ·{" "}
                  {(selectedExercise.muscleGroups || []).join(", ")}
                </p>

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