import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import ConfirmDialog from '../components/common/ConfirmDialog';
import {
  getApiErrorMessage,
  validatePersonalExercise,
  validateVideoFile,
} from './libraryFormValidation';
import {
  getPersonalExercise,
  resubmitPersonalExercise,
  updateAcceptedPersonalExercise,
} from '../api/library';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

function libraryMediaUrl(value) {
  if (!value) return null;
  try {
    return new URL(value, new URL(API_URL, window.location.origin)).toString();
  } catch {
    return value;
  }
}

/* Icons */
function BarbellIcon({ className = 'h-5 w-5 text-[#9d7aff]' }) {
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
function XIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M6.293 6.293a1 1 0 011.414 0L10 8.586l2.293-2.293a1 1 0 111.414 1.414L11.414 10l2.293 2.293a1 1 0 01-1.414 1.414L10 11.414l-2.293 2.293a1 1 0 01-1.414-1.414L8.586 10 6.293 7.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}
function CheckCircleIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  );
}

function parseMuscleGroups(value) {
  const knownGroups = new Map([
    ['chest', 'Chest'],
    ['back', 'Back'],
    ['shoulders', 'Shoulders'],
    ['arms', 'Arms'],
    ['biceps', 'Arms'],
    ['triceps', 'Arms'],
    ['forearms', 'Arms'],
    ['core', 'Core'],
    ['abs', 'Core'],
    ['legs', 'Legs'],
    ['quads', 'Legs'],
    ['hamstrings', 'Legs'],
    ['glutes', 'Legs'],
    ['calves', 'Legs'],
    ['full body', 'Full Body'],
  ]);
  return [...new Set(
    String(value || 'Full Body')
      .split(/[,;|]/)
      .map((group) => group.trim())
      .filter(Boolean)
      .map((group) => knownGroups.get(group.toLowerCase()) || group),
  )];
}

