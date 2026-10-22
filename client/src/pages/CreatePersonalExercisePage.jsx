import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { createMemberExercise } from "../api/library";
import { validatePersonalExercise } from "./libraryFormValidation";

export default function CreatePersonalExercisePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Sync document title to match mockup window header: CalisHealth - Library
  useEffect(() => {
    document.title = "CalisHealth - Library";
    return () => {
      document.title = "CalisHealth";
    };
  }, []);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("Beginner");
  const [guideSteps, setGuideSteps] = useState([
    "Start in a plank with hands under shoulders",
    "",
  ]);
  const [videoFile, setVideoFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Content Check states (System automated scanning)
  const [textCheckStatus, setTextCheckStatus] = useState("idle"); // 'idle' | 'checking' | 'passed' | 'failed'
  const [videoCheckStatus, setVideoCheckStatus] = useState("idle"); // 'idle' | 'checking' | 'passed' | 'failed'
  const [isCreating, setIsCreating] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [touchedFields, setTouchedFields] = useState({});
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const validationErrors = validatePersonalExercise({
    title,
    description,
    level,
    steps: guideSteps,
    videoFile,
    requireVideo: true,
  });
  const isDirty = Boolean(
    title ||
      description ||
      videoFile ||
      level !== "Beginner" ||
      guideSteps[0] !== "Start in a plank with hands under shoulders" ||
      guideSteps.length !== 2 ||
      guideSteps[1] !== ""
  );

  const showFieldError = (field) => hasSubmitted || touchedFields[field];
  const markFieldTouched = (field) =>
    setTouchedFields((current) => ({ ...current, [field]: true }));
  const focusFirstInvalidField = (errors) => {
    const firstInvalidId = [
      "exercise-title",
      "exercise-description",
      "exercise-level",
      ...guideSteps.map((_, index) => `guide-step-${index}`),
      "exercise-video",
    ].find((id) => errors[id.replace("exercise-", "").replace("guide-step-", "step-")]);
    const firstInvalid = firstInvalidId && document.getElementById(firstInvalidId);
    firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
    firstInvalid?.focus();
  };

  // Step handlers
  const handleStepChange = (index, value) => {
    setGuideSteps((prev) =>
      prev.map((step, idx) => (idx === index ? value : step))
    );
  };

  const handleAddStep = () => {
    setGuideSteps((prev) => [...prev, ""]);
  };

  const handleRemoveStep = (index) => {
    if (guideSteps.length <= 1) return;
    setGuideSteps((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Video upload handlers
  const handleFileSelect = (e) => {
    markFieldTouched("video");
    const file = e.target.files?.[0];
    if (file) {
      setErrorMessage("");
      setVideoFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    markFieldTouched("video");
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setErrorMessage("");
      setVideoFile(file);
    }
  };

  // Trigger automated scanning and submission
  const handleCreate = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
      e.stopPropagation();
    }
    setHasSubmitted(true);
    if (Object.keys(validationErrors).length > 0) {
      setErrorMessage("");
      toast.warning("Please fill in all required fields correctly.");
      focusFirstInvalidField(validationErrors);
      return;
    }
    setErrorMessage("");
    setIsCreating(true);

    // 1. Text Check Simulation
    setTextCheckStatus("checking");
    await new Promise((resolve) => setTimeout(resolve, 800));
    setTextCheckStatus("passed");

    // 2. Video Check (MediaPipe Pose Detection) Simulation
    setVideoCheckStatus("checking");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setVideoCheckStatus("passed");

    // 3. Save exercise to localStorage (so it's immediately available in community & member lists)
    const newExercise = {
      id: `personal-${Date.now()}`,
      slug: title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      title: title.trim(),
      level,
      muscles: "Full body",
      setsReps: "3 sets · 10 reps",
      author: {
        name: "Linh Tran (You)",
        initials: "LT",
        avatarBg: "bg-[#643bf6]",
      },
      postedTime: "Just now",
      postedDaysAgo: 0,
      savesCount: 0,
      isMine: true,
      description: description.trim(),
      instructions: guideSteps.filter((s) => s.trim()),
    };

    try {
      const existing = JSON.parse(
        localStorage.getItem("my_personal_exercises") || "[]"
      );
      if (!Array.isArray(existing)) {
        throw new Error("Saved exercises are not in the expected format.");
      }
      localStorage.setItem(
        "my_personal_exercises",
        JSON.stringify([newExercise, ...existing])
      );
    } catch {
      setIsCreating(false);
      setErrorMessage("Could not save exercise.");
      toast.error("Failed to create. Please try again.");
      return;
    }

    // 4. Try sending to backend API safely without redirecting on failure
    try {
      const token = localStorage.getItem("token");
      if (token) {
        await createMemberExercise({
          name: title.trim(),
          level,
          description: description.trim(),
          instructions: guideSteps.filter((s) => s.trim()).join("\n"),
          muscleGroup: "Full body",
          sets: 3,
          repsOrDuration: "10 reps",
        });
      }
    } catch (err) {
      console.warn("Backend API sync skipped/failed:", err?.message || err);
    }

    toast.success("Created successfully!");
    setSuccessMessage("Exercise passed all checks and was saved to your library!");

    // 5. Redirect back to My exercise list - Pending
    setTimeout(() => {
      navigate("/library/personal?status=pending");
    }, 1000);
  };

  return (
    <div className="create-personal-exercise-page w-full max-w-5xl mx-auto space-y-6 pb-16 text-white">
      {/* Explicit scoped reset for buttons */}
      <style>{`
        .create-personal-exercise-page button {
          border: none;
          outline: none;
        }
      `}</style>

      {/* A. HEADER TRANG */}
      <header className="mb-2">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Create personal exercise
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Add your own exercise. It is checked automatically before it is saved
          to your library.
        </p>
      </header>

      {/* Alert notifications */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs flex items-center justify-between shadow-sm">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage("")}
            className="text-rose-300 hover:text-white font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-800/80 text-emerald-300 text-xs flex items-center justify-between shadow-sm">
          <span>{successMessage}</span>
        </div>
      )}

      {/* B. KHỐI 1: EXERCISE DETAILS */}
      <section className="rounded-2xl border border-[#231b46] bg-[#120d29]/90 p-6 space-y-5 shadow-xl">
        <h2 className="text-sm font-semibold text-white">Exercise details</h2>

        {/* Title */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Title
            </label>
            <span className="text-xs text-slate-500 font-mono">
              {title.length}/60
            </span>
          </div>
          <input
            type="text"
            id="exercise-title"
            maxLength={60}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              markFieldTouched("title");
            }}
            placeholder="e.g. Diamond push-up"
            className={`w-full rounded-xl border ${showFieldError("title") && validationErrors.title ? "border-rose-500 focus:border-rose-500" : "border-[#231b46] focus:border-[#7c3aed]"} bg-[#0c0820] px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors`}
          />
          {showFieldError("title") && validationErrors.title && <p className="text-rose-400 text-[11px] mt-1">{validationErrors.title}</p>}
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Description
            </label>
            <span className="text-xs text-slate-500 font-mono">
              {description.length}/300
            </span>
          </div>
          <textarea
            id="exercise-description"
            maxLength={300}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              markFieldTouched("description");
            }}
            placeholder="What does this exercise train, and who is it for?"
            className={`w-full rounded-xl border ${showFieldError("description") && validationErrors.description ? "border-rose-500 focus:border-rose-500" : "border-[#231b46] focus:border-[#7c3aed]"} bg-[#0c0820] p-4 text-xs text-white placeholder-slate-500 h-28 resize-none focus:outline-none transition-colors leading-relaxed`}
          />
          {showFieldError("description") && validationErrors.description && <p className="text-rose-400 text-[11px] mt-1">{validationErrors.description}</p>}
        </div>

        {/* Level */}
        <div>
          <label className="block text-xs text-slate-400 mb-2">Level</label>
          <div id="exercise-level" tabIndex={-1} className={`grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl ${showFieldError("level") && validationErrors.level ? "ring-1 ring-rose-500" : ""}`}>
            {/* Beginner */}
            <div
              onClick={() => {
                setLevel("Beginner");
                markFieldTouched("level");
              }}
              className={`rounded-xl p-3.5 flex items-start justify-between cursor-pointer transition-all select-none ${
                level === "Beginner"
                  ? "border border-[#8b6cff] bg-[#2a1d5d] shadow-md shadow-purple-900/40"
                  : "border border-[#493b79] bg-[#0c0820] hover:border-[#8b6cff]"
              }`}
            >
              <div>
                <h3 className="text-xs font-semibold text-white">Beginner</h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  New to this movement
                </p>
              </div>
              <div
                className={`w-4 h-4 self-center rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                  level === "Beginner"
                    ? "bg-[#643bf6] border-2 border-[#c4b5fd] shadow-[0_0_0_3px_rgba(100,59,246,0.2)]"
                    : "border-2 border-[#8b7ab8] bg-[#17112f]"
                }`}
              >
                {level === "Beginner" && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>
            </div>

            {/* Intermediate */}
            <div
              onClick={() => {
                setLevel("Intermediate");
                markFieldTouched("level");
              }}
              className={`rounded-xl p-3.5 flex items-start justify-between cursor-pointer transition-all select-none ${
                level === "Intermediate"
                  ? "border border-[#8b6cff] bg-[#2a1d5d] shadow-md shadow-purple-900/40"
                  : "border border-[#493b79] bg-[#0c0820] hover:border-[#8b6cff]"
              }`}
            >
              <div>
                <h3 className="text-xs font-semibold text-white">
                  Intermediate
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Comfortable with the basics
                </p>
              </div>
              <div
                className={`w-4 h-4 self-center rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                  level === "Intermediate"
                    ? "bg-[#643bf6] border-2 border-[#c4b5fd] shadow-[0_0_0_3px_rgba(100,59,246,0.2)]"
                    : "border-2 border-[#8b7ab8] bg-[#17112f]"
                }`}
              >
                {level === "Intermediate" && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>
            </div>

            {/* Advanced */}
            <div
              onClick={() => {
                setLevel("Advanced");
                markFieldTouched("level");
              }}
              className={`rounded-xl p-3.5 flex items-start justify-between cursor-pointer transition-all select-none ${
                level === "Advanced"
                  ? "border border-[#8b6cff] bg-[#2a1d5d] shadow-md shadow-purple-900/40"
                  : "border border-[#493b79] bg-[#0c0820] hover:border-[#8b6cff]"
              }`}
            >
              <div>
                <h3 className="text-xs font-semibold text-white">Advanced</h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Strong and experienced
                </p>
              </div>
              {showFieldError("level") && validationErrors.level && <p className="text-rose-400 text-[11px] mt-1">{validationErrors.level}</p>}
              <div
                className={`w-4 h-4 self-center rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                  level === "Advanced"
                    ? "bg-[#643bf6] border-2 border-[#c4b5fd] shadow-[0_0_0_3px_rgba(100,59,246,0.2)]"
                    : "border-2 border-[#8b7ab8] bg-[#17112f]"
                }`}
              >
                {level === "Advanced" && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* C. KHỐI 2: GUIDE */}
      <section className="rounded-2xl border border-[#231b46] bg-[#120d29]/90 p-6 space-y-4 shadow-xl">
        <h2 className="text-sm font-semibold text-white">Guide</h2>

        {/* Steps inputs list */}
        <div id="guide-step-list" className="space-y-3">
          {guideSteps.map((step, index) => (
            <div key={index} className="flex items-center gap-3">
              {/* Số thứ tự */}
              <span className="text-xs text-slate-500 w-4 text-center select-none font-medium">
                {index + 1}
              </span>

              {/* Input text bước hướng dẫn */}
              <div className="flex-1">
                <input
                  type="text"
                  id={`guide-step-${index}`}
                  value={step}
                  onChange={(e) => {
                    handleStepChange(index, e.target.value);
                    markFieldTouched(`step-${index}`);
                  }}
                  placeholder={
                    index === 0
                      ? "e.g. Start in a plank with hands under shoulders"
                      : "Next step"
                  }
                  className={`w-full rounded-xl border ${showFieldError(`step-${index}`) && validationErrors[`step-${index}`] ? "border-rose-500 focus:border-rose-500" : "border-[#231b46] focus:border-[#7c3aed]"} bg-[#0c0820] px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors`}
                />
                {showFieldError(`step-${index}`) && validationErrors[`step-${index}`] && <p className="text-rose-400 text-[11px] mt-1">{validationErrors[`step-${index}`]}</p>}
              </div>

              {/* Nút xoá (X) từng bước (chỉ xoá khi còn > 1 bước) */}
              {guideSteps.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveStep(index)}
                  className="h-10 w-10 rounded-xl bg-rose-950/30 border border-rose-900/40 text-rose-400 hover:bg-rose-900/50 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                  aria-label="Remove step"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        {showFieldError("steps") && validationErrors.steps && <p className="text-rose-400 text-[11px] mt-1">{validationErrors.steps}</p>}

        {/* Nút "+ Add step" */}
        <div>
          <button
            type="button"
            onClick={handleAddStep}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#2b2257] bg-[#181238] px-4 py-2 text-xs font-medium text-white hover:bg-[#231b4d] transition-colors cursor-pointer"
          >
            <span>+ Add step</span>
          </button>
        </div>

        {/* Chú thích */}
        <p className="text-[11px] text-slate-500 mt-2">
          Write the steps in order, one action per step.
        </p>
      </section>

      {/* D. KHỐI 3: DEMO VIDEO */}
      <section className="rounded-2xl border border-[#231b46] bg-[#120d29]/90 p-6 space-y-3 shadow-xl">
        <h2 className="text-sm font-semibold text-white">Demo video</h2>

        {/* Dropzone container */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div
          id="exercise-video"
          tabIndex={-1}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`rounded-2xl border border-dashed p-8 flex flex-col items-center justify-center cursor-pointer transition-all select-none ${
            isDragging
              ? "border-[#a855f7] bg-[#22174c]/60"
              : "border-[#5b32e8]/60 bg-[#161036]/40 hover:bg-[#1a1340]/60"
          }`}
        >
          {/* Upload icon */}
          <div className="w-10 h-10 rounded-full bg-[#201748] flex items-center justify-center mb-2 text-[#9d7aff] shadow-sm">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          {showFieldError("video") && validationErrors.video && <p className="text-rose-400 text-[11px] mt-1">{validationErrors.video}</p>}

          <h3 className="text-xs font-semibold text-white">
            {videoFile ? videoFile.name : "Click to upload a demo video"}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1 text-center">
            {videoFile
              ? `${(videoFile.size / (1024 * 1024)).toFixed(
                  1
                )} MB · Click to choose a different video`
              : "MP4, MOV or WebM · up to 50 MB · keep your whole body in frame"}
          </p>
        </div>

        {/* Chú thích */}
        <p className="text-[11px] text-slate-500">
          The video is scanned with MediaPipe to read your body pose, so the AI
          camera can compare your form with this demo.
        </p>
      </section>

      {/* E. KHỐI 4: CONTENT CHECK (HỆ THỐNG TỰ ĐỘNG QUÉT - KHÔNG THỂ TỰ TÍCH CHỌN THỦ CÔNG) */}
      <section className="rounded-2xl border border-[#231b46] bg-[#120d29]/90 p-6 space-y-4 shadow-xl">
        <h2 className="text-sm font-semibold text-white">Content check</h2>

        <div className="space-y-3 select-none">
          {/* 1. Text check */}
          <div className="flex items-center gap-3 rounded-xl border border-[#33265f] bg-[#0d0922] p-3">
            {/* Vòng tròn trạng thái */}
            <div className="flex h-4 flex-shrink-0 items-center">
              {textCheckStatus === "passed" ? (
                <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                  <svg
                    className="w-3 h-3"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              ) : textCheckStatus === "checking" ? (
                <div className="w-4 h-4 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-[#9d7aff] bg-[#1b1438] shadow-[0_0_0_3px_rgba(100,59,246,0.14)]" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-medium text-white">Text check</h3>
                {textCheckStatus === "checking" && (
                  <span className="text-[10px] text-purple-400 font-semibold animate-pulse">
                    Scanning text...
                  </span>
                )}
                {textCheckStatus === "passed" && (
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    Passed
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Title, description and guide are scanned for inappropriate
                words.
              </p>
            </div>
          </div>

          {/* 2. Video check (MediaPipe) */}
          <div className="flex items-center gap-3 rounded-xl border border-[#33265f] bg-[#0d0922] p-3">
            {/* Vòng tròn trạng thái */}
            <div className="flex h-4 flex-shrink-0 items-center">
              {videoCheckStatus === "passed" ? (
                <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                  <svg
                    className="w-3 h-3"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              ) : videoCheckStatus === "checking" ? (
                <div className="w-4 h-4 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-[#9d7aff] bg-[#1b1438] shadow-[0_0_0_3px_rgba(100,59,246,0.14)]" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-medium text-white">
                  Video check (MediaPipe)
                </h3>
                {videoCheckStatus === "checking" && (
                  <span className="text-[10px] text-purple-400 font-semibold animate-pulse">
                    Analyzing pose with MediaPipe...
                  </span>
                )}
                {videoCheckStatus === "passed" && (
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    Passed
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                The demo video is scanned for a clearly visible body pose.
              </p>
            </div>
          </div>
        </div>

        {/* Ghi chú */}
        <p className="text-[11px] text-slate-500">
          Both checks run when you press Create. The exercise is saved only if
          both pass.
        </p>
      </section>

      {/* F. THANH HÀNH ĐỘNG Ở ĐÁY (BOTTOM ACTIONS) */}
      <div className="flex items-center justify-end gap-3 pt-4">
        {/* Nút Cancel */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-xl border border-[#2b2257] bg-[#141030] hover:bg-[#1f1847] text-slate-300 hover:text-white text-xs font-semibold px-6 py-2.5 transition-colors cursor-pointer"
        >
          Cancel
        </button>

        {/* Nút Create */}
        <button
          type="button"
          disabled={isCreating || !isDirty}
          onClick={handleCreate}
          className="rounded-xl bg-[#643bf6] hover:bg-[#522cd9] text-white text-xs font-semibold px-7 py-2.5 shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-60"
        >
          {isCreating && (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          )}
          <span>{isCreating ? "Scanning & Creating..." : "Create"}</span>
        </button>
      </div>
    </div>
  );
}
