import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  deletePersonalExercise,
  getPersonalExerciseCounts,
  getPersonalExercises,
} from "../api/library";
import useUndoDelete from "../hooks/useUndoDelete";

/* -------------------- ICONS -------------------- */
function BarbellIcon({ className = "h-5 w-5 text-[#9d7aff]" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 7v10" />
      <path d="M18 7v10" />
      <path d="M3 10v4" />
      <path d="M21 10v4" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  );
}
function SearchIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
    </svg>
  );
}
function ChevronDownIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
    </svg>
  );
}
function GearIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}
function CheckCircleIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  );
}
function XCircleIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
    </svg>
  );
}

/* -------------------- LEVEL BADGE -------------------- */
function LevelBadge({ level }) {
  const map = {
    Beginner: "border-emerald-600/70 bg-emerald-950/70 text-emerald-300",
    Intermediate: "border-amber-600/70 bg-amber-950/70 text-amber-300",
    Advanced: "border-rose-600/70 bg-rose-950/70 text-rose-300",
  };
  const cls = map[level] || map["Intermediate"];
  return (
    <span className={`px-3 py-1 text-xs font-bold rounded-full border capitalize ${cls}`}>{level}</span>
  );
}

/* -------------------- MOCK DATA -------------------- */
const INITIAL_PENDING = [
  {
    id: "pend-1",
    slug: "diamond-push-up",
    title: "Diamond push-up",
    level: "Intermediate",
    meta: "Chest, triceps · 3 sets · 8 reps · Submitted today, 09:12",
    scanText: "Scanning video with MediaPipe...",
    status: "pending",
  },
  {
    id: "pend-2",
    slug: "archer-pull-up",
    title: "Archer pull-up",
    level: "Advanced",
    meta: "Back, biceps · 3 sets · 5 reps per side · Submitted today, 08:40",
    scanText: "Checking text for inappropriate words...",
    status: "pending",
  },
  {
    id: "pend-3",
    slug: "incline-plank-hold",
    title: "Incline plank hold",
    level: "Beginner",
    meta: "Core · 3 sets · 40 sec · Submitted yesterday, 21:05",
    scanText: "Waiting in the scan queue",
    status: "pending",
  },
];
const INITIAL_REJECTED = [
  {
    id: 999,
    slug: "test-rejected-push-up",
    title: "Test Rejected Push-up",
    level: "Intermediate",
    targetMuscle: "Chest",
    defaultSets: 3,
    defaultReps: 10,
    defaultDuration: null,
    meta: "Chest · 3 sets · 10 reps · Submitted 10:00:00 27/10/2026",
    reason: "Video demo không rõ động tác, vui lòng quay lại.",
    description: "Mock exercise for testing the rejected edit and resubmit flow.",
    guideSteps: ["Start in a push-up position", "Lower your chest with control", "Push back to the starting position"],
    video: { name: "test-rejected-push-up.mp4", size: "Mock video" },
    videoUrl: "mock://test-rejected-push-up.mp4",
    status: "REJECTED",
    isMock: true,
  },
  {
    id: "rej-1",
    slug: "wall-sit-challenge",
    title: "Wall sit challenge",
    level: "Beginner",
    meta: "Legs · 3 sets · 60 sec · Rejected 15 Oct",
    reason: "Reason: Text check: the description contains inappropriate wording (\"stupid\"). Edit the description and submit again.",
    description: "A stupid simple wall sit to build leg endurance.",
    guide: ["Find a wall and lean your back against it", "Slide down until your knees are bent", "Hold position for 60 seconds"],
    video: { name: "wall-sit.mp4", size: "8.2 MB" },
    status: "rejected",
  },
  {
    id: "rej-2",
    slug: "l-sit-on-parallettes",
    title: "L-sit on parallettes",
    level: "Intermediate",
    meta: "Core, triceps · 4 sets · 15 sec · Rejected 12 Oct",
    reason: "Reason: Video check: we could not detect a full body in most frames. Re-record in better light with your whole body in frame.",
    description: "",
    guide: [],
    video: { name: "l-sit.mp4", size: "10.4 MB" },
    status: "rejected",
  },
];
const MOCK_PENDING_STORAGE_KEY = "calishealth.mock-resubmitted-exercise";

