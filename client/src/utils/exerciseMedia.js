const EXERCISE_DEMO_SEARCH_TERMS = {
  "push up": "push up calisthenics proper form exercise demonstration",
  "standard push up": "standard push up calisthenics proper form exercise demonstration",
  "incline push up": "incline push up calisthenics proper form exercise demonstration",
  "diamond push up": "diamond push up calisthenics proper form exercise demonstration",
  "pike push up": "pike push up calisthenics proper form exercise demonstration",
  "decline push up": "decline push up calisthenics proper form exercise demonstration",
  "pseudo planche push up": "pseudo planche push up calisthenics proper form exercise demonstration",
  "handstand push up": "handstand push up calisthenics proper form exercise demonstration",
  dips: "calisthenics dips proper form exercise demonstration",
  "bench dip": "bench dip proper form exercise demonstration",
  "bench dips": "bench dip proper form exercise demonstration",
  "parallel bar dip": "parallel bar dips proper form exercise demonstration",
  "parallel bar dips": "parallel bar dips proper form exercise demonstration",
  "straight bar dip": "straight bar dip calisthenics proper form exercise demonstration",
  "pull up": "pull up calisthenics proper form exercise demonstration",
  "chin up": "chin up calisthenics proper form exercise demonstration",
  "australian row": "australian row bodyweight proper form exercise demonstration",
  "australian pull up": "australian row bodyweight proper form exercise demonstration",
  "ring row": "ring row calisthenics proper form exercise demonstration",
  "muscle up": "muscle up calisthenics proper form exercise demonstration",
  "bodyweight squat": "bodyweight squat proper form exercise demonstration",
  "pistol squat": "pistol squat calisthenics proper form exercise demonstration",
  "bulgarian split squat": "bulgarian split squat proper form exercise demonstration",
  "archer squat": "archer squat calisthenics proper form exercise demonstration",
  plank: "plank exercise proper form demonstration",
  "l sit": "calisthenics L sit proper form exercise demonstration",
  "knee tucks": "knee tucks core exercise proper form demonstration",
  "lying leg raises": "lying leg raises proper form exercise demonstration",
  "knee push up": "knee push up calisthenics proper form exercise demonstration",
  "wide grip push up": "wide grip push up proper form exercise demonstration",
  "walking lunges": "walking lunges proper form exercise demonstration",
  "hanging knee raise": "hanging knee raise proper form exercise demonstration",
  "hollow body hold": "hollow body hold calisthenics proper form exercise demonstration",
  "wall handstand hold": "wall handstand hold calisthenics proper form exercise demonstration",
  "explosive pull up": "explosive pull up calisthenics proper form exercise demonstration",
  "tuck front lever": "tuck front lever calisthenics progression exercise demonstration",
  "advanced tuck front lever": "advanced tuck front lever calisthenics progression exercise demonstration",
  "dead hang": "active dead hang calisthenics proper form exercise demonstration",
  "l sit pull up": "L sit pull up calisthenics exercise demonstration",
  "hanging leg raises": "hanging leg raise calisthenics proper form exercise demonstration",
  "assisted squat": "assisted squat proper form exercise demonstration",
  "full front lever": "full front lever calisthenics progression exercise demonstration",
  "one arm push up": "one arm push up calisthenics progression exercise demonstration",
  "archer push up": "archer push up calisthenics progression exercise demonstration",
  "full plank": "full plank exercise proper form demonstration",
  "dragon flag": "dragon flag calisthenics progression exercise demonstration",
  "human flag": "human flag calisthenics progression exercise demonstration",
};

