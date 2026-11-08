import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  checkPersonalExerciseText,
  createPersonalExercise,
  getMaintenanceServiceStatus,
} from "../api/library";
import ConfirmDialog from "../components/common/ConfirmDialog";
import useVideoSafetyScan from "../hooks/useVideoSafetyScan";
import { getLevelLabel } from "../utils/levelLabel";
import { useSystemLevels } from "../useSystemLevels";
import {
  getApiErrorMessage,
  validatePersonalExercise,
  validateVideoFile,
} from "./libraryFormValidation";

export default function CreatePersonalExercisePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const anatomyInputRef = useRef(null);
  const submissionLock = useRef(false);

  // Sync document title to match mockup window header: CalisHealth - Library
  useEffect(() => {
    document.title = t("member.library.documentTitle");
    return () => {
      document.title = "CalisHealth";
    };
  }, [t]);

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
  const [level, setLevel] = useState("");
  const [guideSteps, setGuideSteps] = useState([
    t("member.personal.defaultFirstStep"),
    "",
  ]);
  const [videoFile, setVideoFile] = useState(null);
  const [videoUploadsUnderMaintenance, setVideoUploadsUnderMaintenance] = useState(false);
  const [maintenanceStatusLoading, setMaintenanceStatusLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  // Level do Content Manager cấu hình động nên danh sách level lấy từ hệ thống.
  const { activeLevels } = useSystemLevels();
  const levelChoices = activeLevels.map((name) => ({
    name,
    label: getLevelLabel(name),
    description: "",
  }));
  // Mặc định chọn level dễ nhất đang active.
  useEffect(() => {
    setLevel((current) => {
      if (current && activeLevels.some((name) => name.toLowerCase() === current.toLowerCase())) {
        return current;
      }
      return activeLevels[0] || "";
    });
  }, [activeLevels]);

  /** Quét MediaPipe: video phải có người + chuyển động rõ ràng mới được gửi. */
  const videoScan = useVideoSafetyScan({ file: videoFile });
  const {
    status: videoScanStatus,
    progress: videoScanProgress,
    reason: videoScanReason,
    scan: runVideoScan,
    reset: resetVideoScan,
  } = videoScan;
  useEffect(() => {
    let cancelled = false;
    getMaintenanceServiceStatus("MEMBER_VIDEO_UPLOADS")
      .then((status) => {
        if (!cancelled) {
          setVideoUploadsUnderMaintenance(status?.isUnderMaintenance === true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVideoUploadsUnderMaintenance(false);
          toast.warning(t("member.personal.maintenanceStatusUnknown"));
        }
      })
      .finally(() => {
        if (!cancelled) setMaintenanceStatusLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (videoUploadsUnderMaintenance) setVideoFile(null);
  }, [videoUploadsUnderMaintenance]);
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
  const [flaggedWords, setFlaggedWords] = useState([]);
  const [textCheckError, setTextCheckError] = useState("");
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
  const resetTextCheck = () => {
    setTextCheckStatus("idle");
    setFlaggedWords([]);
    setTextCheckError("");
  };
  const getTextCheckErrorMessage = (error) => {
    const status = error?.response?.status;
    if (!error?.response) {
      return t("member.personal.textCheckApiUnreachable");
    }
    if (status === 404) {
      return t("member.personal.textCheckApiMissing");
    }
    const responseData = error.response.data;
    const detail = typeof responseData === "string"
      ? responseData
      : responseData?.message;
    return detail
      ? t("member.personal.textCheckFailedHttp", { status, detail })
      : t("member.personal.textCheckFailedHttpGeneric", { status });
  };
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
    resetTextCheck();
    setGuideSteps((prev) =>
      prev.map((step, idx) => (idx === index ? value : step))
    );
  };

  const handleAddStep = () => {
    resetTextCheck();
    setGuideSteps((prev) => [...prev, ""]);
  };

  const handleRemoveStep = (index) => {
    if (guideSteps.length <= 1) return;
    resetTextCheck();
    setGuideSteps((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Video upload handlers
  const handleFileSelect = (e) => {
    if (videoUploadsUnderMaintenance || maintenanceStatusLoading) return;
    markFieldTouched("video");
    const file = e.target.files?.[0];
    if (file) {
      setErrorMessage("");
      const fileError = validateVideoFile(file);
      if (fileError) {
        toast.error(fileError);
        e.target.value = "";
        return;
      }
      setVideoFile(file);
      // Đổi file thì kết quả quét cũ không còn giá trị.
      resetVideoScan();
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (videoUploadsUnderMaintenance || maintenanceStatusLoading) return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (videoUploadsUnderMaintenance || maintenanceStatusLoading) return;
    markFieldTouched("video");
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setErrorMessage("");
      const fileError = validateVideoFile(file);
      if (fileError) {
        toast.error(fileError);
        return;
      }
      setVideoFile(file);
      resetVideoScan();
    }
  };

  const handleAnatomyImageSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      toast.error(t("member.personal.imageTypeError"));
      event.target.value = "";
      return;
    }
    setAnatomyImageFile(file);
  };

  const toggleMuscleGroup = (muscleGroup) => {
    resetTextCheck();
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
    if (videoUploadsUnderMaintenance) {
      const message = t("member.personal.maintenanceWarning");
      setErrorMessage(message);
      toast.warning(message);
      return;
    }
    if (maintenanceStatusLoading) {
      toast.info(t("member.personal.checkingAvailability"));
      return;
    }
    if (submissionLock.current) return;
    if (Object.keys(validationErrors).length > 0 || targetMuscles.length === 0) {
      setErrorMessage("");
      toast.warning(t("member.personal.fillRequiredFields"));
      focusFirstInvalidField(validationErrors);
      return;
    }
    submissionLock.current = true;
    setErrorMessage("");
    setTextCheckError("");
    setIsCreating(true);
    setTextCheckStatus("checking");

    let textScanComplete = false;
    try {
      // Bước 1: quét video bằng MediaPipe — bắt buộc có người + chuyển động.
      if (videoFile && videoScanStatus !== "passed") {
        setVideoCheckStatus("checking");
        const scanResult = await runVideoScan();
        if (!scanResult.passed) {
          setVideoCheckStatus("failed");
          const message = videoScanMessage(scanResult.reason);
          setErrorMessage(message);
          toast.error(message);
          setIsCreating(false);
          submissionLock.current = false;
          return;
        }
        setVideoCheckStatus("passed");
      }

      // Bước 2: quét nội dung chữ.
      const textCheck = await checkPersonalExerciseText({
        title,
        description,
        guideSteps,
        targetMuscle: targetMuscles.join(", "),
      });
      textScanComplete = true;
      const matches = Array.isArray(textCheck.flaggedWords) ? textCheck.flaggedWords : [];
      setFlaggedWords(matches);
      setTextCheckStatus(matches.length > 0 ? "failed" : "passed");
      if (matches.length > 0) return;

      setVideoCheckStatus("checking");
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
        setErrorMessage(created.rejectionReason || t("member.personal.exerciseDidNotPass"));
        toast.error(t("member.personal.exerciseRejected"));
        return;
      }
      setTextCheckStatus("passed");
      setVideoCheckStatus("passed");
      toast.success(t("member.personal.exerciseCreated"));
      setSuccessMessage(t("member.personal.autoChecksPassed"));
      setTimeout(() => {
        navigate("/library/personal?status=pending");
      }, 1000);
    } catch (err) {
      if (!textScanComplete) {
        setTextCheckStatus("failed");
        setTextCheckError(getTextCheckErrorMessage(err));
        return;
      }
      const responseData = err?.response?.data;
      const errorMsg = typeof responseData === "string"
        ? responseData
        : responseData?.message || getApiErrorMessage(err, t("member.personal.couldNotSaveExercise"));
      if (err?.response?.status === 503) {
        setVideoCheckStatus("failed");
        setErrorMessage(errorMsg);
        return;
      }
      const flaggedWordsMatch = errorMsg.match(/Flagged words:\s*(.+)$/i);
      if (flaggedWordsMatch) {
        setFlaggedWords(flaggedWordsMatch[1].split(",").map((word) => word.trim()).filter(Boolean));
        setTextCheckStatus("failed");
        setVideoCheckStatus("idle");
        return;
      }
      setVideoCheckStatus("failed");
      console.error("Create exercise failed:", err?.response || err);
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
      alert(errorMsg);
    } finally {
      submissionLock.current = false;
      setIsCreating(false);
    }
  };

  /** Dịch mã lý do của bước quét MediaPipe sang thông báo hiển thị. */
  const videoScanMessage = (reason) => {
    switch (reason) {
      case "no-person":
        return t("member.videoScan.noPerson");
      case "no-motion":
        return t("member.videoScan.noMotion");
      case "too-short":
        return t("member.videoScan.tooShort", { seconds: 2 });
      case "too-long":
        return t("member.videoScan.tooLong", { seconds: 180 });
      case "unreadable":
        return t("member.videoScan.unreadable");
      default:
        return t("member.videoScan.failed");
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
          {t("member.personal.createExerciseTitle")}
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          {t("member.personal.createExerciseSubtitle")}
        </p>
      </header>

      {/* Alert notifications */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs flex items-center justify-between shadow-sm">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage("")}
            aria-label={t("member.personal.dismissError")}
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
        <h2 className="text-sm font-semibold text-white">{t("member.personal.exerciseDetails")}</h2>

        {/* Title */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300">
              {t("member.personal.title")}
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
              resetTextCheck();
              setTitle(e.target.value);
            }}
            onBlur={() => {
              markFieldTouched("title");
              setTitle((value) => value.trim());
            }}
            placeholder={t("member.personal.exerciseTitlePlaceholder")}
            className={`w-full rounded-xl border ${showFieldError("title") && validationErrors.title ? "border-rose-500 focus:border-rose-500" : "border-[#231b46] focus:border-[#7c3aed]"} bg-[#0c0820] px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors`}
          />
          {showFieldError("title") && validationErrors.title && <p className="text-rose-400 text-[11px] mt-1">{validationErrors.title}</p>}
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300">
              {t("member.personal.descriptionField")}
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
              resetTextCheck();
              setDescription(e.target.value);
            }}
            onBlur={() => {
              markFieldTouched("description");
              setDescription((value) => value.trim());
            }}
            placeholder={t("member.personal.exerciseDescPlaceholder")}
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
              {t("member.personal.muscleGroups")}
              <span className="rounded-full border border-[#3b2c70] bg-[#17102f] px-2.5 py-1 text-[10px] font-semibold text-violet-200">
                {t("member.personal.selectedCount", { count: targetMuscles.length })}
              </span>
            </legend>
            <p className="mb-3 text-[11px] leading-relaxed text-slate-500">{t("member.personal.chooseMuscleGroups")}</p>
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
            {hasSubmitted && targetMuscles.length === 0 && <p className="mt-3 text-[11px] text-rose-400">{t("member.personal.chooseAtLeastOneMuscle")}</p>}
          </fieldset>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-300" htmlFor="exercise-anatomy-image">
            {t("member.personal.anatomyImageOptional")}
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
              <img src={anatomyPreview} alt={t("member.personal.anatomyPreviewAlt")} className="h-20 w-20 rounded-lg border border-[#44366f] object-cover" />
              <div className="min-w-0">
                <p className="truncate text-xs text-slate-200">{anatomyImageFile.name}</p>
                <button
                  type="button"
                  onClick={() => { setAnatomyImageFile(null); if (anatomyInputRef.current) anatomyInputRef.current.value = ""; }}
                  className="mt-2 inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-950/60 px-2.5 py-1 text-[11px] font-semibold text-rose-200 transition-colors hover:border-rose-400 hover:bg-rose-900/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  <span aria-hidden="true">×</span>
                  {t("member.personal.removeImage")}
                </button>
              </div>
            </div>
          )}
          <p className="mt-1 text-[11px] text-slate-500">{t("member.personal.anatomyHint")}</p>
        </div>

        {/* Count type and exercise dosage */}
        <div className="space-y-3">
          <span className="block text-xs font-medium text-slate-300 mb-1.5">
            {t("member.personal.countType")}
          </span>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "reps_sets", label: t("member.personal.setAndRep") },
              { value: "duration", label: t("member.personal.duration") },
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
                <span className="mb-1.5 block">{t("member.personal.sets")}</span>
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
                <span className="mb-1.5 block">{t("member.personal.reps")}</span>
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
              <span className="mb-1.5 block">{t("member.personal.durationSeconds")}</span>
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
          <label className="block text-xs text-slate-400 mb-2">{t("member.personal.level")}</label>
          <div id="exercise-level" tabIndex={-1} className={`grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl ${showFieldError("level") && validationErrors.level ? "ring-1 ring-rose-500" : ""}`}>
            {/* Level do Content Manager cấu hình động nên danh sách lấy từ hệ thống. */}
            {levelChoices.map((choice) => (
              <div
                key={choice.name}
                tabIndex={0}
                onBlur={() => markFieldTouched("level")}
                onClick={() => {
                  setLevel(choice.name);
                }}
                className={`rounded-xl p-3.5 flex items-start justify-between cursor-pointer transition-all select-none ${
                  level === choice.name
                    ? "border border-[#8b6cff] bg-[#2a1d5d] shadow-md shadow-purple-900/40"
                    : "border border-[#493b79] bg-[#0c0820] hover:border-[#8b6cff]"
                }`}
              >
                <div>
                  <h3 className="text-xs font-semibold text-white">{choice.label}</h3>
                  {choice.description && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      {choice.description}
                    </p>
                  )}
                </div>
                <div
                  className={`w-4 h-4 self-center rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    level === choice.name
                      ? "bg-[#643bf6] border-2 border-[#c4b5fd] shadow-[0_0_0_3px_rgba(100,59,246,0.2)]"
                      : "border-2 border-[#8b7ab8] bg-[#17112f]"
                  }`}
                >
                  {level === choice.name && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
              </div>
            ))}
            {showFieldError("level") && validationErrors.level && <p className="text-rose-400 text-[11px] mt-1">{validationErrors.level}</p>}
          </div>
        </div>
      </section>

      {/* C. KHỐI 2: GUIDE */}
      <section className="rounded-2xl border border-[#231b46] bg-[#120d29]/90 p-6 space-y-4 shadow-xl">
        <h2 className="text-sm font-semibold text-white">{t("member.personal.guide")}</h2>

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
                      ? t("member.personal.stepPlaceholderFirst")
                      : t("member.personal.stepPlaceholderNext")
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
                  aria-label={t("member.personal.removeStepAria")}
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
            <span>{t("member.personal.addStep")}</span>
          </button>
        </div>

        {/* Chú thích */}
        <p className="text-[11px] text-slate-500 mt-2">
          {t("member.personal.guideNote")}
        </p>
      </section>

      {/* D. KHỐI 3: DEMO VIDEO */}
      <section className="rounded-2xl border border-[#231b46] bg-[#120d29]/90 p-6 space-y-3 shadow-xl">
        <h2 className="text-sm font-semibold text-white">{t("member.personal.demoVideo")}</h2>

        {/* Dropzone container */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
          onChange={handleFileSelect}
          disabled={videoUploadsUnderMaintenance || maintenanceStatusLoading}
          className="hidden"
        />

        {videoUploadsUnderMaintenance && (
          <div
            role="alert"
            className="rounded-xl border border-amber-400/50 bg-amber-500/15 px-4 py-3 text-xs font-medium text-amber-200"
          >
            {t("member.personal.videoMaintenanceNotice")}
          </div>
        )}

        <div
          id="exercise-video"
          tabIndex={-1}
          onClick={() => {
            if (!videoUploadsUnderMaintenance && !maintenanceStatusLoading) {
              fileInputRef.current?.click();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-disabled={videoUploadsUnderMaintenance || maintenanceStatusLoading}
          className={`rounded-2xl border border-dashed p-8 flex flex-col items-center justify-center transition-all select-none ${
            videoUploadsUnderMaintenance || maintenanceStatusLoading
              ? "cursor-not-allowed border-[#5b32e8]/40 bg-[#161036]/30 opacity-60"
              : isDragging
              ? "border-[#a855f7] bg-[#22174c]/60"
              : "cursor-pointer border-[#5b32e8]/60 bg-[#161036]/40 hover:bg-[#1a1340]/60"
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
            {videoFile ? videoFile.name : t("member.personal.clickToUploadVideo")}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1 text-center">
            {videoFile
              ? t("member.personal.changeVideoHint", {
                  size: (videoFile.size / (1024 * 1024)).toFixed(1),
                })
              : t("member.personal.videoHint")}
          </p>

          {/* Trạng thái quét MediaPipe */}
          {videoFile && videoScanStatus !== "idle" && (
            <div className="mt-4 w-full max-w-md space-y-2">
              <div className="flex items-center gap-2 text-[11px]">
                {videoScanStatus === "scanning" && (
                  <>
                    <div className="w-3 h-3 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
                    <span className="text-purple-300">
                      {t("member.videoScan.scanning")}
                    </span>
                    <span className="text-slate-400 ml-auto">{videoScanProgress}%</span>
                  </>
                )}
                {videoScanStatus === "passed" && (
                  <>
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-emerald-300">
                      {t("member.videoScan.passed")}
                    </span>
                  </>
                )}
                {videoScanStatus === "failed" && (
                  <>
                    <div className="w-3 h-3 rounded-full bg-rose-500" />
                    <span className="text-rose-300">
                      {t("member.videoScan.failed")}
                    </span>
                  </>
                )}
              </div>

              {videoScanStatus === "scanning" && (
                <div className="h-1 w-full rounded-full bg-[#241b4d] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all"
                    style={{ width: `${videoScanProgress}%` }}
                  />
                </div>
              )}

              {videoScanStatus === "failed" && videoScanReason && (
                <p className="text-[11px] text-rose-300/90">
                  {videoScanMessage(videoScanReason)}
                </p>
              )}

              {videoScanStatus === "passed" && (
                <p className="text-[11px] text-slate-400">
                  {t("member.videoScan.passedHint")}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Chú thích */}
        <p className="text-[11px] text-slate-500">
          {t("member.personal.contentCheckNote")}
        </p>
      </section>

      {/* E. KHỐI 4: CONTENT CHECK (HỆ THỐNG TỰ ĐỘNG QUÉT - KHÔNG THỂ TỰ TÍCH CHỌN THỦ CÔNG) */}
      <section className="rounded-2xl border border-[#231b46] bg-[#120d29]/90 p-6 space-y-4 shadow-xl">
        <h2 className="text-sm font-semibold text-white">{t("member.personal.contentCheck")}</h2>

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
              ) : textCheckStatus === "failed" ? (
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white">
                  <span className="text-[10px] font-bold leading-none">!</span>
                </div>
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-[#9d7aff] bg-[#1b1438] shadow-[0_0_0_3px_rgba(100,59,246,0.14)]" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-medium text-white">{t("member.personal.textCheck")}</h3>
                {textCheckStatus === "checking" && (
                  <span className="text-[10px] text-purple-400 font-semibold animate-pulse">
                    {t("member.personal.scanningText")}
                  </span>
                )}
                {textCheckStatus === "passed" && (
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    {t("member.personal.passed")}
                  </span>
                )}
                {textCheckStatus === "failed" && (
                  <span className="text-[10px] text-rose-300 font-semibold">
                    {textCheckError ? t("member.personal.checkUnavailable") : t("member.personal.needsRevision")}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t("member.personal.textCheckDesc")}
              </p>
              {flaggedWords.length > 0 && (
                <div role="alert" className="mt-2 rounded-lg border border-rose-800/70 bg-rose-950/40 p-2.5 text-[11px] text-rose-200">
                  <p className="font-semibold">{t("member.personal.bannedWords")}</p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {flaggedWords.map((word) => (
                      <li
                        key={word}
                        className="rounded-md border border-rose-700/70 bg-rose-900/50 px-2 py-1 font-bold text-rose-100"
                      >
                        {word}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {textCheckError && (
                <p role="alert" className="mt-1.5 text-[11px] text-rose-300">
                  {textCheckError}
                </p>
              )}
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
                  {t("member.videoScan.title")}
                </h3>
                {videoScanStatus === "scanning" && (
                  <span className="text-[10px] text-purple-400 font-semibold animate-pulse">
                    {t("member.videoScan.scanning")}
                  </span>
                )}
                {videoScanStatus === "passed" && (
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    {t("member.videoScan.passed")}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {videoScanStatus === "failed" && videoScanReason
                  ? videoScanMessage(videoScanReason)
                  : t("member.videoScan.passedHint")}
              </p>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          {t("member.personal.contentCheckNote")}
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
          {t("member.personal.cancel")}
        </button>

        {/* Nút Create */}
        <button
          type="button"
          disabled={isCreating || videoUploadsUnderMaintenance || maintenanceStatusLoading}
          onClick={handleCreate}
          className="rounded-xl bg-[#643bf6] hover:bg-[#522cd9] text-white text-xs font-semibold px-7 py-2.5 shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCreating && (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          )}
          <span>{isCreating ? t("member.personal.scanningCreating") : t("member.personal.create")}</span>
        </button>
      </div>
      <ConfirmDialog
        open={confirmCancel}
        title={t("member.personal.discardExerciseTitle")}
        message={t("member.personal.discardExerciseMessage")}
        confirmLabel={t("member.personal.discard")}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => navigate(-1)}
      />
    </div>
  );
}
