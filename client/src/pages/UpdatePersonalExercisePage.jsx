import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

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

const REJECTED_MOCK = {
  id: 'rej-1',
  slug: 'wall-sit-challenge',
  title: 'Wall sit challenge',
  description: 'A stupid simple wall sit to build leg endurance.',
  level: 'Beginner',
  guide: ['Find a wall and lean your back against it', 'Slide down until your knees are bent', 'Hold position for 60 seconds'],
  video: { name: 'wall-sit.mp4', size: '8.2 MB' },
  reason: 'Reason: Text check: the description contains inappropriate wording ("stupid"). Edit the description and save again.',
};

function readExercise(id, stateExercise) {
  if (stateExercise && String(stateExercise.id) === id) return stateExercise;

  const storedExercises = JSON.parse(localStorage.getItem('my_personal_exercises') || '[]');
  if (!Array.isArray(storedExercises)) {
    throw new Error('Saved exercises are not in the expected format.');
  }
  const storedExercise = storedExercises.find((item) => String(item.id) === id);
  if (storedExercise) {
    return {
      ...storedExercise,
      guide: storedExercise.guide || storedExercise.instructions || [],
      video: storedExercise.video || null,
    };
  }
  if (id === REJECTED_MOCK.id) return REJECTED_MOCK;
  throw new Error('Rejected exercise not found.');
}

export default function UpdatePersonalExercisePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
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

  useEffect(() => {
    try {
      const currentExercise = readExercise(id, location.state?.exercise);
      const initialGuide = Array.isArray(currentExercise.guide)
        ? currentExercise.guide
        : Array.isArray(currentExercise.instructions)
          ? currentExercise.instructions
          : [];
      const initialState = {
        title: currentExercise.title || '',
        description: currentExercise.description || '',
        level: currentExercise.level || 'Beginner',
        guide: initialGuide,
        video: currentExercise.video || null,
      };
      setExercise({ ...currentExercise, guide: initialGuide });
      setTitle(initialState.title);
      setDescription(initialState.description);
      setLevel(initialState.level);
      setGuide(initialState.guide);
      setVideo(initialState.video);
      setBaseline(JSON.stringify(initialState));
      setErrorMessage('');
    } catch (error) {
      setExercise(null);
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not load rejected exercise.'
      );
    }
  }, [id, location.state]);

  const currentState = JSON.stringify({ title, description, level, guide, video });
  const isDirty = baseline !== '' && (
    currentState !== baseline || uploadedFile !== null
  );

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
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        setErrorMessage('Video file size exceeds 50 MB limit.');
        return;
      }
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
    const file = event.dataTransfer.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        setErrorMessage('Video file size exceeds 50 MB limit.');
        return;
      }
      setErrorMessage('');
      setUploadedFile(file);
      setVideo({ name: file.name, size: `${(file.size / (1024 * 1024)).toFixed(1)} MB` });
    }
  };

  const charCount = (str, max) => `${str.length}/${max}`;

  const handleSave = () => {
    if (!isDirty || !exercise) return;
    if (!title.trim()) {
      setErrorMessage('Please enter an exercise title.');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    try {
      const raw = JSON.parse(localStorage.getItem('my_personal_exercises') || '[]');
      if (!Array.isArray(raw)) {
        throw new Error('Saved exercises are not in the expected format.');
      }
      const updatedExercise = {
        ...exercise,
        id,
        slug: exercise.slug || title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: title.trim(),
        description: description.trim(),
        level,
        guide: guide.filter((step) => step.trim()),
        instructions: guide.filter((step) => step.trim()),
        video: video ? { name: video.name, size: video.size } : null,
        videoFileName: uploadedFile?.name || exercise.videoFileName,
        status: 'pending',
        postedTime: 'Just now',
        postedDaysAgo: 0,
      };
      localStorage.setItem(
        'my_personal_exercises',
        JSON.stringify([updatedExercise, ...raw.filter((item) => String(item.id) !== id)])
      );
      navigate('/library/personal?status=pending');
    } catch (error) {
      setSaving(false);
      setErrorMessage(
        error instanceof Error ? `Could not save exercise: ${error.message}` : 'Could not save exercise.'
      );
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
            <span className="text-xs text-slate-500 font-mono">{charCount(title, 60)}</span>
          </div>
          <input
            type="text"
            value={title}
            maxLength={60}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Diamond push-up"
            className="w-full rounded-xl border border-[#493b79] bg-[#0d0922] px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-[#9d7aff] focus:outline-none transition-colors"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300">Description</label>
            <span className="text-xs text-slate-500 font-mono">{charCount(description, 300)}</span>
          </div>
          <textarea
            value={description}
            maxLength={300}
            placeholder="What does this exercise train, and who is it for?"
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-[#493b79] bg-[#0d0922] p-4 text-sm text-white placeholder-slate-500 h-28 resize-none focus:border-[#9d7aff] focus:outline-none transition-colors leading-relaxed"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-2">Level</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                onClick={() => setLevel(name)}
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
        </div>
      </section>

      <section className="rounded-2xl border border-[#33285f] bg-[#15102e] p-6 space-y-4 shadow-xl shadow-purple-950/20">
        <h2 className="text-sm font-semibold text-white">Guide</h2>
        <div className="space-y-3">
          {guide.map((step, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <span className="text-xs text-slate-500 w-4 text-center select-none font-medium">{idx + 1}</span>
            <input
              type="text"
              value={step}
              onChange={(e) => handleGuideChange(idx, e.target.value)}
              placeholder={idx === 0 ? 'e.g. Start in a plank with hands under shoulders' : 'Next step'}
              className="flex-1 rounded-xl border border-[#493b79] bg-[#0d0922] px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-[#9d7aff] focus:outline-none transition-colors"
            />
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
          accept="video/mp4,video/quicktime,video/webm"
          onChange={handleFileSelect}
          className="hidden"
        />
        {replaceVideo ? (
          <div
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
        <p className="text-[11px] text-slate-500">
          If you replace the video, it is scanned again with MediaPipe. Keeping the current video skips that scan.
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
              <h3 className="text-xs font-medium text-white">Video check (MediaPipe)</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">The demo video is scanned for a clearly visible body pose.</p>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-slate-500">Both checks run when you press Save. The exercise is saved only if both pass.</p>
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
