import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { createPersonalExercise } from "../api/library";
import ConfirmDialog from "../components/common/ConfirmDialog";
import {
  getApiErrorMessage,
  validatePersonalExercise,
  validateVideoFile,
} from "./libraryFormValidation";
import { LIBRARY_TEXT_WARNING, scanLibraryText } from "./libraryTextModeration";

export default function CreatePersonalExercisePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const anatomyInputRef = useRef(null);
  const submissionLock = useRef(false);

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
  const [countType, setCountType] = useState("reps_sets");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(12);
  const [duration, setDuration] = useState(30);
  const [targetMuscles, setTargetMuscles] = useState(["Full Body"]);
  const [anatomyImageFile, setAnatomyImageFile] = useState(null);
  const [anatomyPreview, setAnatomyPreview] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [level, setLevel] = useState("Beginner");
  const [guideSteps, setGuideSteps] = useState([
    "Start in a plank with hands under shoulders",
    "",
  ]);
  const [videoFile, setVideoFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  useEffect(() => {
    if (!anatomyImageFile) {
      setAnatomyPreview("");
      return undefined;
    }
    const previewUrl = URL.createObjectURL(anatomyImageFile);
    setAnatomyPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [anatomyImageFile]);

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
  const showFieldError = (field) =>
    Boolean((hasSubmitted || touchedFields[field]) && validationErrors[field]);
  const markFieldTouched = (field) =>
    setTouchedFields((current) => ({ ...current, [field]: true }));
  const focusFirstInvalidField = (errors) => {
    if (targetMuscles.length === 0) {
      const muscleGroupField = document.getElementById("exercise-muscle-groups");
      muscleGroupField?.scrollIntoView({ behavior: "smooth", block: "center" });
      muscleGroupField?.focus();
      return;
    }
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
      const fileError = validateVideoFile(file);
      if (fileError) toast.error(fileError);
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
      const fileError = validateVideoFile(file);
      if (fileError) toast.error(fileError);
    }
  };

  const handleAnatomyImageSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      toast.error("Choose a JPG, PNG, or WebP image up to 10 MB.");
      event.target.value = "";
      return;
    }
    setAnatomyImageFile(file);
  };

  const toggleMuscleGroup = (muscleGroup) => {
    setTargetMuscles((current) => {
      const selected = current.includes(muscleGroup)
        ? current.filter((value) => value !== muscleGroup)
        : [...current.filter((value) => value !== "Full Body"), muscleGroup];
      return selected.length > 0 ? selected : [];
    });
  };

  // Trigger automated scanning and submission
  const handleCreate = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setHasSubmitted(true);
    if (submissionLock.current) return;
    if (Object.keys(validationErrors).length > 0 || targetMuscles.length === 0) {
      setErrorMessage("");
      toast.warning("Please fill in all required fields correctly.");
      focusFirstInvalidField(validationErrors);
      return;
    }
    if (scanLibraryText([title, description, ...guideSteps, ...targetMuscles])) {
      setErrorMessage(LIBRARY_TEXT_WARNING);
      toast.error(LIBRARY_TEXT_WARNING, { style: { fontFamily: "Arial, sans-serif" } });
      return;
    }
    submissionLock.current = true;
    setErrorMessage("");
    setIsCreating(true);
    setTextCheckStatus("checking");
    setVideoCheckStatus("checking");

    try {
      const created = await createPersonalExercise({
        title: title.trim(),
        description: description.trim(),
        level: level.toUpperCase(),
        guideSteps: guideSteps.map((step) => step.trim()).filter(Boolean),
        targetMuscle: targetMuscles.join(", "),
        countType,
        sets: countType === "reps_sets" ? sets : 1,
        reps: countType === "reps_sets" ? reps : null,
        duration: countType === "duration" ? duration : null,
        defaultSets: countType === "reps_sets" ? sets : 1,
        defaultReps: countType === "reps_sets" ? reps : null,
        defaultDuration: countType === "duration" ? duration : null,
        shareWithCommunity: true,
      }, videoFile, anatomyImageFile);
      if (created.status === "REJECTED") {
        setTextCheckStatus("failed");
        setVideoCheckStatus("failed");
        setErrorMessage(created.rejectionReason || "The exercise did not pass the automatic checks.");
        toast.error("Exercise rejected. Review the reason and update your submission.");
        return;
      }
      setTextCheckStatus("passed");
      setVideoCheckStatus("passed");
      toast.success("Exercise created successfully!");
      setSuccessMessage("Automatic checks passed. Sent to the Content Manager review queue.");
      setTimeout(() => {
        navigate("/library/personal?status=pending");
      }, 1000);
    } catch (err) {
      setTextCheckStatus("failed");
      setVideoCheckStatus("failed");
      const responseData = err?.response?.data;
      const errorMsg = typeof responseData === "string"
        ? responseData
        : responseData?.message || getApiErrorMessage(err, "Could not save the exercise.");
      console.error("Create exercise failed:", err?.response || err);
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
      alert(errorMsg);
    } finally {
      submissionLock.current = false;
      setIsCreating(false);
    }
  };

  return (
    <div className="create-personal-exercise-page w-full max-w-5xl mx-auto space-y-6 pb-16 text-white">
      <style>{`
        .create-personal-exercise-page,
        .create-personal-exercise-page * {
          font-family: Arial, sans-serif;
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
            aria-label="Dismiss error message"
            className="ml-2 inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-rose-200 shadow-none transition-colors hover:bg-rose-900/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
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
              {title.length}/50
            </span>
          </div>
          <input
            type="text"
            id="exercise-title"
            maxLength={50}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            onBlur={() => {
              markFieldTouched("title");
              setTitle((value) => value.trim());
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
            }}
            onBlur={() => {
              markFieldTouched("description");
              setDescription((value) => value.trim());
            }}
            placeholder="What does this exercise train, and who is it for?"
            className={`w-full rounded-xl border ${showFieldError("description") && validationErrors.description ? "border-rose-500 focus:border-rose-500" : "border-[#231b46] focus:border-[#7c3aed]"} bg-[#0c0820] p-4 text-xs text-white placeholder-slate-500 h-28 resize-none focus:outline-none transition-colors leading-relaxed`}
          />
          {showFieldError("description") && validationErrors.description && <p className="text-rose-400 text-[11px] mt-1">{validationErrors.description}</p>}
        </div>

        <div>
          <fieldset
            id="exercise-muscle-groups"
            tabIndex={-1}
            aria-invalid={Boolean(hasSubmitted && targetMuscles.length === 0)}
            className={`m-0 min-w-0 rounded-2xl border-0 bg-[#0c0820]/70 p-4 outline-none transition-colors ${
              hasSubmitted && targetMuscles.length === 0
                ? "ring-1 ring-rose-500"
                : "ring-1 ring-[#2b2257]"
            }`}
          >
            <legend className="mb-1 flex w-full flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-200">
              Primary &amp; secondary muscle groups
              <span className="rounded-full border border-[#3b2c70] bg-[#17102f] px-2.5 py-1 text-[10px] font-semibold text-violet-200">
                {targetMuscles.length} selected
              </span>
            </legend>
            <p className="mb-3 text-[11px] leading-relaxed text-slate-500">Choose all muscle groups this exercise targets.</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {["Chest", "Back", "Shoulders", "Arms", "Core", "Legs", "Full Body"].map((muscleGroup) => (
                <label key={muscleGroup} className="group cursor-pointer">
                  <input
                    type="checkbox"
                    checked={targetMuscles.includes(muscleGroup)}
                    onChange={() => toggleMuscleGroup(muscleGroup)}
                    className="peer sr-only"
                  />
                  <span
                    className={`flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-violet-400 ${
                      targetMuscles.includes(muscleGroup)
                        ? "border-violet-500/70 bg-violet-500/15 text-violet-100"
                        : "border-[#2b2257] bg-[#100b24] text-slate-300 group-hover:border-[#59458f] group-hover:bg-[#17102f]"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border text-[10px] leading-none transition-colors ${
                        targetMuscles.includes(muscleGroup)
                          ? "border-violet-400 bg-violet-500 text-white"
                          : "border-slate-600 bg-[#0c0820] text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    {muscleGroup}
                  </span>
                </label>
              ))}
            </div>
            {hasSubmitted && targetMuscles.length === 0 && <p className="mt-3 text-[11px] text-rose-400">Choose at least one muscle group.</p>}
          </fieldset>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-300" htmlFor="exercise-anatomy-image">
            Anatomy image <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input
            ref={anatomyInputRef}
            id="exercise-anatomy-image"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={handleAnatomyImageSelect}
            className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-[#211844] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-violet-200"
          />
          {anatomyImageFile && (
            <div className="mt-3 flex items-center gap-3">
              <img src={anatomyPreview} alt="Anatomy preview" className="h-20 w-20 rounded-lg border border-[#44366f] object-cover" />
              <div className="min-w-0">
                <p className="truncate text-xs text-slate-200">{anatomyImageFile.name}</p>
                <button
                  type="button"
                  onClick={() => { setAnatomyImageFile(null); if (anatomyInputRef.current) anatomyInputRef.current.value = ""; }}
                  className="mt-2 inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-950/60 px-2.5 py-1 text-[11px] font-semibold text-rose-200 transition-colors hover:border-rose-400 hover:bg-rose-900/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  <span aria-hidden="true">×</span>
                  Remove image
                </button>
              </div>
            </div>
          )}
          <p className="mt-1 text-[11px] text-slate-500">JPG, PNG, or WebP · up to 10 MB</p>
        </div>

        {/* Count type and exercise dosage */}
        <div className="space-y-3">
          <span className="block text-xs font-medium text-slate-300 mb-1.5">
            Count type
          </span>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "reps_sets", label: "Set & Rep" },
              { value: "duration", label: "Duration" },
            ].map((option) => {
              const isSelected = countType === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setCountType(option.value)}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                    isSelected
                      ? "border-[#9b83ff] bg-[#643bf6] text-white"
                      : "border-[#44366f] bg-[#100b26] text-slate-400 hover:border-[#8068c4]"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {countType === "reps_sets" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block text-xs font-medium text-slate-300">
                <span className="mb-1.5 block">Sets</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={sets}
                  onChange={(event) => setSets(Number(event.target.value))}
                  className="w-full rounded-xl border border-[#44366f] bg-[#100b26] px-4 py-2.5 text-sm text-white outline-none focus:border-[#9b83ff]"
                />
              </label>
              <label className="block text-xs font-medium text-slate-300">
                <span className="mb-1.5 block">Reps</span>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={reps}
                  onChange={(event) => setReps(Number(event.target.value))}
                  className="w-full rounded-xl border border-[#44366f] bg-[#100b26] px-4 py-2.5 text-sm text-white outline-none focus:border-[#9b83ff]"
                />
              </label>
            </div>
          ) : (
            <label className="block text-xs font-medium text-slate-300">
              <span className="mb-1.5 block">Duration (seconds)</span>
              <input
                type="number"
                min="1"
                max="3600"
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
                className="w-full rounded-xl border border-[#44366f] bg-[#100b26] px-4 py-2.5 text-sm text-white outline-none focus:border-[#9b83ff]"
              />
            </label>
          )}
        </div>

        {/* Level */}
        <div>
          <label className="block text-xs text-slate-400 mb-2">Level</label>
          <div id="exercise-level" tabIndex={-1} className={`grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl ${showFieldError("level") && validationErrors.level ? "ring-1 ring-rose-500" : ""}`}>
            {/* Beginner */}
            <div
              tabIndex={0}
              onBlur={() => markFieldTouched("level")}
              onClick={() => {
                setLevel("Beginner");
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
              tabIndex={0}
              onBlur={() => markFieldTouched("level")}
              onClick={() => {
                setLevel("Intermediate");
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
              tabIndex={0}
              onBlur={() => markFieldTouched("level")}
              onClick={() => {
                setLevel("Advanced");
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
                  }}
                  onBlur={() => markFieldTouched(`step-${index}`)}
                  maxLength={250}
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
          Video format and file integrity are checked automatically. Approved
          files are sent to the review queue; keep your whole body in frame.
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

          {/* 2. Video file check */}
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
                  Video file check
                </h3>
                {videoCheckStatus === "checking" && (
                  <span className="text-[10px] text-purple-400 font-semibold animate-pulse">
                    Checking video format...
                  </span>
                )}
                {videoCheckStatus === "passed" && (
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    Passed
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                The video file is checked for an accepted format and readable container.
              </p>
            </div>
          </div>
        </div>

        {/* Ghi chú */}
        <p className="text-[11px] text-slate-500">
          Both checks run when you press Create. Passing submissions are sent
          to the review queue.
        </p>
      </section>

      {/* F. THANH HÀNH ĐỘNG Ở ĐÁY (BOTTOM ACTIONS) */}
      <div className="flex items-center justify-end gap-3 pt-4">
        {/* Nút Cancel */}
        <button
          type="button"
          onClick={() => setConfirmCancel(true)}
          className="rounded-xl border border-[#2b2257] bg-[#141030] hover:bg-[#1f1847] text-slate-300 hover:text-white text-xs font-semibold px-6 py-2.5 transition-colors cursor-pointer"
        >
          Cancel
        </button>

        {/* Nút Create */}
        <button
          type="button"
          disabled={isCreating}
          onClick={handleCreate}
          className="rounded-xl bg-[#643bf6] hover:bg-[#522cd9] text-white text-xs font-semibold px-7 py-2.5 shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-2 disabled:cursor-wait disabled:opacity-100"
        >
          {isCreating && (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          )}
          <span>{isCreating ? "Scanning & Creating..." : "Create"}</span>
        </button>
      </div>
      <ConfirmDialog
        open={confirmCancel}
        title="Discard this exercise?"
        message="Are you sure you want to cancel? Your unsaved exercise details will be lost."
        confirmLabel="Discard"
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => navigate(-1)}
      />
    </div>
  );
}
