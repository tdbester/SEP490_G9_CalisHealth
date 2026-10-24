import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getExerciseDetail, getSystemExerciseDetail } from "../api/library";

// Default detailed guide data matching Figma mockup 100%
const EXERCISE_CATALOG = {
  "diamond-push-up": {
    id: 999,
    name: "Diamond push-up",
    level: "Intermediate",
    description:
      "A push-up variation where your hands form a diamond under the chest. It shifts more of the load onto the triceps and inner chest, and is a solid stepping stone toward archer and one-arm push-ups.",
    duration: 84, // 1:24 in seconds
    initialTime: 25, // 0:25 in mockup
    steps: [
      {
        step: 1,
        title: "Set your hands",
        content:
          "Place your hands together under your chest, thumbs and index fingers touching to form a diamond shape.",
      },
      {
        step: 2,
        title: "Align your body",
        content:
          "Extend your legs back and squeeze your glutes. Keep one straight line from head to heels.",
      },
      {
        step: 3,
        title: "Lower with control",
        content:
          "Bend your elbows close to your ribs and lower your chest toward your hands in about two seconds.",
      },
      {
        step: 4,
        title: "Push back up",
        content:
          "Press through your palms until your arms are fully extended, without locking out hard.",
      },
      {
        step: 5,
        title: "Breathe and repeat",
        content:
          "Inhale on the way down, exhale on the way up. Aim for 3 sets of 8 reps.",
      },
    ],
  },
  "wall-handstand-hold": {
    id: 201,
    name: "Wall handstand hold",
    level: "Beginner",
    description:
      "Essential inverted balance drill establishing wrist mobility, shoulder flexion strength, and hollow body alignment against the wall.",
    duration: 90,
    initialTime: 20,
    steps: [
      {
        step: 1,
        title: "Kick-up position",
        content:
          "Place hands 15-20cm away from the wall, fingers spread wide and gripping the floor.",
      },
      {
        step: 2,
        title: "Elevate shoulders",
        content:
          "Kick one leg up followed by the second, resting heels gently against the wall surface.",
      },
      {
        step: 3,
        title: "Push tall",
        content:
          "Actively push through palms, shrugging shoulders up toward ears to open shoulder angles completely.",
      },
      {
        step: 4,
        title: "Hollow posture",
        content:
          "Tuck pelvis and squeeze glutes so your lower back does not arch into the wall.",
      },
      {
        step: 5,
        title: "Breathe and hold",
        content:
          "Maintain steady deep diaphragmatic breathing. Aim for 4 sets of 30 seconds.",
      },
    ],
  },
  "handstand-push-up": {
    id: 202,
    name: "Handstand push-up",
    level: "Advanced",
    description:
      "Elite vertical pressing calisthenic skill lifting 100% of body mass overhead with supreme shoulder and tricep power.",
    duration: 75,
    initialTime: 15,
    steps: [
      {
        step: 1,
        title: "Establish stable handstand",
        content:
          "Kick up into a rigid handstand against the wall with core braced and glutes engaged.",
      },
      {
        step: 2,
        title: "Tripod trajectory",
        content:
          "Lower yourself diagonally forward so your head touches floor slightly in front of your hands.",
      },
      {
        step: 3,
        title: "Elbow path",
        content:
          "Ensure elbows track backward at roughly 45 degrees rather than flaring out laterally.",
      },
      {
        step: 4,
        title: "Press to lockout",
        content:
          "Drive palms hard into the floor, pushing head back through shoulders at peak lockout.",
      },
      {
        step: 5,
        title: "Cadence & reps",
        content:
          "Lower under full control for 2 seconds, press up explosively. Perform 3 sets of 5 reps.",
      },
    ],
  },
  "explosive-pull-up": {
    id: 203,
    name: "Explosive pull-up",
    level: "Intermediate",
    description:
      "Explosive pulling variation building the vertical velocity and power required for muscle-up transitions.",
    duration: 70,
    initialTime: 20,
    steps: [
      {
        step: 1,
        title: "Grip and hollow body",
        content: "Grip pull-up bar slightly wider than shoulder width with active hollow body tension.",
      },
      {
        step: 2,
        title: "Explosive hip drive",
        content: "Initiate pull violently by pulling elbows downward and backward toward hips.",
      },
      {
        step: 3,
        title: "Chest to bar",
        content: "Accelerate through the middle phase aiming to touch sternum to the bar.",
      },
      {
        step: 4,
        title: "Fast return",
        content: "Lower under control back to active hang without disengaging scapulae.",
      },
      {
        step: 5,
        title: "Power sets",
        content: "Keep repetitions low (3–5 reps per set) to prioritize maximal velocity.",
      },
    ],
  },
  "straight-bar-dip": {
    id: 204,
    name: "Straight bar dip",
    level: "Intermediate",
    description:
      "Essential transitional dipping strength exercise developing chest and tricep pressing power directly above the straight bar.",
    duration: 75,
    initialTime: 22,
    steps: [
      {
        step: 1,
        title: "Top support",
        content: "Lock out arms above the straight bar with shoulders depressed and legs angled slightly forward.",
      },
      {
        step: 2,
        title: "Forward lean",
        content: "Lean chest over the bar to balance center of gravity as you descend.",
      },
      {
        step: 3,
        title: "Deep descent",
        content: "Bend elbows backward until your lower chest touches the bar.",
      },
      {
        step: 4,
        title: "Press to lockout",
        content: "Drive palms hard through the bar, pressing back up to full elbow extension.",
      },
      {
        step: 5,
        title: "Sets and cadence",
        content: "Aim for 3 sets of 8 strict repetitions with no leg kicking.",
      },
    ],
  },
  "jumping-jacks": {
    id: 101,
    name: "Jumping jacks",
    level: "Beginner",
    description:
      "Classic rhythmic cardiovascular warm-up drill activating the entire kinetic chain while increasing blood circulation and dynamic shoulder mobility.",
    duration: 60,
    initialTime: 15,
    steps: [
      {
        step: 1,
        title: "Starting posture",
        content: "Stand upright with feet together and arms resting comfortably at your sides.",
      },
      {
        step: 2,
        title: "Explosive jump",
        content: "Bend knees slightly and jump upward, spreading feet outward shoulder-width or wider.",
      },
      {
        step: 3,
        title: "Sweep arms overhead",
        content: "Simultaneously sweep both arms outward and upward until palms almost meet above head.",
      },
      {
        step: 4,
        title: "Soft landing",
        content: "Spring softly on the balls of your feet and return immediately to the start position.",
      },
      {
        step: 5,
        title: "Pacing & rhythm",
        content: "Maintain continuous smooth breathing. Aim for 3 sets of 30-45 seconds.",
      },
    ],
  },
  "push-up": {
    id: 104,
    name: "Push-up",
    level: "Beginner",
    description:
      "The foundational horizontal pushing exercise building upper chest, shoulders, and triceps while establishing rigid core anti-extension stability.",
    duration: 65,
    initialTime: 20,
    steps: [
      {
        step: 1,
        title: "Hand placement",
        content: "Place hands slightly wider than shoulder-width, fingers pointing straight forward.",
      },
      {
        step: 2,
        title: "Core bracing",
        content: "Lock your core, glutes, and quadriceps to form a rigid plank from neck to heels.",
      },
      {
        step: 3,
        title: "Controlled descent",
        content: "Tuck elbows at 45 degrees and lower yourself under control until chest nearly touches floor.",
      },
      {
        step: 4,
        title: "Drive and lock",
        content: "Exhale forcefully and push the floor away to return to full elbow lock.",
      },
      {
        step: 5,
        title: "Target volume",
        content: "Perform 3 sets of 8–12 clean repetitions with zero lower back sagging.",
      },
    ],
  },
  "pull-up": {
    id: 105,
    name: "Pull-up",
    level: "Intermediate",
    description:
      "The cornerstone calisthenics vertical pull activating latissimus dorsi, biceps brachii, rhomboids, and core musculature.",
    duration: 70,
    initialTime: 18,
    steps: [
      {
        step: 1,
        title: "Grip the bar",
        content: "Grasp the pull-up bar with an overhand grip slightly wider than your shoulders.",
      },
      {
        step: 2,
        title: "Active hang",
        content: "Engage shoulders by depressing scapulae down and away from your ears.",
      },
      {
        step: 3,
        title: "Explosive pull",
        content: "Drive elbows down toward your hips and pull your chest upward until chin clears the bar.",
      },
      {
        step: 4,
        title: "Smooth descent",
        content: "Lower your body smoothly under tension over 2-3 seconds back to active dead hang.",
      },
      {
        step: 5,
        title: "Volume goal",
        content: "Execute 3 sets of 5–8 strict reps without swinging or kicking.",
      },
    ],
  },
};

