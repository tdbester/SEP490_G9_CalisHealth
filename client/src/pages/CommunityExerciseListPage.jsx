import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { createMemberExercise } from "../api/library";

// Mock data matching mockup 100%
const INITIAL_COMMUNITY_EXERCISES = [
  {
    id: "comm-1",
    slug: "diamond-push-up",
    title: "Diamond push-up",
    level: "Intermediate",
    muscles: "Chest, triceps",
    setsReps: "3 sets · 8 reps",
    author: {
      name: "Linh Tran",
      initials: "LT",
      avatarBg: "bg-[#643bf6]",
    },
    postedTime: "2 days ago",
    postedDaysAgo: 2,
    savesCount: 42,
    isMine: true,
  },
  {
    id: "comm-2",
    slug: "pike-push-up",
    title: "Pike push-up",
    level: "Intermediate",
    muscles: "Shoulders, triceps",
    setsReps: "3 sets · 8 reps",
    author: {
      name: "Linh Tran",
      initials: "LT",
      avatarBg: "bg-[#643bf6]",
    },
    postedTime: "3 days ago",
    postedDaysAgo: 3,
    savesCount: 38,
    isMine: true,
  },
  {
    id: "comm-3",
    slug: "australian-row",
    title: "Australian row",
    level: "Beginner",
    muscles: "Back, biceps",
    setsReps: "3 sets · 10 reps",
    author: {
      name: "Duc Hoang",
      initials: "DH",
      avatarBg: "bg-[#7c3aed]",
    },
    postedTime: "5 days ago",
    postedDaysAgo: 5,
    savesCount: 58,
    isMine: false,
  },
  {
    id: "comm-4",
    slug: "pseudo-planche-push-up",
    title: "Pseudo planche push-up",
    level: "Advanced",
    muscles: "Shoulders, chest",
    setsReps: "4 sets · 6 reps",
    author: {
      name: "Minh Pham",
      initials: "MP",
      avatarBg: "bg-[#6d28d9]",
    },
    postedTime: "1 week ago",
    postedDaysAgo: 7,
    savesCount: 29,
    isMine: false,
  },
  {
    id: "comm-5",
    slug: "bodyweight-squat",
    title: "Bodyweight squat",
    level: "Beginner",
    muscles: "Legs, glutes",
    setsReps: "3 sets · 15 reps",
    author: {
      name: "An Nguyen",
      initials: "AN",
      avatarBg: "bg-[#4f46e5]",
    },
    postedTime: "2 weeks ago",
    postedDaysAgo: 14,
    savesCount: 64,
    isMine: false,
  },
  {
    id: "comm-6",
    slug: "hollow-body-hold",
    title: "Hollow body hold",
    level: "Beginner",
    muscles: "Core",
    setsReps: "3 sets · 30 sec",
    author: {
      name: "Mai Vo",
      initials: "MV",
      avatarBg: "bg-[#9333ea]",
    },
    postedTime: "3 weeks ago",
    postedDaysAgo: 21,
    savesCount: 51,
    isMine: false,
  },
];

function normalizePersonalExercise(exercise, index) {
  const title = String(exercise?.title || exercise?.name || "Personal exercise");
  const authorName = exercise?.author?.name || "You";

  return {
    ...exercise,
    id: exercise?.id || `personal-${index}`,
    slug: exercise?.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    title,
    level: exercise?.level || "Intermediate",
    muscles: exercise?.muscles || exercise?.muscleGroup || "Full body",
    setsReps: exercise?.setsReps || "3 sets · 10 reps",
    author: {
      name: authorName,
      initials:
        exercise?.author?.initials ||
        authorName
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      avatarBg: exercise?.author?.avatarBg || "bg-[#643bf6]",
    },
    postedTime: exercise?.postedTime || "Recently",
    postedDaysAgo: Number(exercise?.postedDaysAgo) || 0,
    savesCount: Number(exercise?.savesCount) || 0,
  };
}

