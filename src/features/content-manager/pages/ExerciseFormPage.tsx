import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ApiRequestError, authApi } from '@/features/auth/api/authApi';
import type { CreateExerciseRequest, CreateWorkoutRequest, ExerciseEntry, WorkoutPlanItem } from '@/features/auth/types';

type ContentKind = 'exercise' | 'workout';
type ExerciseField = 'title' | 'type' | 'level' | 'muscles' | 'demoVideo' | 'anatomyImage';

const muscleOptions = ['Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Legs', 'Glutes'];
const categoryOptions = ['Strength', 'Mobility', 'Endurance', 'Balance', 'Flexibility'];
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'];
const MAX_ANATOMY_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const inputClass = 'mt-2 w-full rounded-lg border border-[#49386c] bg-[#100b20] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#74678e] focus:border-violet-400';

export function ExerciseFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const kind: ContentKind = searchParams.get('type') === 'workout' ? 'workout' : 'exercise';
  const [exercise, setExercise] = useState<CreateExerciseRequest>({
    name: '',
    type: 'HEALTH',
    description: '',
    category: '',
    muscleGroup: '',
    level: 'Beginner',
    guide: '',
  });
  const [workout, setWorkout] = useState<CreateWorkoutRequest>({
    name: '',
    description: '',
    content: '',
    type: 'WORKOUT',
    level: 'Beginner',
    exerciseCodes: [],
    planItems: [],
  });
  const [demoVideo, setDemoVideo] = useState<File | null>(null);
  const [demoVideoError, setDemoVideoError] = useState<string | null>(null);
  const [anatomyImage, setAnatomyImage] = useState<File | null>(null);
  const [anatomyImageError, setAnatomyImageError] = useState<string | null>(null);
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseLevel, setExerciseLevel] = useState('all');
  const [selectedPlanDay, setSelectedPlanDay] = useState(1);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exerciseFieldErrors, setExerciseFieldErrors] = useState<ExerciseField[]>([]);
  const { data: systemExercises = [], isLoading: isLoadingExercises, isError: isExerciseLoadError } = useQuery({
    queryKey: ['content', 'exercises'],
    queryFn: authApi.exercises,
    enabled: kind === 'workout',
  });
  const filteredExercises = useMemo(() => {
    const query = exerciseSearch.trim().toLowerCase();
    return systemExercises.filter((entry) => {
      const matchesQuery = !query || entry.name.toLowerCase().includes(query);
      const matchesLevel = exerciseLevel === 'all' || entry.level.toLowerCase() === exerciseLevel;
      return entry.active && matchesQuery && matchesLevel;
    });
  }, [systemExercises, exerciseSearch, exerciseLevel]);

  const exerciseMutation = useMutation({
    mutationFn: ({ data, video, image }: { data: CreateExerciseRequest; video: File | null; image: File | null }) => authApi.createExercise(data, video, image),
    onSuccess: async (entry) => {
      await queryClient.invalidateQueries({ queryKey: ['content', 'exercises'] });
      navigate(`/content/exercises/${encodeURIComponent(entry.code)}`);
    },
    onError: (requestError: unknown) => {
      const message = getRequestErrorMessage(requestError);
      setError(message);
      setExerciseFieldErrors(getExerciseFieldErrors(message));
    },
  });
  const workoutMutation = useMutation({
    mutationFn: authApi.createWorkout,
    onSuccess: async (entry) => {
      await queryClient.invalidateQueries({ queryKey: ['content', 'workouts'] });
      await queryClient.invalidateQueries({ queryKey: ['content', 'exercises'] });
      navigate('/content/workouts', {
        replace: true,
        state: { successMessage: `Workout "${entry.name}" created successfully.` },
      });
    },
    onError: () => setError('Could not create this workout. Check the fields and try again.'),
  });
  const isSaving = exerciseMutation.isPending || workoutMutation.isPending;

  const changeKind = (nextKind: ContentKind) => {
    setSearchParams({ type: nextKind });
    setError(null);
    setHasSubmitted(false);
    setExerciseFieldErrors([]);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setHasSubmitted(true);
    if (kind === 'exercise') {
      const invalidFields: ExerciseField[] = [];
      if (!exercise.name.trim() || exercise.name.length > 120) invalidFields.push('title');
      if (!['HEALTH', 'SKILL'].includes(exercise.type)) invalidFields.push('type');
      if (!['Beginner', 'Intermediate', 'Advanced'].includes(exercise.level)) invalidFields.push('level');
      if (selectedMuscles.length === 0) invalidFields.push('muscles');
      setExerciseFieldErrors(invalidFields);
      if (demoVideoError || anatomyImageError) {
        setExerciseFieldErrors((current) => [
          ...current,
          ...(demoVideoError ? ['demoVideo' as const] : []),
          ...(anatomyImageError ? ['anatomyImage' as const] : []),
        ]);
        setError(demoVideoError ?? anatomyImageError);
        return;
      }
      if (invalidFields.length > 0) {
        setError('Please correct the highlighted fields before creating this exercise.');
        return;
      }
      exerciseMutation.mutate({
        data: { ...exercise, muscleGroup: selectedMuscles.join(' · ') },
        video: demoVideo,
        image: anatomyImage,
      });
    } else {
      if (!workout.name.trim() || !workout.description.trim()) {
        setError('Enter a workout title and description.');
        return;
      }
      if (workout.type === 'WORKOUT' && workout.exerciseCodes.length === 0) {
        setError('Add at least one system exercise to this workout.');
        return;
      }
      if (workout.type === 'DAILY_TRAINING_PLAN' && workout.planItems.length === 0) {
        setError('Add at least one exercise to the 7-day plan.');
        return;
      }
      workoutMutation.mutate(workout);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
      <Breadcrumb current="Create content" />
      <div className="mt-3">
        <h1 className="text-2xl font-bold">Create System Workout &amp; Exercise</h1>
        <p className="mt-1 text-sm text-[#aa9bc9]">
          {kind === 'workout'
            ? 'Build a workout for members by picking exercises that already exist in the system.'
            : 'Add a new exercise or skill to the system library.'}
        </p>
      </div>

      <div className="mt-4 inline-flex rounded-lg border border-[#49386c] bg-[#17112e] p-1" role="tablist" aria-label="Content type">
        <button type="button" role="tab" aria-selected={kind === 'exercise'} onClick={() => changeKind('exercise')} className={`rounded-md px-5 py-2 text-sm font-medium transition-colors ${kind === 'exercise' ? 'bg-violet-600 text-white' : 'text-[#b4a8d1] hover:text-white'}`}>Exercise</button>
        <button type="button" role="tab" aria-selected={kind === 'workout'} onClick={() => changeKind('workout')} className={`rounded-md px-5 py-2 text-sm font-medium transition-colors ${kind === 'workout' ? 'bg-violet-600 text-white' : 'text-[#b4a8d1] hover:text-white'}`}>Workout</button>
      </div>

      <form id="create-content-form" onSubmit={submit} className="mt-4 space-y-4">
        {kind === 'exercise' ? (
          <ExerciseFields
            value={exercise}
            onChange={setExercise}
            demoVideo={demoVideo}
            demoVideoError={demoVideoError}
            anatomyImage={anatomyImage}
            anatomyImageError={anatomyImageError}
            onAnatomyImageChange={(file) => {
              setExerciseFieldErrors((current) => current.filter((item) => item !== 'anatomyImage'));
              setAnatomyImageError(null);
              if (!file) {
                setAnatomyImage(null);
                return;
              }
              const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
              if (file.size > MAX_ANATOMY_IMAGE_SIZE) {
                setAnatomyImage(null);
                setAnatomyImageError('Anatomy image must be 10 MB or smaller.');
              } else if (!ALLOWED_IMAGE_EXTENSIONS.includes(extension) || (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type))) {
                setAnatomyImage(null);
                setAnatomyImageError('Choose a JPG, PNG or WebP image.');
              } else {
                setAnatomyImage(file);
              }
            }}
            onDemoVideoChange={(file) => {
              setExerciseFieldErrors((current) => current.filter((item) => item !== 'demoVideo'));
              setDemoVideoError(null);
              if (!file) {
                setDemoVideo(null);
                return;
              }
              const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
              if (file.size > MAX_VIDEO_SIZE) {
                setDemoVideo(null);
                setDemoVideoError('Video must be 50 MB or smaller.');
              } else if (!ALLOWED_VIDEO_EXTENSIONS.includes(extension) || (file.type && !ALLOWED_VIDEO_TYPES.includes(file.type))) {
                setDemoVideo(null);
                setDemoVideoError('Choose an MP4, MOV or WebM video.');
              } else {
                setDemoVideo(file);
              }
            }}
            selectedMuscles={selectedMuscles}
            invalidFields={exerciseFieldErrors}
            onClearFieldError={(field) => setExerciseFieldErrors((current) => current.filter((item) => item !== field))}
            onToggleMuscle={(muscle) => {
              setSelectedMuscles((current) => current.includes(muscle) ? current.filter((item) => item !== muscle) : [...current, muscle]);
              setExerciseFieldErrors((current) => current.filter((item) => item !== 'muscles'));
            }}
          />
        ) : (
          <WorkoutFields
            value={workout}
            onChange={setWorkout}
            entries={filteredExercises}
            allEntries={systemExercises}
            totalExerciseCount={systemExercises.length}
            isLoadingExercises={isLoadingExercises}
            isExerciseLoadError={isExerciseLoadError}
            search={exerciseSearch}
            onSearchChange={setExerciseSearch}
            level={exerciseLevel}
            onLevelChange={setExerciseLevel}
            hasSubmitted={hasSubmitted}
            selectedPlanDay={selectedPlanDay}
            onSelectedPlanDayChange={setSelectedPlanDay}
          />
        )}

        {error && <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</p>}
      </form>
      <div className="sticky bottom-0 z-10 mt-4 flex justify-end gap-3 border-t border-[#30264b] bg-[#0b0718]/95 py-3 backdrop-blur">
        <Link to={kind === 'exercise' ? '/content/exercises' : '/content/workouts'} className="rounded-lg border border-[#59427e] px-4 py-2.5 text-sm text-[#d5cce8] hover:bg-white/5">Cancel</Link>
        <button type="submit" form="create-content-form" disabled={isSaving} className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50">
          {isSaving ? 'Creating…' : `Create ${kind}`}
        </button>
      </div>
    </main>
  );
}