const EXERCISE_DEMO_VIDEO_IDS = {
  "push up": "IODxDxX7oi4",
  "standard push up": "IODxDxX7oi4",
  "incline push up": "3WJS1E2v930",
  "diamond push up": "J0DnG1_S92I",
  "pike push up": "sposDXIE0zc",
  "decline push up": "IODxDxX7oi4",
  "pseudo planche push up": "sposDXIE0zc",
  "handstand push up": "sposDXIE0zc",
  dips: "2z8JmcrW-As",
  "bench dip": "2z8JmcrW-As",
  "bench dips": "2z8JmcrW-As",
  "parallel bar dip": "2z8JmcrW-As",
  "parallel bar dips": "2z8JmcrW-As",
  "straight bar dip": "2z8JmcrW-As",
  "pull up": "eGo4IYlbE5g",
  "chin up": "eGo4IYlbE5g",
  "australian row": "G2B13P6PAn8",
  "australian pull up": "G2B13P6PAn8",
  "ring row": "G2B13P6PAn8",
  "bodyweight squat": "aclHkVaku9U",
  "pistol squat": "aclHkVaku9U",
  "bulgarian split squat": "aclHkVaku9U",
  "archer squat": "aclHkVaku9U",
  plank: "pSHjTRCQxIw",
  "l sit": "pSHjTRCQxIw",
  "knee tucks": "pSHjTRCQxIw",
  "lying leg raises": "pSHjTRCQxIw",
  "hanging leg raises": "pSHjTRCQxIw",
  "hanging knee raise": "pSHjTRCQxIw",
  "dragon flag": "pSHjTRCQxIw",
  "knee push up": "IODxDxX7oi4",
  "wide grip push up": "IODxDxX7oi4",
  "walking lunges": "aclHkVaku9U",
  "hollow body hold": "pSHjTRCQxIw",
  "explosive pull up": "eGo4IYlbE5g",
  "dead hang": "eGo4IYlbE5g",
  "l sit pull up": "eGo4IYlbE5g",
  "assisted squat": "aclHkVaku9U",
  "one arm push up": "IODxDxX7oi4",
  "archer push up": "IODxDxX7oi4",
  "full plank": "pSHjTRCQxIw",
  "human flag": "pSHjTRCQxIw",
};

const EXERCISE_CODE_VIDEO_IDS = {
  "EX-001": "IODxDxX7oi4",
  "EX-002": "J0DnG1_S92I",
  "EX-003": "IODxDxX7oi4",
  "EX-004": "IODxDxX7oi4",
  "EX-005": "2z8JmcrW-As",
  "EX-006": "3WJS1E2v930",
  "EX-007": "eGo4IYlbE5g",
  "EX-008": "G2B13P6PAn8",
  "EX-009": "eGo4IYlbE5g",
  "EX-010": "aclHkVaku9U",
  "EX-011": "aclHkVaku9U",
  "EX-012": "aclHkVaku9U",
  "EX-013": "pSHjTRCQxIw",
  "EX-014": "pSHjTRCQxIw",
  "EX-015": "pSHjTRCQxIw",
  "EX-016": "sposDXIE0zc",
  "EX-017": "2z8JmcrW-As",
  "EX-018": "2z8JmcrW-As",
  "SK-002": "sposDXIE0zc",
  "SK-003": "eGo4IYlbE5g",
  "SK-004": "2z8JmcrW-As",
};

const FALLBACK_VIDEO_IDS_BY_GROUP = {
  PUSH: "IODxDxX7oi4",
  PULL: "eGo4IYlbE5g",
  LEGS: "aclHkVaku9U",
  CORE: "pSHjTRCQxIw",
};