export default function UpdatePersonalExercisePage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);
  const anatomyInputRef = useRef(null);
  const submissionLock = useRef(false);

  const [exercise, setExercise] = useState(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('Beginner');
  const [guide, setGuide] = useState(['']);
  const [video, setVideo] = useState(null);
  const [replaceVideo, setReplaceVideo] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [targetMuscles, setTargetMuscles] = useState([]);
  const [anatomyImageFile, setAnatomyImageFile] = useState(null);
  const [anatomyPreview, setAnatomyPreview] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [baseline, setBaseline] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [touchedFields, setTouchedFields] = useState({});

  useEffect(() => {
    if (!anatomyImageFile) {
      setAnatomyPreview('');
      return undefined;
    }
    const previewUrl = URL.createObjectURL(anatomyImageFile);
    setAnatomyPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [anatomyImageFile]);

  useEffect(() => {
    let active = true;
    setErrorMessage('');
    const mockExercise = location.state?.exercise;
    if (mockExercise?.isMock) {
      const initialGuide = Array.isArray(mockExercise.guideSteps)
        ? mockExercise.guideSteps
        : [];
      const initialState = {
        title: mockExercise.title || '',
        description: mockExercise.description || '',
        level: mockExercise.level || 'Beginner',
        guide: initialGuide,
        video: mockExercise.video || null,
        targetMuscles: parseMuscleGroups(mockExercise.targetMuscle),
      };
      setExercise({
        ...mockExercise,
        guideSteps: initialGuide,
        reason: mockExercise.reason,
      });
      setTitle(initialState.title);
      setDescription(initialState.description);
      setLevel(initialState.level);
      setGuide(initialState.guide);
      setVideo(initialState.video);
      setTargetMuscles(initialState.targetMuscles);
      setBaseline(JSON.stringify(initialState));
      return () => {
        active = false;
      };
    }

    getPersonalExercise(id)
      .then((currentExercise) => {
        if (!active) return;
        const initialGuide = Array.isArray(currentExercise.guideSteps)
          ? currentExercise.guideSteps
          : [];
        const initialState = {
          title: currentExercise.title || '',
          description: currentExercise.description || '',
          level: currentExercise.level || 'Beginner',
          guide: initialGuide,
          video: currentExercise.videoUrl
            ? { name: currentExercise.videoUrl.split('/').pop(), size: 'Uploaded' }
            : null,
          targetMuscles: parseMuscleGroups(currentExercise.targetMuscle),
        };
        setExercise({
          ...currentExercise,
          guide: initialGuide,
          reason: currentExercise.rejectionReason,
        });
        setTitle(initialState.title);
        setDescription(initialState.description);
        setLevel(initialState.level);
        setGuide(initialState.guide);
        setVideo(initialState.video);
        setTargetMuscles(initialState.targetMuscles);
        setBaseline(JSON.stringify(initialState));
      })
      .catch((error) => {
        if (!active) return;
        setExercise(null);
        setErrorMessage(
          error?.response?.data?.message || t("member.personal.couldNotLoadExercise")
        );
      });
    return () => {
      active = false;
    };
  }, [id, location.state]);

  const currentState = JSON.stringify({ title, description, level, guide, video, targetMuscles });
  const isDirty = baseline !== '' && (
    currentState !== baseline || uploadedFile !== null || anatomyImageFile !== null
  );
  const validationErrors = validatePersonalExercise({
    title,
    description,
    level,
    steps: guide,
    videoFile: uploadedFile,
    requireVideo: !video && !uploadedFile,
  });
  const showFieldError = (field) =>
    Boolean((hasSubmitted || touchedFields[field]) && validationErrors[field]);
  const markFieldTouched = (field) =>
    setTouchedFields((current) => ({ ...current, [field]: true }));
  const focusFirstInvalidField = (errors) => {
    const firstInvalidId = errors.title
      ? 'exercise-title'
      : errors.description
        ? 'exercise-description'
        : errors.level
          ? 'exercise-level'
          : errors.steps
            ? 'guide-step-list'
            : guide.findIndex((_, index) => errors[`step-${index}`]) >= 0
              ? `guide-step-${guide.findIndex((_, index) => errors[`step-${index}`])}`
              : errors.video
                ? 'exercise-video'
                : null;
    const firstInvalid = firstInvalidId && document.getElementById(firstInvalidId);
    firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    firstInvalid?.focus();
  };

  const handleAddStep = () => setGuide((g) => [...g, '']);
  const handleGuideChange = (idx, val) => setGuide((g) => g.map((s, i) => (i === idx ? val : s)));
  const handleRemoveStep = (idx) => setGuide((g) => g.filter((_, i) => i !== idx));

  const handleVideoReplace = () => setReplaceVideo(true);

  const handleFileSelect = (e) => {
    markFieldTouched('video');
    const file = e.target.files?.[0];
    if (file) {
      setErrorMessage('');
      setUploadedFile(file);
      const fileError = validateVideoFile(file);
      if (fileError) toast.error(fileError);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    markFieldTouched('video');
    const file = event.dataTransfer.files?.[0];
    if (file) {
      setErrorMessage('');
      setUploadedFile(file);
      const fileError = validateVideoFile(file);
      if (fileError) toast.error(fileError);
    }
  };

  const toggleMuscleGroup = (muscleGroup) => {
    setTargetMuscles((current) => {
      const selected = current.includes(muscleGroup)
        ? current.filter((value) => value !== muscleGroup)
        : [...current.filter((value) => value !== 'Full Body'), muscleGroup];
      return selected;
    });
  };

  const handleAnatomyImageSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      toast.error(t("member.personal.imageTypeError"));
      event.target.value = '';
      return;
    }
    setAnatomyImageFile(file);
  };

  const charCount = (str, max) => `${str.length}/${max}`;

  const handleSave = async (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!isDirty || !exercise || submissionLock.current) return;
    setHasSubmitted(true);
    if (Object.keys(validationErrors).length > 0 || targetMuscles.length === 0) {
      toast.warning(t("member.personal.fillRequiredFields"));
      focusFirstInvalidField(validationErrors);
      return;
    }
    submissionLock.current = true;
    setSaving(true);
    setErrorMessage('');
    try {
      const request = {
        status: "PENDING",
        title: title.trim(),
        description: description.trim(),
        level: level.toUpperCase(),
        guideSteps: guide.filter((step) => step.trim()),
        targetMuscle: targetMuscles.join(', '),
        defaultSets: exercise.defaultSets || 3,
        defaultReps: exercise.defaultReps ?? null,
        defaultDuration: exercise.defaultDuration ?? null,
        keepCurrentVideo: Boolean(video && !uploadedFile),
      };
      if (exercise.isMock) {
        const mockPendingExercise = {
          ...exercise,
          ...request,
          title: request.title,
          description: request.description,
          level,
          guideSteps: request.guideSteps,
          status: "PENDING",
          rejectionReason: null,
          reason: undefined,
          meta: t("member.customExercise.resendMeta", {
            muscle: exercise.targetMuscle || t("member.customExercise.defaultMuscle"),
            sets: request.defaultSets,
            duration:
              request.defaultDuration != null
                ? t("member.customExercise.durationSeconds", { seconds: request.defaultDuration })
                : t("member.customExercise.durationReps", { reps: request.defaultReps }),
          }).concat(` · ${t("member.customExercise.submittedJustNow")}`),
          scanText: t("member.customExercise.waitingForReview"),
        };
        sessionStorage.setItem(
          "calishealth.mock-resubmitted-exercise",
          JSON.stringify(mockPendingExercise)
        );
        toast.success(t("member.personal.exerciseResubmitted"));
        navigate('/library/personal?status=pending');
        return;
      }

      const isAcceptedEdit = exercise.status === 'ACCEPTED';
      const updatedExercise = isAcceptedEdit
        ? await updateAcceptedPersonalExercise(id, request, uploadedFile, anatomyImageFile)
        : await resubmitPersonalExercise(id, request, uploadedFile, anatomyImageFile);
      if (updatedExercise.status === 'REJECTED') {
        toast.error(updatedExercise.rejectionReason || t("member.personal.exerciseDidNotPass"));
        navigate('/library/personal?status=rejected');
      } else if (updatedExercise.status === 'PENDING') {
        toast.success(t("member.personal.exerciseResubmitted"));
        navigate('/library/personal?status=pending');
      } else if (updatedExercise.status === 'ACCEPTED') {
        toast.success(isAcceptedEdit ? t("member.personal.updateSuccessful") : t("member.personal.exerciseApproved"), {
          style: { fontFamily: "Arial, sans-serif" },
        });
        navigate('/library/personal?status=accepted');
      } else {
        toast.success(t("member.personal.exerciseResubmitted"));
        navigate('/library/personal?status=pending');
      }
    } catch (error) {
      const responseData = error?.response?.data;
      const errorMsg = error?.response?.status === 401
        ? t("member.personal.sessionExpired")
        : typeof responseData === "string"
          ? responseData
          : responseData?.message || getApiErrorMessage(error, t("member.personal.couldNotSaveExercise"));
      console.error("Edit exercise failed:", error?.response || error);
      toast.error(errorMsg);
      setErrorMessage(errorMsg);
      alert(errorMsg);
    } finally {
      submissionLock.current = false;
      setSaving(false);
    }
  };

  if (!exercise && !errorMessage) return null;

  return (
    <div className="create-personal-exercise-page w-full max-w-5xl mx-auto space-y-6 pb-12 text-white" style={{ fontFamily: 'Arial, sans-serif' }}>
      <header className="mb-2">
        <h1 className="text-2xl font-bold text-white tracking-tight">{t("member.personal.updateExerciseTitle")}</h1>
        <p className="text-xs text-slate-400 mt-1">
          {t("member.personal.updateExerciseSubtitle")}
        </p>
      </header>

      {errorMessage && (
        <div role="alert" className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs flex items-center justify-between shadow-sm">
          {errorMessage}
        </div>
      )}

      {exercise && exercise.reason && (
        <div className="rounded-xl border border-rose-900/50 bg-[#260e14]/70 px-5 py-3 flex items-center gap-3.5">
          <span className="rounded-full px-3 py-1 text-xs font-semibold text-rose-400 bg-rose-950/80 border border-rose-800/80">{t("member.personal.rejected")}</span>
          <p className="text-xs text-rose-200/90 leading-relaxed flex-1">{exercise.reason}</p>
        </div>
      )}

      <section className="rounded-2xl border border-[#33285f] bg-[#15102e] p-6 space-y-5 shadow-xl shadow-purple-950/20">
        <h2 className="text-sm font-semibold text-white">{t("member.personal.exerciseDetails")}</h2>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300">{t("member.personal.title")}</label>
            <span className="text-xs text-slate-500 font-mono">{charCount(title, 50)}</span>
          </div>
          <input
            type="text"
            id="exercise-title"
            value={title}
            maxLength={50}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            onBlur={() => {
              markFieldTouched('title');
              setTitle((value) => value.trim());
            }}
            placeholder={t("member.personal.exerciseTitlePlaceholder")}
            className={`w-full rounded-xl border ${showFieldError('title') && validationErrors.title ? 'border-rose-500 focus:border-rose-500' : 'border-[#493b79] focus:border-[#9d7aff]'} bg-[#0d0922] px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors`}
          />
          {showFieldError('title') && validationErrors.title && <p className="text-rose-400 text-[11px] mt-1">{validationErrors.title}</p>}
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300">{t("member.personal.descriptionField")}</label>
            <span className="text-xs text-slate-500 font-mono">{charCount(description, 300)}</span>
          </div>
          <textarea
            id="exercise-description"
            value={description}
            maxLength={300}
            placeholder={t("member.personal.exerciseDescPlaceholder")}
            onChange={(e) => {
              setDescription(e.target.value);
            }}
            onBlur={() => {
              markFieldTouched('description');
              setDescription((value) => value.trim());
            }}
            className={`w-full rounded-xl border ${showFieldError('description') && validationErrors.description ? 'border-rose-500 focus:border-rose-500' : 'border-[#493b79] focus:border-[#9d7aff]'} bg-[#0d0922] p-4 text-sm text-white placeholder-slate-500 h-28 resize-none focus:outline-none transition-colors leading-relaxed`}
          />
          {showFieldError('description') && validationErrors.description && <p className="text-rose-400 text-[11px] mt-1">{validationErrors.description}</p>}
        </div>
        <fieldset className="m-0 min-w-0 rounded-2xl border-0 bg-[#0c0820]/70 p-4 ring-1 ring-[#2b2257]">
          <legend className="mb-1 flex w-full flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-200">
            {t("member.personal.muscleGroups")}
            <span className="rounded-full border border-[#3b2c70] bg-[#17102f] px-2.5 py-1 text-[10px] font-semibold text-violet-200">
              {t("member.personal.selectedCount", { count: targetMuscles.length })}
            </span>
          </legend>
          <p className="mb-3 text-[11px] leading-relaxed text-slate-500">{t("member.personal.chooseMuscleGroups")}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {['Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Legs', 'Full Body'].map((muscleGroup) => (
              <label key={muscleGroup} className="group cursor-pointer">
                <input type="checkbox" checked={targetMuscles.includes(muscleGroup)} onChange={() => toggleMuscleGroup(muscleGroup)} className="peer sr-only" />
                <span className={`flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-violet-400 ${
                  targetMuscles.includes(muscleGroup)
                    ? 'border-violet-500/70 bg-violet-500/15 text-violet-100'
                    : 'border-[#2b2257] bg-[#100b24] text-slate-300 group-hover:border-[#59458f] group-hover:bg-[#17102f]'
                }`}>
                  <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border text-[10px] leading-none transition-colors ${
                    targetMuscles.includes(muscleGroup)
                      ? 'border-violet-400 bg-violet-500 text-white'
                      : 'border-slate-600 bg-[#0c0820] text-transparent'
                  }`}>✓</span>
                  {muscleGroup}
                </span>
              </label>
            ))}
          </div>
          {targetMuscles.length === 0 && <p className="mt-1 text-[11px] text-rose-400">{t("member.personal.chooseAtLeastOneMuscle")}</p>}
        </fieldset>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-300" htmlFor="exercise-anatomy-image">{t("member.personal.anatomyImageOptional")}</label>
          <input
            ref={anatomyInputRef}
            id="exercise-anatomy-image"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={handleAnatomyImageSelect}
            className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-[#211844] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-violet-200"
          />
          {anatomyImageFile ? (
            <div className="mt-3 flex items-center gap-3">
              <img src={anatomyPreview} alt={t("member.personal.anatomyPreviewAlt")} className="h-20 w-20 rounded-lg border border-[#44366f] object-cover" />
              <div className="min-w-0">
                <p className="truncate text-xs text-slate-200">{anatomyImageFile.name}</p>
                <button type="button" onClick={() => { setAnatomyImageFile(null); if (anatomyInputRef.current) anatomyInputRef.current.value = ''; }} className="mt-1 text-xs text-rose-300 hover:text-rose-200">{t("member.personal.removeReplacement")}</button>
              </div>
            </div>
          ) : exercise?.anatomyImageUrl ? (
            <img src={exercise.anatomyImageUrl} alt={t("member.personal.currentAnatomyAlt")} className="mt-3 h-20 w-20 rounded-lg border border-[#44366f] object-cover" />
          ) : null}
          <p className="mt-1 text-[11px] text-slate-500">{t("member.personal.anatomyHint")}</p>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-2">{t("member.personal.level")}</label>
          <div id="exercise-level" tabIndex={-1} className={`grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl ${showFieldError('level') && validationErrors.level ? 'ring-1 ring-rose-500' : ''}`}>
            {[
              { name: t("member.catalog.beginner"), description: t("member.personal.levelBeginnerDesc") },
              { name: t("member.catalog.intermediate"), description: t("member.personal.levelIntermediateDesc") },
              { name: t("member.catalog.advanced"), description: t("member.personal.levelAdvancedDesc") },
            ].map(({ name, description: levelDescription }) => (
              <div
                key={name}
                role="radio"
                aria-checked={level === name}
                tabIndex={0}
                onBlur={() => markFieldTouched('level')}
                onClick={() => {
                  setLevel(name);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setLevel(name);
                  }
                }}
                className={`rounded-xl p-3.5 flex items-start justify-between cursor-pointer transition-all select-none text-left ${
                  level === name
                    ? 'border border-[#8b6cff] bg-[#2a1d5d] shadow-md shadow-purple-900/40'
                    : 'border border-[#493b79] bg-[#0d0922] hover:border-[#8b6cff]'
                }`}
              >
                <span>
                  <span className="block text-xs font-semibold text-white">{name}</span>
                  <span className="block text-[11px] text-slate-400 mt-1">{levelDescription}</span>
                </span>
                <span className={`w-4 h-4 self-center rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                  level === name ? 'bg-[#643bf6] border-2 border-[#c4b5fd] shadow-[0_0_0_3px_rgba(100,59,246,0.2)]' : 'border-2 border-[#8b7ab8] bg-[#17112f]'
                }`}>
                  {level === name && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
              </div>
            ))}
          </div>
          {showFieldError('level') && validationErrors.level && <p className="text-rose-400 text-[11px] mt-1">{validationErrors.level}</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-[#33285f] bg-[#15102e] p-6 space-y-4 shadow-xl shadow-purple-950/20">
        <h2 className="text-sm font-semibold text-white">{t("member.personal.guide")}</h2>
        <div id="guide-step-list" tabIndex={-1} className="space-y-3">
          {guide.map((step, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <span className="text-xs text-slate-500 w-4 text-center select-none font-medium">{idx + 1}</span>
            <div className="flex-1">
              <input
                type="text"
                id={`guide-step-${idx}`}
                value={step}
                onChange={(e) => {
                  handleGuideChange(idx, e.target.value);
                }}
                onBlur={() => markFieldTouched(`step-${idx}`)}
                maxLength={250}
                placeholder={idx === 0 ? t("member.personal.stepPlaceholderFirst") : t("member.personal.stepPlaceholderNext")}
                className={`w-full rounded-xl border ${showFieldError(`step-${idx}`) && validationErrors[`step-${idx}`] ? 'border-rose-500 focus:border-rose-500' : 'border-[#493b79] focus:border-[#9d7aff]'} bg-[#0d0922] px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors`}
              />
              {showFieldError(`step-${idx}`) && validationErrors[`step-${idx}`] && <p className="text-rose-400 text-[11px] mt-1">{validationErrors[`step-${idx}`]}</p>}
            </div>
              {guide.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveStep(idx)}
                  className="h-10 w-10 rounded-xl border border-rose-800/70 bg-rose-950/60 text-rose-300 hover:border-rose-500 hover:bg-rose-900/70 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                  aria-label={t("member.personal.removeStepAria")}
                >
                  <XIcon />
                </button>
              )}
            </div>
          ))}
        </div>
        {showFieldError('steps') && validationErrors.steps && <p className="text-rose-400 text-[11px] mt-1">{validationErrors.steps}</p>}
        <div>
          <button
            type="button"
            onClick={handleAddStep}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#493b79] bg-[#211844] px-4 py-2 text-sm font-medium text-white hover:border-[#8065ff] hover:bg-[#30215f] transition-colors cursor-pointer"
          >
            {t("member.personal.addStep")}
          </button>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">{t("member.personal.guideNote")}</p>
      </section>

      <section className="rounded-2xl border border-[#33285f] bg-[#15102e] p-6 space-y-3 shadow-xl shadow-purple-950/20">
        <h2 className="text-sm font-semibold text-white">{t("member.personal.demoVideo")}</h2>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
          onChange={handleFileSelect}
          className="hidden"
        />
        {video && exercise?.videoUrl && (
          <div className="rounded-2xl border border-[#493b79] bg-[#0d0922] p-3">
            <p className="mb-2 text-xs font-semibold text-slate-200">{t("member.personal.currentVideo", { name: video.name })}</p>
            <video
              src={libraryMediaUrl(exercise.videoUrl)}
              controls
              preload="metadata"
              className="max-h-80 w-full rounded-xl bg-black object-contain"
              aria-label={t("member.personal.currentVideoAria", { name: exercise.title || "exercise" })}
            />
          </div>
        )}
        {video && !exercise?.videoUrl && (
          <div className="rounded-2xl border border-[#493b79] bg-[#0d0922] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarbellIcon className="h-5 w-5 text-[#9d7aff]" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">{video.name}</span>
                <span className="text-[11px] text-slate-400">{video.size} · {t("member.personal.currentVideoBadge")}</span>
              </div>
            </div>
          </div>
        )}
        {replaceVideo && (
          <div
            id="exercise-video"
            tabIndex={-1}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`rounded-2xl border border-dashed p-6 flex flex-col items-center justify-center cursor-pointer transition-all select-none ${
              isDragging
                ? 'border-[#a855f7] bg-[#22174c]/60'
                : 'border-[#5b32e8]/60 bg-[#161036]/40 hover:bg-[#1a1340]/60'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-[#201748] flex items-center justify-center mb-2 text-[#9d7aff] shadow-sm">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <h3 className="text-xs font-semibold text-white">
              {uploadedFile
                ? t("member.personal.replacementSelected", { name: uploadedFile.name })
                : t("member.personal.dropReplacementHere")}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 text-center">
              {uploadedFile
                ? t("member.personal.replacementHint", {
                    size: (uploadedFile.size / (1024 * 1024)).toFixed(1),
                  })
                : t("member.personal.videoHint")}
            </p>
          </div>
        )}
        {!replaceVideo && (
          <button type="button" onClick={handleVideoReplace} className="rounded-xl border border-dashed border-[#59477f] bg-[#211844] px-4 py-3 text-sm font-medium text-violet-200 hover:border-[#9d7aff] hover:bg-[#30215f]">
            {video ? t("member.personal.replaceVideo") : t("member.personal.addDemoVideo")}
          </button>
        )}
        {replaceVideo && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-400">
              {t("member.personal.keepVideoNote")}
            </p>
            <button
              type="button"
              onClick={() => {
                setUploadedFile(null);
                setReplaceVideo(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="shrink-0 rounded-lg border border-violet-400/60 bg-[#100b24] px-3 py-1.5 text-xs font-semibold text-violet-100 transition-colors hover:border-violet-300 hover:bg-[#211844] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              {t("member.personal.cancelReplacement")}
            </button>
          </div>
        )}
        {showFieldError('video') && validationErrors.video && <p className="text-rose-400 text-[11px] mt-1">{validationErrors.video}</p>}
        <p className="text-[11px] text-slate-500">
          {t("member.personal.replacingNote")}
        </p>
      </section>

      <section className="rounded-2xl border border-[#33285f] bg-[#15102e] p-6 space-y-4 shadow-xl shadow-purple-950/20">
        <h2 className="text-sm font-semibold text-white">{t("member.personal.contentCheck")}</h2>
        <div className="space-y-3 select-none">
          <div className="flex items-center gap-3 rounded-xl border border-[#493b79] bg-[#0d0922] p-3.5">
            <div className="flex h-4 flex-shrink-0 items-center">
              <CheckCircleIcon className="w-4 h-4 text-[#a78bfa]" />
            </div>
            <div>
              <h3 className="text-xs font-medium text-white">{t("member.personal.textCheck")}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">{t("member.personal.textCheckDesc")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[#493b79] bg-[#0d0922] p-3.5">
            <div className="flex h-4 flex-shrink-0 items-center">
              <CheckCircleIcon className="w-4 h-4 text-[#a78bfa]" />
            </div>
            <div>
              <h3 className="text-xs font-medium text-white">{t("member.personal.videoFileCheck")}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">{t("member.personal.videoFileCheckDesc")}</p>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-slate-500">{t("member.personal.contentCheckNoteUpdate")}</p>
      </section>

      <footer className="flex items-center justify-between gap-4 border-t border-[#1c163a] pt-4">
        <span className={`text-xs ${isDirty ? 'text-amber-300' : 'text-slate-500'}`}>
          {isDirty ? t("member.personal.unsavedChanges") : t("member.personal.noChangesYet")}
        </span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setConfirmCancel(true)} className="rounded-xl border border-[#493b79] bg-[#17112f] hover:border-[#8065ff] hover:bg-[#241a46] text-slate-200 hover:text-white text-sm font-semibold px-6 py-2.5 transition-colors cursor-pointer">
            {t("member.personal.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving || Object.keys(validationErrors).length > 0 || targetMuscles.length === 0}
            className="rounded-xl border border-[#8065ff] bg-[#643bf6] hover:bg-[#7554ff] text-white text-sm font-semibold px-7 py-2.5 shadow-md shadow-purple-950/40 active:scale-95 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving && <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
            {saving ? t("member.personal.saving") : t("member.personal.save")}
          </button>
        </div>
      </footer>
      <ConfirmDialog
        open={confirmCancel}
        title={t("member.personal.discardChangesTitle")}
        message={t("member.personal.discardExerciseMessage")}
        confirmLabel={t("member.personal.discard")}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => navigate(-1)}
      />
    </div>
  );
}