function ExerciseFields({ value, onChange, demoVideo, demoVideoError, onDemoVideoChange, anatomyImage, anatomyImageError, onAnatomyImageChange, selectedMuscles, invalidFields, onClearFieldError, onToggleMuscle }: {
  value: CreateExerciseRequest;
  onChange: (value: CreateExerciseRequest) => void;
  demoVideo: File | null;
  demoVideoError: string | null;
  onDemoVideoChange: (file: File | null) => void;
  anatomyImage: File | null;
  anatomyImageError: string | null;
  onAnatomyImageChange: (file: File | null) => void;
  selectedMuscles: string[];
  invalidFields: ExerciseField[];
  onClearFieldError: (field: ExerciseField) => void;
  onToggleMuscle: (muscle: string) => void;
}) {
  const isInvalid = (field: ExerciseField) => invalidFields.includes(field);

  return (
    <>
      <section className="space-y-4 rounded-2xl border border-[#30264b] bg-[#19152a] p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-[#e5def2]">Exercise details</h2>
        <label className="block">
          <span className="text-xs text-[#a99bc9]">Title</span>
          <input required maxLength={120} aria-invalid={isInvalid('title')} value={value.name} onChange={(event) => { onChange({ ...value, name: event.target.value }); onClearFieldError('title'); }} placeholder="e.g. Archer push-up" className={`${inputClass} ${isInvalid('title') ? 'border-rose-400 focus:border-rose-400' : ''}`} />
          {isInvalid('title') && <span className="mt-1 block text-xs text-rose-300">Enter a title of 1–120 characters.</span>}
        </label>
        <label className="block">
          <span className="text-xs text-[#a99bc9]">Description</span>
          <textarea maxLength={300} rows={3} value={value.description} onChange={(event) => onChange({ ...value, description: event.target.value })} placeholder="What does this exercise train, and who is it for?" className={`${inputClass} resize-y`} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-[#a99bc9]">Type</span>
            <select aria-invalid={isInvalid('type')} value={value.type} onChange={(event) => { onChange({ ...value, type: event.target.value as CreateExerciseRequest['type'] }); onClearFieldError('type'); }} className={`${inputClass} ${isInvalid('type') ? 'border-rose-400 focus:border-rose-400' : ''}`}>
              <option value="HEALTH">Health</option>
              <option value="SKILL">Skill</option>
            </select>
            {isInvalid('type') && <span className="mt-1 block text-xs text-rose-300">Choose Health or Skill.</span>}
          </label>
          <label className="block">
            <span className="text-xs text-[#a99bc9]">Category</span>
            <select value={value.category} onChange={(event) => onChange({ ...value, category: event.target.value })} className={inputClass}>
              <option value="">Select a category</option>
              {categoryOptions.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
        </div>
        <fieldset className={`rounded-lg ${isInvalid('level') ? 'border border-rose-400 p-2' : ''}`}>
          <legend className={`text-xs ${isInvalid('level') ? 'text-rose-300' : 'text-[#a99bc9]'}`}>Level</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
              <label key={level} className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 text-xs transition-colors ${value.level === level ? 'border-violet-400 bg-violet-500/15 text-white' : 'border-[#49386c] text-[#c4bad9] hover:border-violet-400/60'}`}>
                {level}
                <input type="radio" name="exercise-level" value={level} checked={value.level === level} onChange={() => { onChange({ ...value, level }); onClearFieldError('level'); }} className="accent-violet-400" />
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className={`rounded-lg ${isInvalid('muscles') ? 'border border-rose-400 p-2' : ''}`}>
          <legend className={`text-xs ${isInvalid('muscles') ? 'text-rose-300' : 'text-[#a99bc9]'}`}>Muscle groups</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {muscleOptions.map((muscle) => (
              <button key={muscle} type="button" aria-pressed={selectedMuscles.includes(muscle)} onClick={() => onToggleMuscle(muscle)} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${selectedMuscles.includes(muscle) ? 'border-violet-400 bg-violet-500/20 text-violet-100' : 'border-[#49386c] text-[#b4a8d1] hover:text-white'}`}>{muscle}</button>
            ))}
          </div>
          {isInvalid('muscles') && <p className="mt-2 text-xs text-rose-300">Select at least one muscle group.</p>}
        </fieldset>
      </section>

      <section className="rounded-2xl border border-[#30264b] bg-[#19152a] p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-[#e5def2]">Guide</h2>
        <p className="mt-1 text-xs text-[#a99bc9]">Add one action step at a time, in order.</p>
        <GuideEditor value={value.guide} onChange={(guide) => onChange({ ...value, guide })} />
      </section>

      <section className="rounded-2xl border border-[#30264b] bg-[#19152a] p-4 sm:p-5">
        <label className="block text-sm font-semibold text-[#e5def2]">
          Demo video
          <span className="mt-1 block text-xs font-normal text-[#a99bc9]">MP4, MOV or WebM · up to 50 MB</span>
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
            aria-invalid={Boolean(demoVideoError) || isInvalid('demoVideo')}
            onChange={(event) => onDemoVideoChange(event.target.files?.[0] ?? null)}
            className={`mt-3 block w-full cursor-pointer rounded-lg border border-dashed bg-[#100b20] px-3 py-4 text-sm text-[#d5cce8] file:mr-3 file:rounded-md file:border-0 file:bg-violet-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white ${demoVideoError || isInvalid('demoVideo') ? 'border-rose-400' : 'border-violet-400/60'}`}
          />
          {demoVideo && <span className="mt-2 block truncate text-xs font-normal text-emerald-200">Selected: {demoVideo.name} ({(demoVideo.size / (1024 * 1024)).toFixed(1)} MB)</span>}
          {demoVideoError && <span role="alert" className="mt-2 block text-xs font-normal text-rose-200">{demoVideoError}</span>}
          {!demoVideoError && isInvalid('demoVideo') && <span role="alert" className="mt-2 block text-xs font-normal text-rose-200">The server rejected this video file.</span>}
        </label>
      </section>

      <section className="rounded-2xl border border-[#30264b] bg-[#19152a] p-4 sm:p-5">
        <label className="block text-sm font-semibold text-[#e5def2]">
          Muscle anatomy image
          <span className="mt-1 block text-xs font-normal text-[#a99bc9]">Upload a JPG, PNG or WebP image · up to 10 MB</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            aria-invalid={Boolean(anatomyImageError) || isInvalid('anatomyImage')}
            onChange={(event) => onAnatomyImageChange(event.target.files?.[0] ?? null)}
            className={`mt-3 block w-full cursor-pointer rounded-lg border border-dashed bg-[#100b20] px-3 py-4 text-sm text-[#d5cce8] file:mr-3 file:rounded-md file:border-0 file:bg-violet-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white ${anatomyImageError || isInvalid('anatomyImage') ? 'border-rose-400' : 'border-violet-400/60'}`}
          />
          {anatomyImage && <span className="mt-2 block truncate text-xs font-normal text-emerald-200">Selected: {anatomyImage.name} ({(anatomyImage.size / (1024 * 1024)).toFixed(1)} MB)</span>}
          {anatomyImage && <LocalImagePreview file={anatomyImage} />}
          {anatomyImageError && <span role="alert" className="mt-2 block text-xs font-normal text-rose-200">{anatomyImageError}</span>}
          {!anatomyImageError && isInvalid('anatomyImage') && <span role="alert" className="mt-2 block text-xs font-normal text-rose-200">The server rejected this image file.</span>}
        </label>
      </section>
    </>
  );
}