function normalizeExerciseName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getExerciseDemoSearchUrl(exerciseName) {
  const name = normalizeExerciseName(exerciseName);
  const searchTerms = EXERCISE_DEMO_SEARCH_TERMS[name]
    || `${name} calisthenics exercise demonstration proper form`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerms)}`;
}

function getMappedVideoId(exercise) {
  const code = String(exercise?.code || "").trim().toUpperCase();
  const name = normalizeExerciseName(exercise?.name || exercise?.title);
  const exactNameVideoId = EXERCISE_DEMO_VIDEO_IDS[name];
  if (exactNameVideoId) return exactNameVideoId;
  if (/\b(muscle up|front lever)\b/.test(name)) {
    return EXERCISE_CODE_VIDEO_IDS[code] || null;
  }

  const keywordMappings = [
    [/\bdiamond\b/, "diamond push up"],
    [/\bincline\b/, "incline push up"],
    [/\bpike\b/, "pike push up"],
    [/\b(handstand|pseudo planche)\b/, "handstand push up"],
    [/\b(push up|push-up)\b/, "standard push up"],
    [/\b(dip|dips)\b/, "parallel bar dip"],
    [/\b(australian row|ring row)\b/, "australian row"],
    [/\b(pull up|pull-up|chin up|chin-up|dead hang)\b/, "pull up"],
    [/\b(squat|lunge)\b/, "bodyweight squat"],
    [/\b(plank|l sit|knee tuck|leg raise|dragon flag|hollow body)\b/, "plank"],
  ];
  const mappedName = keywordMappings.find(([pattern]) => pattern.test(name))?.[1];
  return EXERCISE_DEMO_VIDEO_IDS[mappedName] || EXERCISE_CODE_VIDEO_IDS[code] || null;
}

export function getValidVideoUrl(exercise) {
  const explicitVideoUrl = exercise?.videoUrl || exercise?.demoVideoUrl || exercise?.video_url;
  const expectedVideoId = getMappedVideoId(exercise);
  const knownMappedVideoIds = new Set([
    ...Object.values(EXERCISE_DEMO_VIDEO_IDS),
    ...Object.values(EXERCISE_CODE_VIDEO_IDS),
  ]);
  const isMemberExercise =
    exercise?.isSystem === false ||
    String(exercise?.isSystem).toLowerCase() === "false" ||
    exercise?.authorId != null;

  if (explicitVideoUrl) {
    const embedUrl = getYouTubeEmbedUrl(explicitVideoUrl);
    if (embedUrl) {
      const explicitVideoId = new URL(embedUrl).pathname.split("/").filter(Boolean).pop();
      if (
        isMemberExercise ||
        !knownMappedVideoIds.has(explicitVideoId) ||
        explicitVideoId === expectedVideoId
      ) {
        return embedUrl;
      }
    } else {
      if (
        typeof explicitVideoUrl === "string" &&
        !/^[a-z][a-z\d+.-]*:/i.test(explicitVideoUrl) &&
        explicitVideoUrl.trim()
      ) {
        return explicitVideoUrl;
      }
      try {
        const url = new URL(explicitVideoUrl);
        if (["http:", "https:"].includes(url.protocol) && !/youtube(?:-nocookie)?\.com$/i.test(url.hostname)) {
          return url.href;
        }
      } catch {
        // Invalid stored media URLs fall through to the name-based mapping.
      }
    }
  }

  const fallbackVideoId =
    expectedVideoId || FALLBACK_VIDEO_IDS_BY_GROUP[getExerciseMovementGroup(exercise)];
  return `https://www.youtube.com/embed/${fallbackVideoId}`;
}

export function getExerciseDemoVideoUrl(exercise) {
  return getValidVideoUrl(exercise);
}

export function getYouTubeEmbedUrl(videoUrl) {
  if (!videoUrl || typeof videoUrl !== "string") return null;
  try {
    const url = new URL(videoUrl);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    let videoId = "";
    if (host === "youtu.be") {
      videoId = url.pathname.slice(1).split("/")[0];
    } else if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      const pathParts = url.pathname.split("/").filter(Boolean);
      if (url.pathname === "/watch") videoId = url.searchParams.get("v") || "";
      else if (["embed", "shorts", "live"].includes(pathParts[0])) videoId = pathParts[1] || "";
    }
    return /^[\w-]{11}$/.test(videoId)
      ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&autoplay=1&mute=1`
      : null;
  } catch {
    return null;
  }
}

export function getExerciseMovementGroup(exercise) {
  const explicitGroup = String(exercise?.movementGroup || exercise?.movement_group || "").toUpperCase();
  if (["PUSH", "PULL", "LEGS", "CORE"].includes(explicitGroup)) return explicitGroup;

  const name = normalizeExerciseName(exercise?.name || exercise?.title);
  if (/\b(pull|row|lever|muscle up|chin up|ring row)\b/.test(name)) return "PULL";
  if (/\b(plank|hollow|sit|flag|abs|core|leg raise|knee tuck|knee raise)\b/.test(name)) return "CORE";
  if (/\b(squat|lunge|calf|leg|nordic|pistol)\b/.test(name)) return "LEGS";
  if (/\bhang\b/.test(name)) return "PULL";
  if (/\b(push|dip|press|planche|handstand)\b/.test(name)) return "PUSH";

  const muscles = normalizeExerciseName([
    exercise?.targetMuscle,
    exercise?.muscleGroup,
    exercise?.muscle_group,
    exercise?.primaryMuscle,
    exercise?.primaryMuscles,
    exercise?.muscleGroups,
  ].flat().join(" "));
  if (/\b(core|abdominal|abs|oblique)\b/.test(muscles)) return "CORE";
  if (/\b(leg|legs|quadricep|hamstring|calf|glute)\b/.test(muscles)) return "LEGS";
  if (/\b(back|lat|bicep|forearm)\b/.test(muscles)) return "PULL";
  return "PUSH";
}