const getMockPendingExercise = () => {
  try {
    const storedExercise = sessionStorage.getItem(MOCK_PENDING_STORAGE_KEY);
    return storedExercise ? JSON.parse(storedExercise) : null;
  } catch (error) {
    console.warn("Could not read temporary mock exercise state:", error);
    return null;
  }
};
const INITIAL_ACCEPTED = [
  {
    id: "acc-1",
    slug: "pike-push-up",
    title: "Pike push-up",
    level: "Intermediate",
    meta: "Shoulders, triceps · 3 sets · 8 reps · Accepted 14 Oct",
    status: "accepted",
  },
  {
    id: "acc-2",
    slug: "australian-row",
    title: "Australian row",
    level: "Beginner",
    meta: "Back, biceps · 3 sets · 10 reps · Accepted 10 Oct",
    status: "accepted",
  },
  {
    id: "acc-3",
    slug: "pseudo-planche-push-up",
    title: "Pseudo planche push-up",
    level: "Advanced",
    meta: "Shoulders, chest · 4 sets · 6 reps · Accepted 03 Oct",
    status: "accepted",
  },
  {
    id: "acc-4",
    slug: "bodyweight-squat",
    title: "Bodyweight squat",
    level: "Beginner",
    meta: "Legs, glutes · 3 sets · 15 reps · Accepted 26 Sep",
    status: "accepted",
  },
];