function LocalImagePreview({ file }: { file: File }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return previewUrl
    ? <img src={previewUrl} alt="Selected muscle anatomy preview" className="mt-3 max-h-64 w-full rounded-lg bg-[#100b20] object-contain" />
    : null;
}

function GuideEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const steps = value ? value.split('\n') : [''];

  const updateStep = (index: number, step: string) => {
    const next = [...steps];
    next[index] = step;
    onChange(next.join('\n'));
  };

  return (
    <div className="mt-3 space-y-2">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-right text-xs text-violet-300">{index + 1}</span>
          <input value={step} onChange={(event) => updateStep(index, event.target.value)} placeholder={index === 0 ? 'e.g. Start in a plank with hands under shoulders' : 'Next step'} className="w-full rounded-lg border border-[#49386c] bg-[#100b20] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#74678e] focus:border-violet-400" />
          <button type="button" aria-label={`Remove guide step ${index + 1}`} disabled={steps.length === 1} onClick={() => onChange(steps.filter((_, stepIndex) => stepIndex !== index).join('\n'))} className="rounded-lg border border-rose-400/40 px-3 py-2 text-rose-300 hover:bg-rose-400/10 disabled:opacity-30">×</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...steps, ''].join('\n'))} className="rounded-lg border border-[#59427e] px-3 py-1.5 text-xs text-[#d5cce8] hover:bg-white/5">+ Add step</button>
    </div>
  );
}

