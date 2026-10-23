import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { validatePersonalExercise } from './libraryFormValidation';
import { getPersonalExercise, resubmitPersonalExercise } from '../api/library';

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

export default function UpdatePersonalExercisePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [exercise, setExercise] = useState(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('Beginner');
  const [guide, setGuide] = useState(['']);
  const [video, setVideo] = useState(null);
  const [replaceVideo, setReplaceVideo] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [baseline, setBaseline] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [touchedFields, setTouchedFields] = useState({});

  useEffect(() => {
    let active = true;
    setErrorMessage('');
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
        setBaseline(JSON.stringify(initialState));
      })
      .catch((error) => {
        if (!active) return;
        setExercise(null);
        setErrorMessage(
          error?.response?.data?.message || 'Could not load this personal exercise.'
        );
      });
    return () => {
      active = false;
    };
  }, [id]);

  const currentState = JSON.stringify({ title, description, level, guide, video });
  const isDirty = baseline !== '' && (
    currentState !== baseline || uploadedFile !== null
  );
  const validationErrors = validatePersonalExercise({
    title,
    description,
    level,
    steps: guide,
    videoFile: uploadedFile,
    requireVideo: !video && !uploadedFile,
  });
  const showFieldError = (field) => hasSubmitted || touchedFields[field];
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
  const handleVideoRemove = () => {
    setVideo(null);
    setReplaceVideo(false);
    setUploadedFile(null);
  };

  const handleFileSelect = (e) => {
    markFieldTouched('video');
    const file = e.target.files?.[0];
    if (file) {
      setErrorMessage('');
      setUploadedFile(file);
      setVideo({ name: file.name, size: `${(file.size / (1024 * 1024)).toFixed(1)} MB` });
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
      setVideo({ name: file.name, size: `${(file.size / (1024 * 1024)).toFixed(1)} MB` });
    }
  };

  const charCount = (str, max) => `${str.length}/${max}`;

  const handleSave = async () => {
    if (!isDirty || !exercise) return;
    setHasSubmitted(true);
    if (Object.keys(validationErrors).length > 0) {
      toast.warning("Please fill in all required fields correctly.");
      focusFirstInvalidField(validationErrors);
      return;
    }

    setSaving(true);
    setErrorMessage('');
    try {
      const updatedExercise = await resubmitPersonalExercise(id, {
        title: title.trim(),
        description: description.trim(),
        level: level.toUpperCase(),
        guideSteps: guide.filter((step) => step.trim()),
        targetMuscle: exercise.targetMuscle || "Full body",
        defaultSets: exercise.defaultSets || 3,
        defaultReps: exercise.defaultReps ?? null,
        defaultDuration: exercise.defaultDuration ?? null,
        keepCurrentVideo: Boolean(video && !uploadedFile),
      }, uploadedFile);
      if (updatedExercise.status === 'REJECTED') {
        toast.error(updatedExercise.rejectionReason || "The exercise did not pass the checks.");
        navigate('/library/personal?status=rejected');
      } else if (updatedExercise.status === 'ACCEPTED') {
        toast.success("Exercise approved and added to your library.");
        navigate('/library/personal?status=accepted');
      } else {
        toast.success("Exercise resubmitted for review.");
        navigate('/library/personal?status=pending');
      }
    } catch (error) {
      setSaving(false);
      const message = error?.response?.data?.message || "Could not resubmit exercise.";
      toast.error(message);
      setErrorMessage(message);
    }
  };

  if (!exercise && !errorMessage) return null;

  return (
    <div className="create-personal-exercise-page w-full max-w-5xl mx-auto space-y-6 pb-12 text-white">
      <header className="mb-2">
        <h1 className="text-2xl font-bold text-white tracking-tight">Update personal exercise</h1>
        <p className="text-xs text-slate-400 mt-1">
          Change any field and press Save. The exercise is checked again after you save.
        </p>
      </header>

      {errorMessage && (
        <div role="alert" className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs flex items-center justify-between shadow-sm">
          {errorMessage}
        </div>
      )}

      {exercise && exercise.reason && (
        <div className="rounded-xl border border-rose-900/50 bg-[#260e14]/70 px-5 py-3 flex items-center gap-3.5">
          <span className="rounded-full px-3 py-1 text-xs font-semibold text-rose-400 bg-rose-950/80 border border-rose-800/80">Rejected</span>
          <p className="text-xs text-rose-200/90 leading-relaxed flex-1">{exercise.reason}</p>
        </div>
      )}

      <section className="rounded-2xl border border-[#33285f] bg-[#15102e] p-6 space-y-5 shadow-xl shadow-purple-950/20">
        <h2 className="text-sm font-semibold text-white">Exercise details</h2>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300">Title</label>
            <span className="text-xs text-slate-500 font-mono">{charCount(title, 50)}</span>
          </div>
          <input
            type="text"
            id="exercise-title"
            value={title}
            maxLength={50}
            onChange={(e) => {
              setTitle(e.target.value);
              markFieldTouched('title');
            }}
            placeholder="e.g. Diamond push-up"
            className={`w-full rounded-xl border ${showFieldError('title') && validationErrors.title ? 'border-rose-500 focus:border-rose-500' : 'border-[#493b79] focus:border-[#9d7aff]'} bg-[#0d0922] px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors`}
          />
          {showFieldError('title') && validationErrors.title && <p className="text-rose-400 text-[11px] mt-1">{validationErrors.title}</p>}
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300">Description</label>
            <span className="text-xs text-slate-500 font-mono">{charCount(description, 300)}</span>
          </div>
          <textarea
            id="exercise-description"
            value={description}
            maxLength={300}
            placeholder="What does this exercise train, and who is it for?"
            onChange={(e) => {
              setDescription(e.target.value);
              markFieldTouched('description');
            }}
            className={`w-full rounded-xl border ${showFieldError('description') && validationErrors.description ? 'border-rose-500 focus:border-rose-500' : 'border-[#493b79] focus:border-[#9d7aff]'} bg-[#0d0922] p-4 text-sm text-white placeholder-slate-500 h-28 resize-none focus:outline-none transition-colors leading-relaxed`}
          />
          {showFieldError('description') && validationErrors.description && <p className="text-rose-400 text-[11px] mt-1">{validationErrors.description}</p>}
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-2">Level</label>
          <div id="exercise-level" tabIndex={-1} className={`grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl ${showFieldError('level') && validationErrors.level ? 'ring-1 ring-rose-500' : ''}`}>
            {[
              { name: 'Beginner', description: 'New to this movement' },
              { name: 'Intermediate', description: 'Comfortable with the basics' },
              { name: 'Advanced', description: 'Strong and experienced' },
            ].map(({ name, description: levelDescription }) => (
              <div
                key={name}
                role="radio"
                aria-checked={level === name}
                tabIndex={0}
                onClick={() => {
                  setLevel(name);
                  markFieldTouched('level');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setLevel(name);
                    markFieldTouched('level');
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
        <h2 className="text-sm font-semibold text-white">Guide</h2>
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
                  markFieldTouched(`step-${idx}`);
                }}
                placeholder={idx === 0 ? 'e.g. Start in a plank with hands under shoulders' : 'Next step'}
                className={`w-full rounded-xl border ${showFieldError(`step-${idx}`) && validationErrors[`step-${idx}`] ? 'border-rose-500 focus:border-rose-500' : 'border-[#493b79] focus:border-[#9d7aff]'} bg-[#0d0922] px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors`}
              />
              {showFieldError(`step-${idx}`) && validationErrors[`step-${idx}`] && <p className="text-rose-400 text-[11px] mt-1">{validationErrors[`step-${idx}`]}</p>}
            </div>
              {guide.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveStep(idx)}
                  className="h-10 w-10 rounded-xl border border-rose-800/70 bg-rose-950/60 text-rose-300 hover:border-rose-500 hover:bg-rose-900/70 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                  aria-label="Remove step"
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
            + Add step
          </button>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">Write the steps in order, one action per step.</p>
      </section>

      <section className="rounded-2xl border border-[#33285f] bg-[#15102e] p-6 space-y-3 shadow-xl shadow-purple-950/20">
        <h2 className="text-sm font-semibold text-white">Demo video</h2>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
          onChange={handleFileSelect}
          className="hidden"
        />
        {replaceVideo ? (
          <div
            id="exercise-video"
            tabIndex={-1}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`rounded-2xl border border-dashed p-8 flex flex-col items-center justify-center cursor-pointer transition-all select-none ${
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
              {uploadedFile ? uploadedFile.name : 'Click to upload a replacement video'}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 text-center">
              {uploadedFile
                ? `${(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB · Click to choose a different video`
                : 'MP4, MOV or WebM · up to 50 MB · keep your whole body in frame'}
            </p>
          </div>
        ) : video ? (
          <div className="rounded-2xl border border-[#493b79] bg-[#0d0922] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarbellIcon className="h-5 w-5 text-[#9d7aff]" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">{video.name}</span>
                <span className="text-[11px] text-slate-400">{video.size} · current video</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleVideoReplace}
                className="rounded-lg border border-[#59477f] bg-[#211844] px-4 py-2 text-sm font-semibold text-violet-200 hover:border-[#9d7aff] hover:bg-[#30215f] hover:text-white transition-colors cursor-pointer"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleVideoRemove}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-800/70 bg-rose-950/50 text-rose-300 hover:border-rose-500 hover:bg-rose-900/70 hover:text-white transition-colors cursor-pointer"
                aria-label="Remove current video"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={handleVideoReplace} className="rounded-xl border border-dashed border-[#59477f] bg-[#211844] px-4 py-3 text-sm font-medium text-violet-200 hover:border-[#9d7aff] hover:bg-[#30215f]">
            + Add demo video
          </button>
        )}
        {showFieldError('video') && validationErrors.video && <p className="text-rose-400 text-[11px] mt-1">{validationErrors.video}</p>}
        <p className="text-[11px] text-slate-500">
          Replacing the video runs a file validation check. Keeping the current video skips that check.
        </p>
      </section>

      <section className="rounded-2xl border border-[#33285f] bg-[#15102e] p-6 space-y-4 shadow-xl shadow-purple-950/20">
        <h2 className="text-sm font-semibold text-white">Content check</h2>
        <div className="space-y-3 select-none">
          <div className="flex items-center gap-3 rounded-xl border border-[#493b79] bg-[#0d0922] p-3.5">
            <div className="flex h-4 flex-shrink-0 items-center">
              <CheckCircleIcon className="w-4 h-4 text-[#a78bfa]" />
            </div>
            <div>
              <h3 className="text-xs font-medium text-white">Text check</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Title, description and guide are scanned for inappropriate words.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[#493b79] bg-[#0d0922] p-3.5">
            <div className="flex h-4 flex-shrink-0 items-center">
              <CheckCircleIcon className="w-4 h-4 text-[#a78bfa]" />
            </div>
            <div>
              <h3 className="text-xs font-medium text-white">Video file check</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">A replacement video is checked for an accepted format and readable container.</p>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-slate-500">Text is checked every time you save. A replacement video is also validated before the exercise is updated.</p>
      </section>

      <footer className="flex items-center justify-between gap-4 border-t border-[#1c163a] pt-4">
        <span className={`text-xs ${isDirty ? 'text-amber-300' : 'text-slate-500'}`}>
          {isDirty ? 'Unsaved changes' : 'No changes yet'}
        </span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="rounded-xl border border-[#493b79] bg-[#17112f] hover:border-[#8065ff] hover:bg-[#241a46] text-slate-200 hover:text-white text-sm font-semibold px-6 py-2.5 transition-colors cursor-pointer">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="rounded-xl border border-[#8065ff] bg-[#643bf6] hover:bg-[#7554ff] text-white text-sm font-semibold px-7 py-2.5 shadow-md shadow-purple-950/40 active:scale-95 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </footer>
    </div>
  );
}