// Horizontal Barbell Icon matching Figma design
function BarbellIcon({ className = "h-5 w-5 text-[#9d7aff]" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 7v10" />
      <path d="M18 7v10" />
      <path d="M3 10v4" />
      <path d="M21 10v4" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  );
}

// Search Icon
function SearchIcon({ className = "w-4 h-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// Chevron Down Icon
function ChevronDownIcon({ className = "w-4 h-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function CommunityExerciseListPage() {
  const navigate = useNavigate();

  // Document title: CalisHealth - Library
  useEffect(() => {
    document.title = "CalisHealth - Library";
    return () => {
      document.title = "CalisHealth";
    };
  }, []);

  const [exercises, setExercises] = useState(() => {
    try {
      const storedExercises = JSON.parse(
        localStorage.getItem("my_personal_exercises") || "[]"
      );
      const local = Array.isArray(storedExercises)
        ? storedExercises.map(normalizePersonalExercise)
        : [];
      return [...local, ...INITIAL_COMMUNITY_EXERCISES];
    } catch (e) {
      return INITIAL_COMMUNITY_EXERCISES;
    }
  });
  const [searchInput, setSearchInput] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("All levels");
  const [sortOrder, setSortOrder] = useState("Newest");
  const [isMyView, setIsMyView] = useState(false);

  // Modal Create Exercise State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(null);
  const [createForm, setCreateForm] = useState({
    title: "",
    level: "Intermediate",
    muscles: "Chest, triceps",
    sets: 3,
    repsOrDuration: "8 reps",
    description: "",
    videoUrl: "",
  });

  // Toggle My exercise list filter
  const toggleMyExercises = () => {
    setIsMyView((prev) => !prev);
  };

  // Filter & Sort list
  const filteredExercises = useMemo(() => {
    let list = [...exercises];

    // Filter by My Submissions if active
    if (isMyView) {
      list = list.filter((item) => item.isMine);
    }

    // Filter by Level
    if (selectedLevel !== "All levels") {
      list = list.filter(
        (item) => item.level.toLowerCase() === selectedLevel.toLowerCase()
      );
    }

    // Filter by search keywords (title or author name)
    if (searchInput.trim()) {
      const q = searchInput.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.author.name.toLowerCase().includes(q) ||
          item.muscles.toLowerCase().includes(q)
      );
    }

    // Sort order
    if (sortOrder === "Most saved") {
      list.sort((a, b) => b.savesCount - a.savesCount);
    } else if (sortOrder === "Oldest") {
      list.sort((a, b) => b.postedDaysAgo - a.postedDaysAgo);
    } else {
      // Newest
      list.sort((a, b) => a.postedDaysAgo - b.postedDaysAgo);
    }

    return list;
  }, [exercises, isMyView, selectedLevel, searchInput, sortOrder]);

  const handleView = (item) => {
    const slug =
      item.slug ||
      item.id ||
      item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    navigate(`/library/community/${slug}`, {
      state: {
        author: item.author?.name,
        postedTime: item.postedTime,
      },
    });
  };

  // Submit new exercise
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.title.trim()) {
      toast.warning("Please fill in all required fields correctly.");
      return;
    }

    setSubmitting(true);
    try {
      let apiFailed = false;
      // Attempt backend API call if server is running
      try {
        await createMemberExercise({
          name: createForm.title.trim(),
          level: createForm.level,
          muscleGroup: createForm.muscles,
          sets: Number(createForm.sets) || 3,
          repsOrDuration: createForm.repsOrDuration,
          description: createForm.description,
          demoVideoUrl: createForm.videoUrl,
        });
      } catch {
        // Fallback to local state append seamlessly
        apiFailed = true;
        toast.error("Failed to create. Please try again.");
      }

      const newExercise = {
        id: `comm-${Date.now()}`,
        slug: createForm.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        title: createForm.title.trim(),
        level: createForm.level,
        muscles: createForm.muscles,
        setsReps: `${createForm.sets} sets · ${createForm.repsOrDuration}`,
        author: {
          name: "Linh Tran (You)",
          initials: "LT",
          avatarBg: "bg-[#643bf6]",
        },
        postedTime: "Just now",
        postedDaysAgo: 0,
        savesCount: 0,
        isMine: true,
      };

      setExercises((prev) => [newExercise, ...prev]);
      setFormSuccess(apiFailed
        ? "Exercise saved locally, but could not sync with the server."
        : "Exercise published successfully and passed automatic checks!");
      if (!apiFailed) toast.success("Created successfully!");
      setTimeout(() => {
        setFormSuccess(null);
        setShowCreateModal(false);
        setCreateForm({
          title: "",
          level: "Intermediate",
          muscles: "Chest, triceps",
          sets: 3,
          repsOrDuration: "8 reps",
          description: "",
          videoUrl: "",
        });
      }, 1200);
    } catch {
      toast.error("Failed to create. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="community-exercise-page w-full max-w-7xl mx-auto text-white pb-14">
      {/* Explicit scoped reset for buttons */}
      <style>{`
        .community-exercise-page button {
          border: none;
          outline: none;
        }
      `}</style>

      {/* A. HEADER & NÚT TẠO BÀI TẬP */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Member-provided exercise list
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse exercises shared by other members for reference.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/library/personal/new")}
          className="mt-1 rounded-xl bg-[#643bf6] hover:bg-[#522cd9] text-white text-xs font-semibold px-5 py-2.5 shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <span className="text-sm font-bold leading-none">+</span>
          <span>Create exercise</span>
        </button>
      </div>

      {/* B. NÚT CHUYỂN "MY EXERCISE LIST" & BANNER THÔNG BÁO */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => navigate("/library/personal?status=pending")}
          className="inline-flex items-center gap-2 rounded-xl border border-[#7658df] bg-[#24194f] hover:bg-[#302066] px-4 py-2 text-xs font-semibold text-white hover:border-[#a58bff] transition-all cursor-pointer shadow-sm shadow-purple-950/40"
        >
          <svg
            className="w-3.5 h-3.5 text-[#c4b5fd]"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M3 4.5A1.5 1.5 0 014.5 3h11A1.5 1.5 0 0117 4.5v1A1.5 1.5 0 0115.5 7h-11A1.5 1.5 0 013 5.5v-1zM3 9.5A1.5 1.5 0 014.5 8h11A1.5 1.5 0 0117 9.5v1A1.5 1.5 0 0115.5 12h-11A1.5 1.5 0 013 10.5v-1zM3 14.5A1.5 1.5 0 014.5 13h11a1.5 1.5 0 011.5 1.5v1a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16v-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>My exercise list →</span>
        </button>

        {/* Thông báo hệ thống (System Notice) */}
        <div className="w-full rounded-xl border border-[#231b46] bg-[#120d29]/80 px-5 py-2.5 mt-3 text-xs text-slate-300 shadow-sm flex items-center justify-between flex-wrap gap-2">
          <span>Only exercises that passed the automatic checks are shown here.</span>
          {isMyView && (
            <span className="text-[11px] font-semibold text-purple-300 bg-purple-950/60 border border-purple-800/80 px-2.5 py-0.5 rounded-full">
              Showing My Submissions ({filteredExercises.length})
            </span>
          )}
        </div>
      </div>

      {/* C. THANH CÔNG CỤ LỌC & SẮP XẾP (TOOLBAR) */}
      <div className="flex items-center gap-3 mt-3 flex-wrap md:flex-nowrap">
        {/* Ô Tìm kiếm */}
        <div className="flex-1 min-w-[240px] relative flex items-center">
          <div className="absolute left-3.5 pointer-events-none text-slate-400 flex items-center justify-center">
            <SearchIcon className="w-4 h-4" />
          </div>
          <input
            type="text"
            className="w-full rounded-xl bg-[#120d29] border border-[#231b46] pl-10 pr-4 py-2.5 text-xs md:text-sm text-white placeholder-slate-500 outline-none focus:border-[#6340f1] transition-all"
            placeholder="Search by title or member"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        {/* Dropdown "All levels" */}
        <div className="w-40 flex-shrink-0 relative flex items-center">
          <select
            className="w-full appearance-none rounded-xl bg-[#120d29] border border-[#231b46] px-4 py-2.5 pr-10 text-xs md:text-sm font-medium text-white outline-none focus:border-[#6340f1] cursor-pointer transition-all"
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
          >
            <option value="All levels" className="bg-[#120d29] text-white">
              All levels
            </option>
            <option value="Beginner" className="bg-[#120d29] text-white">
              Beginner
            </option>
            <option value="Intermediate" className="bg-[#120d29] text-white">
              Intermediate
            </option>
            <option value="Advanced" className="bg-[#120d29] text-white">
              Advanced
            </option>
          </select>
          <div className="absolute right-3.5 pointer-events-none text-slate-400 flex items-center justify-center">
            <ChevronDownIcon className="w-4 h-4" />
          </div>
        </div>

        {/* Dropdown "Newest" */}
        <div className="w-36 flex-shrink-0 relative flex items-center">
          <select
            className="w-full appearance-none rounded-xl bg-[#120d29] border border-[#231b46] px-4 py-2.5 pr-10 text-xs md:text-sm font-medium text-white outline-none focus:border-[#6340f1] cursor-pointer transition-all"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="Newest" className="bg-[#120d29] text-white">
              Newest
            </option>
            <option value="Most saved" className="bg-[#120d29] text-white">
              Most saved
            </option>
            <option value="Oldest" className="bg-[#120d29] text-white">
              Oldest
            </option>
          </select>
          <div className="absolute right-3.5 pointer-events-none text-slate-400 flex items-center justify-center">
            <ChevronDownIcon className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* D. DANH SÁCH CARD BÀI TẬP CỘNG ĐỒNG (FULL-WIDTH LIST) */}
      <div className="w-full space-y-2 mt-3">
        {filteredExercises.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-[#231b46] bg-[#120d29] text-slate-400">
            <div className="w-10 h-10 mx-auto mb-2 text-purple-400 flex items-center justify-center">
              <BarbellIcon className="h-6 w-6 text-[#9d7aff]" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              No exercises found
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Try adjusting your search query, filter level, or clear your search.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSelectedLevel("All levels");
                setIsMyView(false);
              }}
              className="bg-[#643bf6] hover:bg-[#522cd9] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer"
            >
              Reset filters
            </button>
          </div>
        ) : (
          filteredExercises.map((item) => {
            const isBeginner = item.level === "Beginner";
            const isAdvanced = item.level === "Advanced";

            return (
              <div
                key={item.id}
                className="rounded-xl border border-[#231b46] bg-[#120d29]/90 px-4 py-2.5 flex items-center justify-between hover:border-[#3b2d75] transition-all shadow-md group"
              >
                {/* Cụm bên trái: Icon tạ trong khung + Khối thông tin */}
                <div className="flex items-center min-w-0 flex-1 mr-3">
                  {/* Khung icon tạ phình to */}
                  <div className="h-9 w-9 rounded-lg bg-[#201748] text-[#9d7aff] flex items-center justify-center flex-shrink-0 mr-3 shadow-sm group-hover:scale-105 transition-transform">
                    <BarbellIcon className="h-6 w-6 text-[#9d7aff]" />
                  </div>

                  {/* Khối thông tin 3 hàng */}
                  <div className="flex flex-col min-w-0">
                    {/* Hàng 1: Tên bài tập + Badge Level bo tròn pill */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-sm font-semibold text-white tracking-tight truncate group-hover:text-purple-300 transition-colors">
                        {item.title}
                      </h3>
                      <span
                        className={`px-3 py-0.5 text-[11px] font-medium rounded-full border capitalize ${
                          isBeginner
                            ? "border-emerald-800/80 bg-emerald-950/40 text-emerald-400"
                            : isAdvanced
                            ? "border-rose-800/80 bg-rose-950/40 text-rose-400"
                            : "border-amber-800/80 bg-amber-950/40 text-amber-400"
                        }`}
                      >
                        {item.level}
                      </span>
                    </div>

                    {/* Hàng 2: Nhóm cơ & Reps */}
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                      {item.muscles} · {item.setsReps}
                    </p>

                    {/* Hàng 3 (Metadata tác giả): Avatar tròn + Tên + Thời gian + Saves */}
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-1 truncate">
                      <div
                        className={`h-4 w-4 rounded-full ${
                          item.author.avatarBg || "bg-[#643bf6]"
                        } text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 shadow-sm`}
                      >
                        {item.author.initials}
                      </div>
                      <span className="truncate">
                        {item.author.name} · {item.postedTime} · {item.savesCount} saved
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cụm bên phải: Nút "View" */}
                <div className="flex items-center flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleView(item)}
                    className="rounded-lg border border-[#8b72e8] bg-[#643bf6] hover:bg-[#7553ff] text-white text-xs font-bold px-5 py-2 transition-all active:scale-95 cursor-pointer shadow-md shadow-purple-950/40"
                  >
                    View
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL TẠO BÀI TẬP (+ CREATE EXERCISE MODAL) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#2b2257] bg-[#120d29] p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-[#231b46]">
              <h2 className="text-lg font-bold text-white tracking-tight">
                Create community exercise
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full bg-[#1e1548] text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {formSuccess && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 text-xs font-medium">
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Exercise title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Archer push-up"
                  value={createForm.title}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, title: e.target.value }))
                  }
                  className="w-full rounded-xl bg-[#1a123d] border border-[#2b2257] px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-[#643bf6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Difficulty level
                  </label>
                  <select
                    value={createForm.level}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, level: e.target.value }))
                    }
                    className="w-full rounded-xl bg-[#1a123d] border border-[#2b2257] px-3.5 py-2 text-xs text-white outline-none focus:border-[#643bf6] cursor-pointer"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Target muscles
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chest, triceps"
                    value={createForm.muscles}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, muscles: e.target.value }))
                    }
                    className="w-full rounded-xl bg-[#1a123d] border border-[#2b2257] px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-[#643bf6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Sets
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={createForm.sets}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, sets: e.target.value }))
                    }
                    className="w-full rounded-xl bg-[#1a123d] border border-[#2b2257] px-3.5 py-2 text-xs text-white outline-none focus:border-[#643bf6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Reps or Duration
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 8 reps / 30 sec"
                    value={createForm.repsOrDuration}
                    onChange={(e) =>
                      setCreateForm((p) => ({
                        ...p,
                        repsOrDuration: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl bg-[#1a123d] border border-[#2b2257] px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-[#643bf6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Description &amp; cues
                </label>
                <textarea
                  rows="3"
                  placeholder="Key form cues and instructions..."
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, description: e.target.value }))
                  }
                  className="w-full rounded-xl bg-[#1a123d] border border-[#2b2257] px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-[#643bf6] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Demo video URL (optional)
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={createForm.videoUrl}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, videoUrl: e.target.value }))
                  }
                  className="w-full rounded-xl bg-[#1a123d] border border-[#2b2257] px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-[#643bf6]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#231b46]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-[#2b2257] bg-[#161133] hover:bg-[#20174a] text-slate-300 text-xs font-semibold px-4 py-2 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#643bf6] hover:bg-[#522cd9] text-white text-xs font-semibold px-5 py-2 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Publishing..." : "Publish exercise"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