function WorkoutFields({
  value,
  onChange,
  entries,
  allEntries,
  totalExerciseCount,
  isLoadingExercises,
  isExerciseLoadError,
  search,
  onSearchChange,
  level,
  onLevelChange,
  hasSubmitted,
  selectedPlanDay,
  onSelectedPlanDayChange,
}: {
  value: CreateWorkoutRequest;
  onChange: (value: CreateWorkoutRequest) => void;
  entries: ExerciseEntry[];
  allEntries: ExerciseEntry[];
  totalExerciseCount: number;
  isLoadingExercises: boolean;
  isExerciseLoadError: boolean;
  search: string;
  onSearchChange: (search: string) => void;
  level: string;
  onLevelChange: (level: string) => void;
  hasSubmitted: boolean;
  selectedPlanDay: number;
  onSelectedPlanDayChange: (day: number) => void;
}) {
  const isDailyPlan = value.type === 'DAILY_TRAINING_PLAN';
  const dayItems = value.planItems.filter((item) => item.dayOfWeek === selectedPlanDay);

  const addExercise = (exercise: ExerciseEntry) => {
    if (isDailyPlan) {
      if (dayItems.some((item) => item.exerciseCode === exercise.code)) return;
      const item: WorkoutPlanItem = {
        dayOfWeek: selectedPlanDay,
        exerciseCode: exercise.code,
        beginnerSets: 3,
        beginnerReps: 10,
        intermediateSets: 3,
        intermediateReps: 12,
        advancedSets: 4,
        advancedReps: 12,
      };
      onChange({ ...value, planItems: [...value.planItems, item] });
      return;
    }
    if (!value.exerciseCodes.includes(exercise.code)) {
      onChange({ ...value, exerciseCodes: [...value.exerciseCodes, exercise.code] });
    }
  };

  const updatePlanItem = (code: string, field: keyof WorkoutPlanItem, nextValue: number) => {
    onChange({
      ...value,
      planItems: value.planItems.map((item) => item.dayOfWeek === selectedPlanDay && item.exerciseCode === code
        ? { ...item, [field]: nextValue }
        : item),
    });
  };

  const removeExercise = (code: string) => {
    if (isDailyPlan) {
      onChange({ ...value, planItems: value.planItems.filter((item) => !(item.dayOfWeek === selectedPlanDay && item.exerciseCode === code)) });
    } else {
      onChange({ ...value, exerciseCodes: value.exerciseCodes.filter((item) => item !== code) });
    }
  };

  const addedCodes = isDailyPlan ? dayItems.map((item) => item.exerciseCode) : value.exerciseCodes;
  const allPlanItems = value.planItems;

  return (
    <>
      <section className="space-y-4 rounded-2xl border border-[#30264b] bg-[#19152a] p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-[#e5def2]">Workout details</h2>
        <label className="block">
          <span className="flex items-center justify-between text-xs text-[#a99bc9]">Title <span>{value.name.length}/60</span></span>
          <input maxLength={60} aria-invalid={hasSubmitted && !value.name.trim()} value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} placeholder="e.g. Beginner full body" className={`${inputClass} ${hasSubmitted && !value.name.trim() ? 'border-rose-400' : ''}`} />
        </label>
        <label className="block">
          <span className="flex items-center justify-between text-xs text-[#a99bc9]">Description <span>{value.description.length}/300</span></span>
          <textarea maxLength={300} rows={2} aria-invalid={hasSubmitted && !value.description.trim()} value={value.description} onChange={(event) => onChange({ ...value, description: event.target.value })} placeholder="A short summary shown in the workout list" className={`${inputClass} resize-y ${hasSubmitted && !value.description.trim() ? 'border-rose-400' : ''}`} />
        </label>
        <label className="block">
          <span className="flex items-center justify-between text-xs text-[#a99bc9]">Content <span>{value.content.length}/2000</span></span>
          <textarea maxLength={2000} rows={4} value={value.content} onChange={(event) => onChange({ ...value, content: event.target.value })} placeholder="How to use this workout, progression and tips" className={`${inputClass} resize-y`} />
        </label>
        <label className="block">
          <span className="text-xs text-[#a99bc9]">Type</span>
          <select value={value.type} onChange={(event) => onChange({ ...value, type: event.target.value as CreateWorkoutRequest['type'] })} className={inputClass}>
            <option value="WORKOUT">Workout</option>
            <option value="DAILY_TRAINING_PLAN">Daily training plan</option>
          </select>
        </label>
        {isDailyPlan ? (
          <p className="rounded-lg border border-violet-400/20 bg-violet-400/5 px-3 py-2 text-xs text-[#c7b9e2]">
            Build one fixed 7-day schedule. Configure sets and reps separately for Beginner, Intermediate and Advanced. A day with no exercises is a rest day.
          </p>
        ) : (
          <label className="block">
            <span className="text-xs text-[#a99bc9]">Level</span>
            <select value={value.level} onChange={(event) => onChange({ ...value, level: event.target.value })} className={inputClass}>
              <option>Beginner</option><option>Intermediate</option><option>Advanced</option>
            </select>
          </label>
        )}
      </section>

      {isDailyPlan && (
        <section className="rounded-2xl border border-[#30264b] bg-[#19152a] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#e5def2]">7-day training schedule</h2>
              <p className="mt-1 text-xs text-[#a99bc9]">Select a day to add exercises. Leave it empty for a rest day.</p>
            </div>
            <span className="text-xs text-[#a99bc9]">{allPlanItems.length} scheduled exercise{allPlanItems.length === 1 ? '' : 's'}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {WEEK_DAYS.map((day, index) => {
              const number = index + 1;
              const count = allPlanItems.filter((item) => item.dayOfWeek === number).length;
              return (
                <button key={day} type="button" aria-pressed={selectedPlanDay === number} onClick={() => onSelectedPlanDayChange(number)} className={`rounded-lg border px-2 py-3 text-left transition-colors ${selectedPlanDay === number ? 'border-violet-400 bg-violet-500/15' : 'border-[#49386c] bg-[#100b20] hover:border-violet-400/50'}`}>
                  <span className="block text-xs font-semibold text-white">{day}</span>
                  <span className="mt-1 block text-[10px] text-[#a99bc9]">{count ? `${count} exercise${count === 1 ? '' : 's'}` : 'Rest day'}</span>
                </button>
              );
            })}
          </div>
          <div className={`mt-4 rounded-xl border p-3 sm:p-4 ${hasSubmitted && allPlanItems.length === 0 ? 'border-rose-400/70' : 'border-[#49386c]'}`}>
            <h3 className="text-xs font-semibold text-white">{WEEK_DAYS[selectedPlanDay - 1]} exercises</h3>
            {dayItems.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#a99bc9]">Rest day — add exercises below to make this a training day.</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {dayItems.map((item, index) => (
                  <li key={`${item.dayOfWeek}-${item.exerciseCode}`} className="rounded-lg border border-[#49386c] bg-[#100b20] p-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#302354] text-xs text-violet-200">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-white">{allEntries.find((entry) => entry.code === item.exerciseCode)?.name ?? item.exerciseCode}</p>
                        <p className="mt-0.5 truncate text-[10px] text-[#a99bc9]">{allEntries.find((entry) => entry.code === item.exerciseCode)?.muscleGroup}</p>
                      </div>
                      <button type="button" aria-label={`Remove ${item.exerciseCode} from ${WEEK_DAYS[selectedPlanDay - 1]}`} onClick={() => removeExercise(item.exerciseCode)} className="rounded-md border border-rose-400/40 px-2 py-1 text-sm text-rose-300 hover:bg-rose-400/10">×</button>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <PlanLevelInputs label="Beginner" sets={item.beginnerSets} reps={item.beginnerReps} onSetsChange={(n) => updatePlanItem(item.exerciseCode, 'beginnerSets', n)} onRepsChange={(n) => updatePlanItem(item.exerciseCode, 'beginnerReps', n)} />
                      <PlanLevelInputs label="Intermediate" sets={item.intermediateSets} reps={item.intermediateReps} onSetsChange={(n) => updatePlanItem(item.exerciseCode, 'intermediateSets', n)} onRepsChange={(n) => updatePlanItem(item.exerciseCode, 'intermediateReps', n)} />
                      <PlanLevelInputs label="Advanced" sets={item.advancedSets} reps={item.advancedReps} onSetsChange={(n) => updatePlanItem(item.exerciseCode, 'advancedSets', n)} onRepsChange={(n) => updatePlanItem(item.exerciseCode, 'advancedReps', n)} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      )}

      <ExerciseSelector
        entries={entries}
        totalCount={totalExerciseCount}
        isLoading={isLoadingExercises}
        isError={isExerciseLoadError}
        search={search}
        onSearchChange={onSearchChange}
        level={level}
        onLevelChange={onLevelChange}
        selectedCodes={addedCodes}
        onAdd={addExercise}
        heading={isDailyPlan ? `Add exercises to ${WEEK_DAYS[selectedPlanDay - 1]}` : 'System exercises'}
      />

      {!isDailyPlan && (
        <section className={`rounded-2xl border bg-[#19152a] p-4 sm:p-5 ${hasSubmitted && value.exerciseCodes.length === 0 ? 'border-rose-400/70' : 'border-[#30264b]'}`}>
          <h2 className="text-sm font-semibold text-[#e5def2]">Workout exercises</h2>
          {value.exerciseCodes.length === 0 ? (
            <p className="py-12 text-center text-xs text-[#a99bc9]">No exercises yet. Add some from the list.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {value.exerciseCodes.map((code, index) => {
                const entry = allEntries.find((exercise) => exercise.code === code);
                return (
                  <li key={code} className="flex items-center gap-3 rounded-lg border border-[#49386c] bg-[#100b20] px-3 py-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#302354] text-xs text-violet-200">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-white">{entry?.name ?? code}</p>
                      <p className="truncate text-[10px] text-[#a99bc9]">{entry?.muscleGroup ?? 'Selected system exercise'}</p>
                    </div>
                    <button type="button" aria-label={`Remove ${entry?.name ?? code}`} onClick={() => removeExercise(code)} className="rounded-md border border-rose-400/40 px-2 py-1 text-sm text-rose-300 hover:bg-rose-400/10">×</button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}
    </>
  );
}

function ExerciseSelector({
  entries,
  totalCount,
  isLoading,
  isError,
  search,
  onSearchChange,
  level,
  onLevelChange,
  selectedCodes,
  onAdd,
  heading,
}: {
  entries: ExerciseEntry[];
  totalCount: number;
  isLoading: boolean;
  isError: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  level: string;
  onLevelChange: (value: string) => void;
  selectedCodes: string[];
  onAdd: (entry: ExerciseEntry) => void;
  heading: string;
}) {
  return (
    <section className="rounded-2xl border border-[#30264b] bg-[#19152a] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#e5def2]">{heading}</h2>
        <span className="text-xs text-[#a99bc9]">{totalCount} in system</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search by title" className="min-w-32 flex-1 rounded-lg border border-[#49386c] bg-[#100b20] px-3 py-2 text-xs text-white outline-none placeholder:text-[#74678e] focus:border-violet-400" />
        <select value={level} onChange={(event) => onLevelChange(event.target.value)} aria-label="Filter exercises by level" className="rounded-lg border border-[#49386c] bg-[#100b20] px-3 py-2 text-xs text-white">
          <option value="all">All levels</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
        </select>
      </div>
      <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {isLoading ? (
          <p role="status" className="py-8 text-center text-xs text-[#a99bc9]">Loading system exercises…</p>
        ) : isError ? (
          <p role="alert" className="py-8 text-center text-xs text-rose-200">Could not load system exercises.</p>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#a99bc9]">No active exercises match this search.</p>
        ) : entries.map((entry) => (
          <ExercisePickerRow
            key={entry.code}
            entry={entry}
            alreadyAdded={selectedCodes.includes(entry.code)}
            onAdd={() => onAdd(entry)}
          />
        ))}
      </div>
    </section>
  );
}

function PlanLevelInputs({ label, sets, reps, onSetsChange, onRepsChange }: {
  label: string;
  sets: number;
  reps: number;
  onSetsChange: (value: number) => void;
  onRepsChange: (value: number) => void;
}) {
  return (
    <fieldset className="rounded-md border border-[#382d55] p-2">
      <legend className="px-1 text-[10px] font-medium text-violet-200">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[9px] text-[#a99bc9]">Sets
          <input type="number" min={1} max={20} required value={sets} onChange={(event) => onSetsChange(Number(event.target.value))} className="mt-1 w-full rounded border border-[#49386c] bg-[#17112e] px-2 py-1.5 text-xs text-white outline-none focus:border-violet-400" />
        </label>
        <label className="text-[9px] text-[#a99bc9]">Reps
          <input type="number" min={1} max={100} required value={reps} onChange={(event) => onRepsChange(Number(event.target.value))} className="mt-1 w-full rounded border border-[#49386c] bg-[#17112e] px-2 py-1.5 text-xs text-white outline-none focus:border-violet-400" />
        </label>
      </div>
    </fieldset>
  );
}

function ExercisePickerRow({ entry, alreadyAdded, onAdd }: { entry: ExerciseEntry; alreadyAdded: boolean; onAdd: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#382d55] bg-[#100b20] p-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#302354] text-violet-200" aria-hidden="true">✣</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-xs font-medium text-white">{entry.name}</span>
          <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] text-emerald-200">{entry.level}</span>
        </div>
        <p className="mt-0.5 truncate text-[10px] text-[#a99bc9]">{entry.muscleGroup}</p>
      </div>
      <button type="button" disabled={alreadyAdded} onClick={onAdd} className="shrink-0 rounded-md border border-violet-400/60 px-2.5 py-1.5 text-[10px] font-medium text-violet-200 hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:opacity-40">
        {alreadyAdded ? 'Added' : '+ Add'}
      </button>
    </div>
  );
}

export function Breadcrumb({ current }: { current: string }) {
  return (
    <p className="text-xs text-[#a99bc9]">
      <Link to="/content/dashboard" className="hover:text-white">Content manager</Link>
      <span className="mx-1.5">/</span>
      <Link to="/content/exercises" className="hover:text-white">Exercise &amp; Workout Management</Link>
      <span className="mx-1.5">/</span>
      <span className="text-violet-200">{current}</span>
    </p>
  );
}

function getRequestErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return 'The server rejected the login token. Your form is still here; sign in again as a Content Manager, then retry.';
    }
    if (error.status === 403) {
      return 'Your account does not have permission to create exercises. Sign in with a Content Manager account.';
    }
    return error.message;
  }
  if (axios.isAxiosError(error)) {
    const responseData: unknown = error.response?.data;
    if (error.response?.status === 401) {
      return 'The server did not accept your login session. Your form is still here; verify you are signed in as a Content Manager, then try again.';
    }
    if (error.response?.status === 403) {
      return 'Your account does not have permission to create exercises. Sign in with a Content Manager account.';
    }
    if (typeof responseData === 'string' && responseData.trim()) return responseData;
    if (responseData && typeof responseData === 'object' && 'message' in responseData
      && typeof responseData.message === 'string') {
      return responseData.message;
    }
    if (error.response?.status === 413) return 'The uploaded file is too large. Choose a smaller file.';
    if (!error.response) return 'Could not reach the server. Check that Spring Boot is running and try again.';
    return `The server rejected the request (HTTP ${error.response.status}).`;
  }
  return error instanceof Error ? error.message : 'Could not create the exercise. Please try again.';
}

function getExerciseFieldErrors(message: string): ExerciseField[] {
  const normalized = message.toLowerCase();
  const fields: ExerciseField[] = [];
  if (normalized.includes('title') || normalized.includes('name')) fields.push('title');
  if (normalized.includes('type')) fields.push('type');
  if (normalized.includes('level')) fields.push('level');
  if (normalized.includes('muscle')) fields.push('muscles');
  if (normalized.includes('video') || normalized.includes('mp4') || normalized.includes('mov') || normalized.includes('webm')) fields.push('demoVideo');
  if (normalized.includes('image') || normalized.includes('jpg') || normalized.includes('png')) fields.push('anatomyImage');
  if (normalized.includes('exercise data')) fields.push('title', 'type', 'level', 'muscles');
  return [...new Set(fields)];
}