// Helper format seconds -> mm:ss
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export default function ExerciseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isMemberExercise =
    location.pathname.startsWith("/library/community/") ||
    location.pathname.startsWith("/library/member/");
  const isSystemExercise = location.pathname.startsWith("/library/exercise/");
  const memberAuthor = location.state?.author || "Linh Tran";
  const memberPostedTime = location.state?.postedTime || "3 days ago";

  // Normalize slug / ID to find matching catalog item
  const slug = (id || "diamond-push-up").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const catalogItem =
    EXERCISE_CATALOG[slug] ||
    Object.values(EXERCISE_CATALOG).find(
      (item) => String(item.id) === id || item.name.toLowerCase() === slug.replace(/-/g, " ")
    ) ||
    EXERCISE_CATALOG["diamond-push-up"];

  const [exercise, setExercise] = useState(catalogItem);
  const displayedMemberAuthor = exercise.authorName || memberAuthor;
  const displayedMemberPostedTime = exercise.postedTimeAgo || memberPostedTime;

  // Video player state
  const [videoDuration, setVideoDuration] = useState(null);
  const totalDuration = videoDuration || exercise.duration || 84;
  const [currentTime, setCurrentTime] = useState(exercise.initialTime ?? 25);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const playerRef = useRef(null);
  const videoRef = useRef(null);

  // Sync document title to match mockup window header: CalisHealth - [Exercise name]
  useEffect(() => {
    document.title = `CalisHealth - ${exercise.name}`;
    return () => {
      document.title = "CalisHealth";
    };
  }, [exercise.name]);

  // Fetch from API if exists, or fall back seamlessly
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!id) return;
      try {
        const data = isSystemExercise
          ? await getSystemExerciseDetail(id)
          : await getExerciseDetail(id);
        if (data && isMounted) {
          setExercise((prev) => ({
            ...prev,
            ...(isSystemExercise
              ? {
                  ...data,
                  name: data.title || prev.name,
                  steps: (data.guideSteps || []).map((content, index) => ({
                    step: index + 1,
                    title: `Step ${index + 1}`,
                    content,
                  })),
                }
              : {
                  ...data,
                  name: data.title || data.name || prev.name,
                  videoUrl: data.videoUrl || data.demoVideoUrl,
                  steps: (data.guideSteps || []).map((content, index) => ({
                    step: index + 1,
                    title: `Step ${index + 1}`,
                    content,
                  })),
                }),
            name: data.title || data.name || prev.name,
            level: data.level || prev.level,
            description: data.description || prev.description,
          }));
        }
      } catch (error) {
        console.error("Failed to fetch exercise details:", error);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [id, isSystemExercise]);

  // Simulated player timer
  useEffect(() => {
    if (exercise.videoUrl) return undefined;
    let timer = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalDuration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, totalDuration, exercise.videoUrl]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch((error) => {
          console.error("Failed to play exercise video:", error);
        });
      } else {
        videoRef.current.pause();
      }
      return;
    }
    setIsPlaying((prev) => !prev);
  };

  const toggleMute = () => {
    setIsMuted((prev) => {
      if (videoRef.current) videoRef.current.muted = !prev;
      return !prev;
    });
  };

  const toggleFullscreen = () => {
    if (!playerRef.current) return;
    if (!document.fullscreenElement) {
      playerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const time = Math.floor(pct * totalDuration);
    if (videoRef.current) videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const progressPercent = Math.min(100, Math.max(0, (currentTime / totalDuration) * 100));

  // Badge level color tokens
  const lvl = exercise.level?.toLowerCase();
  const isBeginner = lvl === "beginner";
  const isAdvanced = lvl === "advanced";

  return (
    <div className="exercise-detail-page w-full max-w-6xl mx-auto text-white pb-10">
      {/* Explicit style reset to prevent any browser default button styles (buttonface/white box) */}
      <style>{`
        .exercise-detail-page button {
          background-color: transparent !important;
          border: none !important;
          box-shadow: none !important;
          outline: none !important;
        }
        .exercise-detail-page button.center-play-btn {
          background-color: #643bf6 !important;
          border-radius: 9999px !important;
          box-shadow: 0 10px 25px -5px rgba(91, 50, 232, 0.5) !important;
        }
        .exercise-detail-page button.center-play-btn:hover {
          background-color: #522cd9 !important;
        }
        .exercise-detail-page button.exercise-tree-btn {
          background-color: #643bf6 !important;
          border-radius: 12px !important;
        }
        .exercise-detail-page button.exercise-tree-btn:hover {
          background-color: #522cd9 !important;
        }
      `}</style>

      {/* 1. TOPBAR & NÚT QUAY LẠI */}
      <div className="mb-4">
        {/* Nút quay lại: < Back to list (dạng text link tối giản, không nền, không viền) */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="bg-transparent border-0 p-0 text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer mb-3 group outline-none"
          aria-label="Back to exercise list"
        >
          <svg
            className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform"
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
          <span>Back to list</span>
        </button>

        {/* Hàng tiêu đề bài tập & Badge level đầm rõ */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3.5 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                {exercise.name}
              </h1>
              <span
                className={`px-4 py-1.5 text-xs font-semibold rounded-full border capitalize ${
                  isBeginner
                    ? "border-emerald-800/80 bg-emerald-950/40 text-emerald-400"
                    : isAdvanced
                    ? "border-rose-800/80 bg-rose-950/40 text-rose-400"
                    : "border-amber-800/80 bg-amber-950/40 text-amber-400"
                }`}
              >
                {exercise.level || "Intermediate"}
              </span>
            </div>
            {isMemberExercise && (
              <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#643bf6] text-[9px] font-semibold text-white">
                  {displayedMemberAuthor
                    .split(/\s+/)
                    .map((namePart) => namePart[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <span>
                  Shared by <strong className="font-semibold text-slate-200">{displayedMemberAuthor}</strong>
                  {" · "}{displayedMemberPostedTime}
                </span>
              </p>
            )}
          </div>
          {!isMemberExercise && (!isSystemExercise || exercise.hasExerciseTree) && (
            <button
              type="button"
              onClick={() => navigate(`/explore?path=${exercise.movementGroup.toLowerCase()}`)}
              className="exercise-tree-btn shrink-0 px-7 py-3 text-sm font-semibold text-white transition-colors"
            >
              Exercise tree
            </button>
          )}
        </div>
      </div>

      {/* 2. BỐ CỤC CHÍNH 2 CỘT (CỘT TRÁI ~62% / CỘT PHẢI ~38%) */}
      <div className="flex flex-col lg:flex-row items-start gap-6 mt-6 w-full">
        {/* CỘT BÊN TRÁI: VIDEO DEMO & DESCRIPTION */}
        <div className="w-full lg:w-[62%] flex-shrink-0 min-w-0">
          {/* KHỐI 1 - VIDEO DEMO */}
          <section className="rounded-2xl border border-[#231b46] bg-[#120d29] p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-white mb-3">Video demo</h2>

            {/* Khung Video Player 16:9 */}
            <div
              ref={playerRef}
              className="aspect-video w-full rounded-xl overflow-hidden relative border border-[#1e173e] select-none flex flex-col justify-between group"
              style={{
                background: "radial-gradient(circle at center, #1e1548 0%, #0d0924 70%, #080518 100%)",
              }}
            >
              {exercise.videoUrl && (
                <video
                  ref={videoRef}
                  src={exercise.videoUrl}
                  className="absolute inset-0 h-full w-full object-contain"
                  muted={isMuted}
                  onLoadedMetadata={(event) => {
                    setVideoDuration(event.currentTarget.duration);
                    setCurrentTime(0);
                  }}
                  onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />
              )}
              {/* Overlay decor pattern */}
              <div className="absolute inset-0 bg-gradient-to-tr from-[#1b1244]/40 to-transparent pointer-events-none" />

              {/* Top spacer */}
              <div className="w-full h-8 z-10" />

              {/* Nút Play tròn to chính giữa: h-16 w-16 bg-[#643bf6] */}
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <button
                  type="button"
                  onClick={togglePlay}
                  className={`center-play-btn h-16 w-16 rounded-full bg-[#643bf6] hover:bg-[#522cd9] text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 border-0 outline-none pointer-events-auto cursor-pointer ${
                    isPlaying ? "opacity-0 group-hover:opacity-80" : "opacity-100"
                  }`}
                  aria-label={isPlaying ? "Pause video" : "Play video"}
                >
                  {isPlaying ? (
                    <svg className="w-7 h-7 fill-white" viewBox="0 0 24 24">
                      <rect x="6" y="5" width="4" height="14" rx="1" />
                      <rect x="14" y="5" width="4" height="14" rx="1" />
                    </svg>
                  ) : (
                    <svg className="w-7 h-7 fill-white ml-0.5" viewBox="0 0 24 24">
                      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l11-6.86a1 1 0 0 0 0-1.68l-11-6.86A1 1 0 0 0 8 5.14z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Thanh điều khiển video ở đáy: Các nút trong suốt không viền */}
              <div className="w-full px-4 py-2.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center gap-3 z-10">
                {/* Nút Play/Pause nhỏ */}
                <button
                  type="button"
                  onClick={togglePlay}
                  className="bg-transparent border-0 text-slate-300 hover:text-white p-1 flex items-center justify-center cursor-pointer outline-none shadow-none flex-shrink-0"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                      <rect x="6" y="5" width="4" height="14" rx="1" />
                      <rect x="14" y="5" width="4" height="14" rx="1" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 fill-white ml-0.5" viewBox="0 0 24 24">
                      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l11-6.86a1 1 0 0 0 0-1.68l-11-6.86A1 1 0 0 0 8 5.14z" />
                    </svg>
                  )}
                </button>

                {/* Thanh tiến trình màu tím sáng có nút kéo trắng */}
                <div
                  className="flex-1 h-1 bg-[#281f50] rounded-full relative cursor-pointer group/slider flex items-center"
                  onClick={handleSeek}
                  role="progressbar"
                  aria-valuenow={currentTime}
                  aria-valuemin="0"
                  aria-valuemax={totalDuration}
                >
                  <div
                    className="h-full bg-[#5b32e8] rounded-full relative transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                  <div
                    className="absolute top-1/2 w-3 h-3 bg-white rounded-full shadow-md pointer-events-none"
                    style={{
                      left: `${progressPercent}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                </div>

                {/* Thời gian hiển thị dạng "0:25 / 1:24" */}
                <div className="text-xs text-slate-400 font-mono flex-shrink-0 select-none">
                  {formatTime(currentTime)} / {formatTime(totalDuration)}
                </div>

                {/* Nút âm lượng */}
                <button
                  type="button"
                  onClick={toggleMute}
                  className="bg-transparent border-0 text-slate-300 hover:text-white p-1 flex items-center justify-center cursor-pointer outline-none shadow-none flex-shrink-0"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  )}
                </button>

                {/* Nút toàn màn hình (fullscreen) */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="bg-transparent border-0 text-slate-300 hover:text-white p-1 flex items-center justify-center cursor-pointer outline-none shadow-none flex-shrink-0"
                  aria-label="Toggle Fullscreen"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                </button>
              </div>
            </div>
          </section>

          {/* KHỐI 2 - DESCRIPTION (NẰM NGAY DƯỚI VIDEO) */}
          <section className="rounded-2xl border border-[#231b46] bg-[#120d29] p-5 mt-4 shadow-xl">
            <h2 className="text-sm font-semibold text-white mb-2">Description</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              {exercise.description}
            </p>
          </section>
        </div>

        {/* CỘT BÊN PHẢI: GUIDE - HƯỚNG DẪN CÁC BƯỚC */}
        <div className="w-full lg:flex-1 min-w-0">
          <section className="rounded-2xl border border-[#231b46] bg-[#120d29] p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-white mb-4">Guide</h2>

            {/* Stepper dạng Timeline dọc (5 bước) */}
            <div className="flex flex-col">
              {(exercise.steps || []).map((stepItem, idx) => {
                const isLast = idx === (exercise.steps || []).length - 1;
                return (
                  <div
                    key={stepItem.step || idx}
                    className={`relative flex items-start gap-3.5 ${!isLast ? "pb-5" : ""}`}
                  >
                    {!isLast && (
                      <div className="absolute left-[13px] top-7 bottom-0 w-px bg-[#2a2055]" />
                    )}
                    <div className="relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[#5b32e8] bg-[#201748] text-xs font-bold text-[#a855f7] shadow-sm">
                      {stepItem.step}
                    </div>

                    <div className="min-w-0 flex-1 -mt-2.5">
                      <h3 className="text-sm font-semibold text-white tracking-tight">
                        {stepItem.title}
                      </h3>
                      <p className="text-xs text-slate-300 leading-relaxed mt-1">
                        {stepItem.content}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