/* -------------------- CARD COMPONENT -------------------- */
function ExerciseCard({ item, activeTab, onCancelPending, onDeleteRejected, onDeleteAccepted, navigate }) {
  const openDetail = () => navigate(`/library/community/${item.slug || item.id}`);
  const handleCardKeyDown = (event) => {
    if (activeTab === "accepted" && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openDetail();
    }
  };

  return (
    <div
      onClick={activeTab === "accepted" ? openDetail : undefined}
      onKeyDown={handleCardKeyDown}
      role={activeTab === "accepted" ? "link" : undefined}
      tabIndex={activeTab === "accepted" ? 0 : undefined}
      className={`rounded-2xl border border-[#33285f] bg-[#15102e] hover:border-[#6046a6] hover:shadow-lg hover:shadow-purple-950/20 transition-all shadow-sm ${
        activeTab === "accepted" ? "cursor-pointer hover:border-[#523d8c]" : ""
      }`}
    >
      <div className="flex items-start gap-4 p-5">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-[#2a2057] border border-[#5b4696] flex items-center justify-center flex-shrink-0">
            <BarbellIcon className="h-7 w-7 text-[#c4b5fd]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold text-white tracking-tight">{item.title}</h3>
              <LevelBadge level={item.level} />
            </div>
            <p className="text-sm text-slate-200 mt-1">{item.meta}</p>
            {activeTab === "pending" && item.scanText && (
              <p className="text-[13px] text-slate-200 italic mt-3">{item.scanText}</p>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end justify-start gap-2">
          {activeTab === "pending" && (
            <>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/50 text-amber-400 border border-amber-800/60 text-xs font-semibold">
                <GearIcon className="w-4 h-4" /> Pending
              </span>
              <button
                type="button"
                onClick={() => onCancelPending(item)}
                className="mt-6 px-4 py-1.5 rounded-xl border border-[#44366f] bg-[#1a1435] text-xs font-medium text-slate-300 hover:border-rose-500 hover:text-rose-400 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </>
          )}
          {activeTab === "rejected" && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-rose-200 bg-rose-950/70 border border-rose-600/70">
              <XCircleIcon className="w-4 h-4" /> Rejected
            </span>
          )}
          {activeTab === "accepted" && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-emerald-200 bg-emerald-950/70 border border-emerald-600/70">
              <CheckCircleIcon className="w-4 h-4" /> Accepted
            </span>
          )}
        </div>
      </div>
      {activeTab === "rejected" && item.reason && (
        <div className="mx-5 mb-4 rounded-xl border border-rose-900/50 bg-[#21101a] p-4">
          <p className="text-[13px] text-rose-100/90 leading-relaxed">{item.reason}</p>
        </div>
      )}
      {activeTab !== "pending" && (
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[#29204d]">
        {activeTab === "rejected" && (
          <>
            <button type="button" onClick={(event) => { event.stopPropagation(); onDeleteRejected(item); }} className="rounded-xl border border-[#59477f] bg-[#201a3b] hover:bg-[#30245b] text-slate-100 text-sm font-semibold px-5 py-2.5 transition-colors active:scale-95">
              Delete
            </button>
            <button type="button" onClick={(event) => { event.stopPropagation(); navigate(`/library/personal/${item.id}/edit`, { state: { exercise: item } }); }} className="rounded-xl border border-[#8065ff] bg-[#643bf6] hover:bg-[#7554ff] text-white text-sm font-semibold px-5 py-2.5 transition-colors active:scale-95">
              Edit &amp; resubmit
            </button>
          </>
        )}
        {activeTab === "accepted" && (
          <>
            <button type="button" onClick={(event) => { event.stopPropagation(); onDeleteAccepted(item); }} className="rounded-xl border border-[#59477f] bg-[#201a3b] hover:bg-[#30245b] text-slate-100 text-sm font-semibold px-5 py-2.5 transition-colors active:scale-95">
              Delete
            </button>
            <button type="button" onClick={(event) => { event.stopPropagation(); navigate(`/library/personal/${item.id}/edit`, { state: { exercise: item } }); }} className="rounded-xl border border-[#8065ff] bg-[#643bf6] hover:bg-[#7554ff] text-white text-sm font-semibold px-5 py-2.5 transition-colors active:scale-95">
              Edit
            </button>
          </>
        )}
        </div>
      )}
    </div>
  );
}

/* -------------------- MAIN PAGE -------------------- */
export default function MyExerciseListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { requestDelete, confirmationModal } = useUndoDelete();

  useEffect(() => { document.title = "CalisHealth - Library"; return () => { document.title = "CalisHealth"; }; }, []);

  const paramStatus = searchParams.get("status")?.toLowerCase();
  const [activeTab, setActiveTab] = useState([
    "pending",
    "rejected",
    "accepted",
  ].includes(paramStatus) ? paramStatus : "pending");

  useEffect(() => {
    const s = searchParams.get("status")?.toLowerCase();
    if (["pending", "rejected", "accepted"].includes(s) && s !== activeTab) setActiveTab(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [searchInput, setSearchInput] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("All levels");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 3;
  const [exercises, setExercises] = useState([]);
  const [statusCounts, setStatusCounts] = useState({ pending: 0, rejected: 0, accepted: 0 });
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    const toQuery = (status, page, size, includeFilters) => ({
      status: status.toUpperCase(),
      page,
      size,
      ...(includeFilters && {
        search: searchInput.trim() || undefined,
        level: selectedLevel === "All levels" ? undefined : selectedLevel.toUpperCase(),
      }),
    });
    Promise.all([
      getPersonalExercises(toQuery(activeTab, currentPage - 1, pageSize, true)),
      getPersonalExerciseCounts(),
    ])
      .then(([pageData, counts]) => {
        if (!active) return;
        const items = (pageData?.content || []).map((item) => {
          const repetitions = item.defaultDuration != null
            ? `${item.defaultDuration} sec`
            : item.defaultReps != null
              ? `${item.defaultReps} reps`
              : "Not specified";
          const status = (item.status || activeTab).toLowerCase();
          return {
            ...item,
            slug: item.id,
            level: item.level || "Intermediate",
            meta: `${item.targetMuscle || "Full body"} · ${item.defaultSets ?? 3} sets · ${repetitions} · Submitted ${item.createdAt ? new Date(item.createdAt).toLocaleString() : "recently"}`,
            status,
            scanText: status === "pending" ? "Waiting for review" : undefined,
            reason: item.rejectionReason
              ? (item.rejectionReason.startsWith("Reason:")
                ? item.rejectionReason
                : `Reason: ${item.rejectionReason}`)
              : undefined,
          };
        });
        const mockPending = getMockPendingExercise();
        const hasMockPending = Boolean(mockPending && !items.some((item) => item.id === mockPending.id));
        const hasRejectedMock = (counts?.rejectedCount || 0) === 0 && !mockPending;
        const showRejectedMock = activeTab === "rejected"
          && items.length === 0
          && hasRejectedMock
          && !searchInput.trim()
          && selectedLevel === "All levels"
          && currentPage === 1;
        const visibleItems = activeTab === "pending" && mockPending
          ? [mockPending, ...items.filter((item) => item.id !== mockPending.id)]
          : showRejectedMock
              ? INITIAL_REJECTED.filter((item) => item.isMock)
              : items;
        const totalElementsWithMock = (pageData?.totalElements || 0)
          + (showRejectedMock || (activeTab === "pending" && hasMockPending) ? 1 : 0);
        setExercises(visibleItems);
        setTotalElements(totalElementsWithMock);
        setTotalPages(showRejectedMock || (activeTab === "pending" && hasMockPending && !pageData?.totalPages)
          ? 1
          : pageData?.totalPages || 0);
        if (pageData?.totalPages > 0 && currentPage > pageData.totalPages) {
          setCurrentPage(pageData.totalPages);
        }
        setStatusCounts({
          pending: (counts?.pendingCount || 0) + (hasMockPending ? 1 : 0),
          rejected: (counts?.rejectedCount || 0) + (hasRejectedMock ? 1 : 0),
          accepted: counts?.acceptedCount || 0,
        });
      })
      .catch((error) => {
        console.error("Failed to load personal exercises:", error);
        if (active) {
          setExercises([]);
          setTotalElements(0);
          setTotalPages(0);
          setStatusCounts({ pending: 0, rejected: 0, accepted: 0 });
          setLoadError("Unable to load your exercises. Please try again.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTab, currentPage, searchInput, selectedLevel, refreshKey]);

  const handleTabSwitch = (tab) => { setActiveTab(tab); setSearchParams({ status: tab }); setSearchInput(""); setSelectedLevel("All levels"); setCurrentPage(1); };
  const handleDeleteExercise = (item) => {
    const itemIndex = exercises.findIndex((exercise) => String(exercise.id) === String(item.id));
    const status = (item.status || activeTab).toLowerCase();
    requestDelete({
      onOptimisticDelete: () => {
        setExercises((current) => current.filter((exercise) => String(exercise.id) !== String(item.id)));
        setStatusCounts((current) => ({ ...current, [status]: Math.max(0, current[status] - 1) }));
        setTotalElements((current) => Math.max(0, current - 1));
      },
      onUndo: () => {
        setExercises((current) => {
          if (current.some((exercise) => String(exercise.id) === String(item.id))) return current;
          const restored = [...current];
          restored.splice(Math.max(0, Math.min(itemIndex, restored.length)), 0, item);
          return restored;
        });
        setStatusCounts((current) => ({ ...current, [status]: current[status] + 1 }));
        setTotalElements((current) => current + 1);
      },
      onDelete: async () => {
        await deletePersonalExercise(item.id);
        setRefreshKey((value) => value + 1);
      },
      successMessage: "Deleted successfully",
    });
  };
  const handleCancelPending = handleDeleteExercise;
  const handleDeleteRejected = handleDeleteExercise;
  const handleDeleteAccepted = handleDeleteExercise;

  const activeItems = exercises;

  return (
    <div className="my-ex-list w-full max-w-5xl mx-auto text-white pb-16">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">My exercise list</h1>
          <p className="text-xs text-slate-400 mt-1">Exercises you created. Each one is checked automatically before it joins your library.</p>
        </div>
        <button type="button" onClick={() => navigate("/library/personal/new")} className="rounded-xl border border-[#8065ff] bg-[#643bf6] hover:bg-[#7554ff] hover:border-[#a08cff] text-white text-sm font-semibold px-5 py-2.5 shadow-lg shadow-purple-950/50 active:scale-95 flex items-center gap-1.5 cursor-pointer transition-colors">
          <span className="text-base font-bold leading-none">+</span>
          <span>Create exercise</span>
        </button>
      </div>
      <div className="flex items-center gap-2 mt-6 border-b border-[#2a224b] select-none">
        {[
          { key: "pending", label: "Pending", count: statusCounts.pending, pill: "bg-amber-400/15 text-amber-300" },
          { key: "rejected", label: "Rejected", count: statusCounts.rejected, pill: "bg-rose-400/15 text-rose-300" },
          { key: "accepted", label: "Accepted", count: statusCounts.accepted, pill: "bg-emerald-400/15 text-emerald-300" },
        ].map(({ key, label, count, pill }) => (
          <button
            key={key}
            type="button"
            onClick={() => handleTabSwitch(key)}
            className={`!bg-transparent flex items-center gap-2.5 rounded-t-lg border-b-2 px-3.5 py-3 text-sm cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b6cff] ${
              activeTab === key
                ? "border-[#8b6cff] bg-[#17112f] font-semibold text-white"
                : "border-transparent font-medium text-slate-400 hover:bg-[#120d29] hover:text-slate-200"
            }`}
          >
            <span>{label}</span>
            <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none ${pill}`}>{count}</span>
          </button>
        ))}
      </div>
      {activeTab === "pending" && (
        <div className="rounded-xl border border-amber-700/50 bg-[#2b200f] px-5 py-3.5 mt-4 shadow-sm shadow-amber-950/30">
          <p className="text-[13px] font-medium text-amber-100">Waiting for the automatic checks. This usually takes a few minutes, and you will get a notification when it is done.</p>
        </div>
      )}
      {activeTab === "rejected" && (
        <div className="rounded-xl border border-rose-700/50 bg-[#2b111a] px-5 py-3.5 mt-4 shadow-sm shadow-rose-950/30">
          <p className="text-[13px] font-medium text-rose-100">These exercises did not pass the checks. Fix the reason shown and resubmit, or delete them.</p>
        </div>
      )}
      {activeTab === "accepted" && (
        <div className="rounded-xl border border-emerald-700/50 bg-[#10281d] px-5 py-3.5 mt-4 shadow-sm shadow-emerald-950/30">
          <p className="text-[13px] font-medium text-emerald-100">These exercises passed the checks and are in your library.</p>
        </div>
      )}
      <div className="flex items-center gap-3 mt-5 flex-wrap md:flex-nowrap">
        <div className="flex-1 min-w-[220px] relative flex items-center">
          <div className="absolute left-3.5 pointer-events-none text-slate-400"><SearchIcon className="w-4 h-4" /></div>
          <input type="text" className="w-full rounded-xl bg-[#120d29] border border-[#231b46] pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-[#6340f1] outline-none transition-all" placeholder="Search by title" value={searchInput} onChange={(e) => { setSearchInput(e.target.value); setCurrentPage(1); }} />
        </div>
        <div className="w-44 flex-shrink-0 relative flex items-center">
          <select className="w-full appearance-none rounded-xl bg-[#120d29] border border-[#231b46] px-4 py-2.5 pr-9 text-sm text-slate-300 outline-none focus:border-[#6340f1] cursor-pointer" value={selectedLevel} onChange={(e) => { setSelectedLevel(e.target.value); setCurrentPage(1); }}>
            {['All levels', 'Beginner', 'Intermediate', 'Advanced'].map((lvl) => (
              <option key={lvl} value={lvl} className="bg-[#120d29] text-white">{lvl}</option>
            ))}
          </select>
          <div className="absolute right-3 pointer-events-none text-slate-400"><ChevronDownIcon className="w-4 h-4" /></div>
        </div>
      </div>
      <div className="space-y-4 mt-5">
        {loading ? (
          <div className="text-center py-14 text-sm text-slate-400">Loading exercises...</div>
        ) : loadError ? (
          <div role="alert" className="text-center py-14 text-sm text-rose-300">{loadError}</div>
        ) : activeItems.length === 0 ? (
          <div className="text-center py-14 px-4 rounded-2xl border border-dashed border-[#231b46] bg-[#120d29]">
            <div className="w-10 h-10 mx-auto mb-3 flex items-center justify-center"><BarbellIcon className="h-6 w-6 text-[#9d7aff]" /></div>
            <h3 className="text-base font-bold text-white mb-1">No exercises in this list</h3>
            <p className="text-xs text-slate-400">Try adjusting your search or create a new exercise.</p>
          </div>
        ) : (
          activeItems.map((it) => (
            <ExerciseCard key={it.id} item={it} activeTab={activeTab} onCancelPending={handleCancelPending} onDeleteRejected={handleDeleteRejected} onDeleteAccepted={handleDeleteAccepted} navigate={navigate} />
          ))
        )}
      </div>
      {totalPages > 0 && (
        <div className="mt-5 flex items-center justify-between border-t border-[#1f193f] pt-4">
          <p className="text-xs text-slate-400">
            Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, totalElements)} of {totalElements} exercises
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="rounded-md border border-[#22184c] bg-[#130d2e] px-3 py-1.5 text-xs font-medium text-[#8a82af] hover:border-[#382672] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 transition-all"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`h-8 min-w-8 rounded-md px-2 text-xs transition-all ${
                  page === currentPage
                    ? "bg-[#6340f1] text-white font-bold shadow-sm"
                    : "border border-[#22184c] bg-[#130d2e] text-[#8a82af] hover:border-[#382672] hover:text-white"
                }`}
                aria-current={page === currentPage ? "page" : undefined}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              className="rounded-md border border-[#22184c] bg-[#130d2e] px-3 py-1.5 text-xs font-medium text-[#8a82af] hover:border-[#382672] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}
      {confirmationModal}
    </div>
  );
}
