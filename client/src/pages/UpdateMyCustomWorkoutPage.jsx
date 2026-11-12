import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  getApiErrorMessage,
  validateWorkoutDescription,
  validateWorkoutExercises,
  validateWorkoutName,
} from "./libraryFormValidation";
import { getAvailableWorkoutExercises, getMyWorkout, updateMyWorkout } from "../api/library";
import useUndoDelete from "../hooks/useUndoDelete";
import ConfirmDialog from "../components/common/ConfirmDialog";
import { getLevelBadgeStyle } from "../utils/levelBadge";
import { getLevelLabel } from "../utils/levelLabel";
import { localizeSeed } from "../utils/seedText";
import { useSystemLevels } from "../useSystemLevels";

const LEVEL_PRIORITY = { Beginner: 1, Intermediate: 2, Advanced: 3 };
// Số bài mỗi trang, giống màn chỉnh sửa workout của Content Manager.
const SYSTEM_PAGE_SIZE = 6;
const ITEM_PAGE_SIZE = 4;
const DEFAULT_EXERCISES = [
  { id: "pike-push-up", name: "Pike push-up", level: "Intermediate", sets: 3, reps: 8, restSec: 45, countBy: "reps" },
  { id: "diamond-push-up", name: "Diamond push-up", level: "Intermediate", sets: 3, reps: 10, restSec: 45, countBy: "reps" },
  { id: "plank", name: "Plank", level: "Beginner", sets: 3, reps: 30, restSec: 30, countBy: "sec" },
];

function createExerciseList(workout) {
  if (Array.isArray(workout?.exercises) && workout.exercises.length > 0) {
    return workout.exercises.map((exercise, index) => ({
      uniqueKey: `${exercise.id || exercise.code || `exercise-${index}`}_${Date.now()}_${index}`,
      id: exercise.id || exercise.code || `exercise-${index}`,
      exerciseId: exercise.id || exercise.code || `exercise-${index}`,
      name: exercise.name || exercise.title || "Exercise",
      level: exercise.level || "Beginner",
      sets: exercise.sets ?? 3,
      reps: exercise.reps ?? 8,
      restSec: exercise.restSec ?? 45,
      countBy: exercise.countBy === "Duration" ? "sec" : exercise.countBy || "reps",
    }));
  }
  return DEFAULT_EXERCISES.map((exercise, index) => ({
    ...exercise,
    uniqueKey: `${exercise.id}_${Date.now()}_${index}`,
    exerciseId: exercise.id,
  }));
}

/**
 * Mã bài tập hệ thống dạng "EX_123" — server yêu cầu `exerciseId` là số, nên các bài tập
 * không có id số (bài mẫu cũ trong localStorage) sẽ không gửi được lên API.
 */
function isNumericId(id) {
  return /^\d+$/.test(String(id ?? "").trim());
}

function DumbbellIcon({ size = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={`${size} text-[#9d7aff]`} aria-hidden="true">
      <rect x="2" y="9" width="4" height="6" rx="1" />
      <rect x="18" y="9" width="4" height="6" rx="1" />
      <line x1="6" y1="12" x2="18" y2="12" />
      <line x1="8" y1="8" x2="8" y2="16" />
      <line x1="16" y1="8" x2="16" y2="16" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

function LevelBadge({ level }) {
  const displayLevel = level || "Beginner";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${getLevelBadgeStyle(displayLevel)}`}>
      {getLevelLabel(displayLevel)}
    </span>
  );
}

/** Số trang hiển thị dạng 1 … 4 5 … 12 (giống bộ chọn của Content Manager). */
function getPaginationItems(currentPage, pageCount) {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const pages = [...new Set([1, currentPage - 1, currentPage, currentPage + 1, pageCount])]
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((first, second) => first - second);
  return pages.flatMap((page, index) => {
    const previousPage = pages[index - 1];
    if (previousPage && page - previousPage > 1) {
      return [`ellipsis-${previousPage}-${page}`, page];
    }
    return [page];
  });
}

function Pager({ page, pageCount, total, pageSize, noun, onChange, ariaLabel }) {
  const { t } = useTranslation();
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const items = getPaginationItems(page, pageCount);
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-[#231b46] pt-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[11px] text-slate-400">
        {t("member.personal.showingRange", { from, to, total, noun })}
      </p>
      {pageCount > 1 && (
        <nav aria-label={ariaLabel} className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => onChange(page - 1)}
            disabled={page <= 1}
            aria-label={t("member.personal.previous")}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#2b2257] bg-[#0d0922] px-2.5 text-xs font-medium text-slate-300 transition-colors hover:border-violet-500/60 hover:bg-[#181238] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="hidden sm:inline">{t("member.personal.previous")}</span>
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M12.78 4.22a.75.75 0 010 1.06L8.06 10l4.72 4.72a.75.75 0 11-1.06 1.06l-5.25-5.25a.75.75 0 010-1.06l5.25-5.25a.75.75 0 011.06 0z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="flex items-center gap-1">
            {items.map((item) => typeof item === "number" ? (
              <button
                key={item}
                type="button"
                onClick={() => onChange(item)}
                aria-current={item === page ? "page" : undefined}
                aria-label={t("member.personal.pageAria", { page: item })}
                className={`h-9 min-w-9 rounded-lg border px-2 text-xs font-semibold transition-colors ${
                  item === page
                    ? "border-violet-400 bg-[#643bf6] text-white shadow-sm shadow-violet-950/50"
                    : "border-transparent bg-transparent text-slate-400 hover:border-[#2b2257] hover:bg-[#161133] hover:text-white"
                }`}
              >
                {item}
              </button>
            ) : (
              <span key={item} aria-hidden="true" className="flex h-9 w-5 items-center justify-center text-xs text-slate-500">…</span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onChange(page + 1)}
            disabled={page >= pageCount}
            aria-label={t("member.personal.next")}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#2b2257] bg-[#0d0922] px-2.5 text-xs font-medium text-slate-300 transition-colors hover:border-violet-500/60 hover:bg-[#181238] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="hidden sm:inline">{t("member.personal.next")}</span>
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M7.22 15.78a.75.75 0 010-1.06L11.94 10 7.22 5.28a.75.75 0 011.06-1.06l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 01-1.06 0z" clipRule="evenodd" />
            </svg>
          </button>
        </nav>
      )}
    </div>
  );
}

export default function UpdateMyCustomWorkoutPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const submissionLock = useRef(false);
  const { requestDelete, confirmationModal } = useUndoDelete();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [workout, setWorkout] = useState(null);
  const [availableExercises, setAvailableExercises] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [exercises, setExercises] = useState([]);
  const [baseline, setBaseline] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [touchedFields, setTouchedFields] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  // Level do Content Manager cấu hình động nên danh sách level lấy từ hệ thống.
  const { levels: levelNames } = useSystemLevels();
  // Cấp độ của workout: mặc định lấy theo bài tập khó nhất, nhưng người dùng có thể đổi.
  const [workoutLevel, setWorkoutLevel] = useState("");
  const [exerciseSearch, setExerciseSearch] = useState("");
  // Lọc theo cấp độ + phân trang, giống màn chỉnh sửa workout của Content Manager.
  const [exerciseLevelFilter, setExerciseLevelFilter] = useState("");
  const [systemPage, setSystemPage] = useState(1);
  const [itemPage, setItemPage] = useState(1);

  useEffect(() => {
    let active = true;
    Promise.all([getMyWorkout(id), getAvailableWorkoutExercises()])
      .then(([currentWorkout, available]) => {
        if (!active) return;
        const normalizedAvailable = available.map((exercise) => ({
          id: exercise.id,
          name: exercise.title,
          level: String(exercise.level).toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase()),
          muscles: exercise.targetMuscle,
          defaultSets: exercise.defaultSets,
          defaultReps: exercise.defaultReps,
          defaultDuration: exercise.defaultDuration,
          countBy: exercise.defaultDuration ? "sec" : "reps",
          reps: exercise.defaultDuration || exercise.defaultReps || 8,
        }));
        const availableById = new Map(normalizedAvailable.map((exercise) => [String(exercise.id), exercise]));
        const initialExercises = createExerciseList(currentWorkout).map((exercise) => {
          const match = availableById.get(String(exercise.id));
          return match
            ? { ...exercise, muscles: match.muscles, level: match.level || exercise.level }
            : exercise;
        });
        // Level đã lưu; nếu workout cũ chưa có level thì suy ra từ bài tập khó nhất.
        const highestExerciseLevel = initialExercises.reduce(
          (current, exercise) =>
            (LEVEL_PRIORITY[exercise.level] || 0) > (LEVEL_PRIORITY[current] || 0)
              ? exercise.level
              : current,
          "Beginner"
        );
        const initialLevel = currentWorkout.level || highestExerciseLevel;
        const initialForm = {
          title: currentWorkout.title || "",
          description: currentWorkout.description || "",
          isShared: Boolean(currentWorkout.isShared),
          level: initialLevel,
          exercises: initialExercises,
        };
        setAvailableExercises(normalizedAvailable);
        setWorkout(currentWorkout);
        setTitle(initialForm.title);
        setDescription(initialForm.description);
        setIsShared(initialForm.isShared);
        setWorkoutLevel(initialLevel);
        setExercises(initialExercises);
        setBaseline(JSON.stringify(initialForm));
      })
      .catch((error) => {
        if (active) setErrorMessage(error.response?.data?.message || t("member.personal.couldNotLoadWorkout"));
      });
    return () => {
      active = false;
    };
  }, [id]);

  const totalSets = exercises.reduce((total, exercise) => {
    const sets = Number(exercise.sets);
    return total + (Number.isFinite(sets) ? sets : 0);
  }, 0);
  const totalDurationSeconds = exercises.reduce((total, exercise) => {
    const sets = Number(exercise.sets) || 1;
    const restSeconds = Number(exercise.restSec) || 0;
    const isDurationExercise = exercise.countBy === "sec"
      || exercise.countBy === "SECONDS"
      || exercise.duration != null;
    const durationSeconds = isDurationExercise
      ? Number(exercise.duration ?? exercise.reps) || 0
      : 0;
    return total + (durationSeconds * sets) + (restSeconds * sets);
  }, 0);
  const totalTimeLabel = totalDurationSeconds >= 60
    ? `${Math.floor(totalDurationSeconds / 60)} min ${totalDurationSeconds % 60} sec`
    : `${totalDurationSeconds} sec`;
  const suggestedLevel = exercises.reduce(
    (currentLevel, exercise) =>
      LEVEL_PRIORITY[exercise.level] > LEVEL_PRIORITY[currentLevel] ? exercise.level : currentLevel,
    "Beginner"
  );
  // Level đã chọn; nếu chưa chọn thì lấy level cao nhất của các bài tập trong workout.
  const level = workoutLevel || suggestedLevel;
  const currentForm = useMemo(
    () => JSON.stringify({ title, description, isShared, level, exercises }),
    [title, description, isShared, level, exercises]
  );
  const isDirty = baseline !== "" && baseline !== currentForm;
  const nameError = validateWorkoutName(title);
  const descriptionError = validateWorkoutDescription(description);
  const exerciseErrors = validateWorkoutExercises(exercises);
  const validationErrors = {
    ...exerciseErrors,
    ...(nameError ? { name: nameError } : {}),
    ...(descriptionError ? { description: descriptionError } : {}),
    ...(!level ? { level: t("member.personal.pleaseSelectLevel") } : {}),
  };
  const showFieldError = (field) =>
    Boolean((hasSubmitted || touchedFields[field]) && validationErrors[field]);
  const markFieldTouched = (field) =>
    setTouchedFields((current) => ({ ...current, [field]: true }));
  const focusFirstInvalidField = () => {
    const firstInvalidId = [
      "workout-title",
      "workout-description",
      "workout-level",
      "workout-exercises",
      ...exercises.flatMap((_, index) => [
        `workout-sets-${index}`,
        `workout-reps-${index}`,
        `workout-rest-${index}`,
      ]),
    ].find((id) => {
      if (id === "workout-title") return validationErrors.name;
      if (id === "workout-description") return validationErrors.description;
      if (id === "workout-level") return validationErrors.level;
      if (id === "workout-exercises") return validationErrors.list;
      const [, field, index] = id.match(/^workout-(sets|reps|rest)-(\d+)$/) || [];
      return field && validationErrors[`${field}-${index}`];
    });
    if (!firstInvalidId) return;
    // Bài lỗi có thể nằm ở trang khác — mở đúng trang rồi mới cuộn tới.
    const matched = firstInvalidId.match(/^workout-(sets|reps|rest)-(\d+)$/);
    if (matched) {
      const index = Number(matched[2]);
      setItemPage(Math.floor(index / ITEM_PAGE_SIZE) + 1);
    }
    window.setTimeout(() => {
      const firstInvalid = document.getElementById(firstInvalidId);
      firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
      firstInvalid?.focus();
    }, 60);
  };

  const updateExercise = (index, field, value) => {
    setExercises((current) =>
      current.map((exercise, currentIndex) =>
        currentIndex === index ? { ...exercise, [field]: value } : exercise
      )
    );
  };

  const removeExercise = (index) => {
    const exercise = exercises[index];
    if (!exercise) return;
    requestDelete({
      onOptimisticDelete: () => {
        setExercises((current) => current.filter((_, currentIndex) => currentIndex !== index));
      },
      onUndo: () => {
        setExercises((current) => {
          if (current.some((item) => item.uniqueKey === exercise.uniqueKey)) {
            return current;
          }
          const restored = [...current];
          restored.splice(Math.max(0, Math.min(index, restored.length)), 0, exercise);
          return restored;
        });
      },
      onDelete: async () => {},
      successMessage: t("member.personal.exerciseRemoved"),
    });
  };

  const addExercise = (exercise) => {
    const byDuration = exercise.countBy === "sec";
    setExercises((current) => [
      ...current,
      {
        ...exercise,
        uniqueKey: `${exercise.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        exerciseId: exercise.id,
        sets: exercise.defaultSets ?? 3,
        reps: byDuration ? exercise.defaultDuration ?? 30 : exercise.defaultReps ?? 10,
        restSec: 60,
      },
    ]);
    // Chuyển tới trang chứa bài vừa thêm.
    setItemPage(Math.floor(exercises.length / ITEM_PAGE_SIZE) + 1);
  };

  /**
   * Danh sách bài tập hệ thống có thể thêm, lọc theo tên và cấp độ — giống bộ chọn
   * bài tập của màn chỉnh sửa workout trong phần Content Manager.
   */
  const filteredAvailableExercises = useMemo(() => {
    const needle = exerciseSearch.trim().toLowerCase();
    const level = exerciseLevelFilter.trim().toLowerCase();
    return availableExercises.filter((exercise) => {
      const matchesName = !needle
        || String(exercise.name || "").toLowerCase().includes(needle);
      const matchesLevel = !level
        || String(exercise.level || "").trim().toLowerCase() === level;
      return matchesName && matchesLevel;
    });
  }, [availableExercises, exerciseSearch, exerciseLevelFilter]);

  const systemPageCount = Math.max(1, Math.ceil(filteredAvailableExercises.length / SYSTEM_PAGE_SIZE));
  const currentSystemPage = Math.min(systemPage, systemPageCount);
  const pagedAvailableExercises = filteredAvailableExercises.slice(
    (currentSystemPage - 1) * SYSTEM_PAGE_SIZE,
    currentSystemPage * SYSTEM_PAGE_SIZE
  );
  const itemPageCount = Math.max(1, Math.ceil(exercises.length / ITEM_PAGE_SIZE));
  const currentItemPage = Math.min(itemPage, itemPageCount);
  const itemOffset = (currentItemPage - 1) * ITEM_PAGE_SIZE;
  const pagedExercises = exercises.slice(itemOffset, itemOffset + ITEM_PAGE_SIZE);

  // Đổi từ khoá hoặc cấp độ thì quay về trang đầu.
  useEffect(() => {
    setSystemPage(1);
  }, [exerciseSearch, exerciseLevelFilter]);

  const moveExercise = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= exercises.length) return;
    setExercises((current) => {
      const reordered = [...current];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      return reordered;
    });
  };

  // Đổi thứ tự bằng nút mũi tên, giống màn chỉnh sửa workout của Content Manager.
  const moveExerciseBy = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= exercises.length) return;
    moveExercise(index, target);
    // Bài chuyển sang trang khác thì đi theo nó.
    setItemPage(Math.floor(target / ITEM_PAGE_SIZE) + 1);
  };

  const handleSave = async () => {
    if (!workout || submissionLock.current) return;
    setHasSubmitted(true);
    if (Object.keys(validationErrors).length > 0) {
      toast.warning(t("member.personal.fillRequiredFields"));
      focusFirstInvalidField();
      return;
    }

    // Server bắt buộc `exerciseId` là id bài tập thật (số). Bài tập cũ lưu trong
    // localStorage không có id hợp lệ thì không gửi lên được — báo rõ để member xử lý.
    const invalidExercises = exercises.filter((exercise) => !isNumericId(exercise.id));
    if (invalidExercises.length > 0) {
      const message = t("member.personal.invalidExerciseIds", {
        names: invalidExercises.map((exercise) => localizeSeed(exercise.name)).join(", "),
      });
      toast.error(message);
      setErrorMessage(message);
      return;
    }

    submissionLock.current = true;
    setIsSaving(true);
    try {
      await updateMyWorkout(id, {
        title: title.trim(),
        description: description.trim(),
        // Level bắt buộc của API — trước đây thiếu nên mọi lần lưu đều trả 400.
        level,
        isSharedWithCommunity: isShared,
        items: exercises.map((exercise, orderIndex) => ({
          exerciseId: Number(exercise.id),
          orderIndex,
          sets: Number(exercise.sets),
          reps: exercise.countBy === "sec" ? null : Number(exercise.reps),
          duration: exercise.countBy === "sec" ? Number(exercise.reps) : null,
          countBy: exercise.countBy === "sec" ? "SECONDS" : "REPS",
          restSeconds: Number(exercise.restSec),
        })),
      });
      toast.success(t("member.personal.workoutUpdated"));
      navigate("/library/workouts");
    } catch (error) {
      const message = getApiErrorMessage(error, t("member.personal.couldNotSaveWorkoutUpdate"));
      toast.error(message);
      setErrorMessage(message);
    } finally {
      submissionLock.current = false;
      setIsSaving(false);
    }
  };

  if (!workout && !errorMessage) return null;

  return (
    <div className="workout-edit-page mx-auto max-w-6xl pb-24 text-white">
      <style>{`
        .workout-edit-page input[type="number"] {
          appearance: textfield;
          -moz-appearance: textfield;
        }
        .workout-edit-page input[type="number"]::-webkit-inner-spin-button,
        .workout-edit-page input[type="number"]::-webkit-outer-spin-button {
          appearance: none;
          -webkit-appearance: none;
          margin: 0;
        }
        /* Ô nhập liệu (input/textarea/select) mặc định không kế thừa font của trang,
           nên textarea hiển thị khác font các field khác — ép chúng đồng bộ.
           Chỉ ép font-family để không đè kích thước chữ của các class Tailwind. */
        .workout-edit-page input,
        .workout-edit-page textarea,
        .workout-edit-page select {
          font-family: inherit;
        }
      `}</style>
      <button
        type="button"
        onClick={() => navigate("/library/workouts")}
        className="mb-2 inline-flex appearance-none items-center gap-1 rounded-md border border-transparent bg-transparent p-0 text-xs font-medium text-[#bba7ff] transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b6cff]"
      >
        {t("member.personal.backToMyWorkouts")}
      </button>
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">{t("member.personal.updateWorkoutTitle")}</h1>
        <p className="mt-1 text-xs text-slate-400">
          {t("member.personal.updateWorkoutSubtitle")}
        </p>
      </header>

      {errorMessage && (
        <p role="alert" className="mb-4 rounded-xl border border-rose-800/60 bg-rose-950/30 px-4 py-3 text-xs text-rose-300">
          {errorMessage}
        </p>
      )}

      {workout && (
        <>
          <div className="space-y-4">
            {/* Chi tiết workout */}
            <section className="rounded-2xl border border-[#33285f] bg-[#15102e] p-5 shadow-sm shadow-purple-950/20">
              <h2 className="mb-4 text-sm font-semibold">{t("member.personal.workoutDetails")}</h2>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs text-slate-400" htmlFor="workout-title">
                  {t("member.personal.workoutName")}
                </label>
                <span className="text-xs text-slate-400">{title.length} / 60</span>
              </div>
              <input
                id="workout-title"
                value={title}
                maxLength={60}
                onChange={(event) => {
                  setTitle(event.target.value);
                }}
                onBlur={() => {
                  markFieldTouched("name");
                  setTitle((value) => value.trim());
                }}
                className={`mb-1 w-full rounded-lg border ${showFieldError("name") && nameError ? "border-rose-500 focus:border-rose-500" : "border-[#493b79] focus:border-[#8b6cff]"} bg-[#1b1538] px-3 py-2.5 text-sm text-white focus:outline-none`}
              />
              {showFieldError("name") && nameError && <p className="mb-3 text-rose-400 text-[11px] mt-1">{nameError}</p>}
              {!showFieldError("name") || !nameError ? <div className="mb-3" /> : null}
              <label className="mb-1.5 block text-xs text-slate-400" htmlFor="workout-description">
                {t("member.personal.description")}
              </label>
              <textarea
                id="workout-description"
                value={description}
                maxLength={200}
                rows={3}
                onChange={(event) => {
                  setDescription(event.target.value);
                }}
                onBlur={() => {
                  markFieldTouched("description");
                  setDescription((value) => value.trim());
                }}
                className={`w-full resize-none rounded-lg border ${showFieldError("description") && descriptionError ? "border-rose-500 focus:border-rose-500" : "border-[#493b79] focus:border-[#8b6cff]"} bg-[#1b1538] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none`}
              />
              <div className="mb-3 flex justify-between">
                {showFieldError("description") && descriptionError
                  ? <p className="text-rose-400 text-[11px] mt-1">{descriptionError}</p>
                  : <span />}
                <p className="text-right text-[10px] text-slate-400">{description.length} / 200</p>
              </div>
              {/* Cấp độ: mặc định lấy theo bài tập khó nhất, người dùng có thể đổi. */}
              <div className="mb-3">
                <label className="mb-1.5 block text-xs text-slate-400" htmlFor="workout-level">
                  {t("member.personal.level")}
                </label>
                <select
                  id="workout-level"
                  value={level}
                  onChange={(event) => setWorkoutLevel(event.target.value)}
                  className="w-full cursor-pointer rounded-lg border border-[#493b79] bg-[#1b1538] px-3 py-2.5 text-sm text-white focus:border-[#8b6cff] focus:outline-none"
                >
                  {/* Level đang lưu có thể không còn trong danh sách hệ thống — vẫn giữ để không mất dữ liệu. */}
                  {level && !levelNames.includes(level) && (
                    <option value={level}>{getLevelLabel(level)}</option>
                  )}
                  {levelNames.map((name) => (
                    <option key={name} value={name}>{getLevelLabel(name)}</option>
                  ))}
                </select>
                {showFieldError("level") && validationErrors.level && (
                  <p className="mt-1 text-[11px] text-rose-400">{validationErrors.level}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={isShared}
                    onChange={(event) => setIsShared(event.target.checked)}
                    className="peer sr-only"
                  />
                  <span className={`relative flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors ${isShared ? "bg-[#643bf6]" : "bg-[#34285f]"}`}>
                    <span
                      className="h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
                      style={{ transform: isShared ? "translateX(16px)" : "translateX(0)" }}
                    />
                  </span>
                  {t("member.personal.shareWithCommunity")}
                </label>
                <span className="text-[10px] text-slate-400">
                  {t("member.personal.shareHint")}
                </span>
              </div>
            </section>

            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              {/* Bài tập hệ thống — nguồn để thêm vào workout */}
              <section className="rounded-2xl border border-[#33285f] bg-[#15102e] p-5 shadow-sm shadow-purple-950/20">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold">{t("member.personal.acceptedExercises")}</h2>
                  <span className="text-xs text-slate-400">
                    {t("member.personal.availableCount", { count: availableExercises.length })}
                  </span>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="search"
                    value={exerciseSearch}
                    onChange={(event) => setExerciseSearch(event.target.value)}
                    placeholder={t("member.personal.searchByTitle")}
                    aria-label={t("member.personal.searchByTitle")}
                    className="w-full rounded-lg border border-[#493b79] bg-[#1b1538] px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:border-[#8b6cff] focus:outline-none"
                  />
                  <select
                    value={exerciseLevelFilter}
                    onChange={(event) => setExerciseLevelFilter(event.target.value)}
                    aria-label={t("member.personal.allLevels")}
                    className="cursor-pointer rounded-lg border border-[#493b79] bg-[#1b1538] px-3 py-2.5 text-xs text-white focus:border-[#8b6cff] focus:outline-none"
                  >
                    <option value="">{t("member.personal.allLevels")}</option>
                    {levelNames.map((name) => (
                      <option key={name} value={name}>{getLevelLabel(name)}</option>
                    ))}
                  </select>
                </div>
                <div className="mt-3 space-y-2">
                  {pagedAvailableExercises.map((exercise) => (
                    <div
                      key={exercise.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#493b79] bg-[#1b1538] p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#211a45]">
                          <DumbbellIcon />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-white">{localizeSeed(exercise.name)}</span>
                            <LevelBadge level={exercise.level} />
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-400">{exercise.muscles}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addExercise(exercise)}
                        className="shrink-0 rounded-lg border border-[#8d76d6] bg-[#1c1640] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#292052]"
                      >
                        {t("member.personal.addExercise")}
                      </button>
                    </div>
                  ))}
                  {filteredAvailableExercises.length === 0 && (
                    <p className="py-8 text-center text-xs text-slate-500">{t("member.personal.noExercisesFound")}</p>
                  )}
                </div>
                <Pager
                  page={currentSystemPage}
                  pageCount={systemPageCount}
                  total={filteredAvailableExercises.length}
                  pageSize={SYSTEM_PAGE_SIZE}
                  noun={t("member.personal.exerciseNoun", { count: filteredAvailableExercises.length })}
                  onChange={setSystemPage}
                  ariaLabel={t("member.personal.acceptedPagesAria")}
                />
              </section>

              {/* Bài tập trong workout */}
              <section className="rounded-2xl border border-[#33285f] bg-[#15102e] p-5 shadow-sm shadow-purple-950/20">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold">{t("member.personal.workoutExercises")}</h2>
                  <span className="text-xs text-slate-400">
                    {t("member.personal.addedCount", { count: exercises.length })}
                  </span>
                </div>
                {hasSubmitted && exerciseErrors.list && (
                  <p id="workout-exercises" tabIndex={-1} className="mt-2 text-[11px] text-rose-400">{exerciseErrors.list}</p>
                )}
                {exercises.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#211a45]">
                      <DumbbellIcon size="h-6 w-6" />
                    </div>
                    <p className="text-xs font-medium text-slate-400">{t("member.personal.noExercisesAdded")}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{t("member.personal.noExercisesAddedHint")}</p>
                  </div>
                ) : (
                  <ol className="mt-3 space-y-3">
                    {pagedExercises.map((exercise, pageIndex) => {
                      // Chỉ số thật trong workout để đánh số, đổi thứ tự và xoá đúng bài.
                      const index = itemOffset + pageIndex;
                      const byDuration = exercise.countBy === "sec" || exercise.countBy === "SECONDS";
                      return (
                        <li key={exercise.uniqueKey} className="rounded-xl border border-[#493b79] bg-[#1b1538] p-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-[#2a2158] text-[11px] font-bold text-[#a855f7]">
                              {index + 1}
                            </span>
                            <span className="ml-1 min-w-0 flex-1 truncate text-xs font-semibold text-white">
                              {localizeSeed(exercise.name)}
                            </span>
                            <button
                              type="button"
                              onClick={() => moveExerciseBy(index, -1)}
                              disabled={index === 0}
                              aria-label={t("member.personal.moveUpAria")}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#493b79] bg-[#211a45] text-slate-300 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <ChevronUpIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveExerciseBy(index, 1)}
                              disabled={index === exercises.length - 1}
                              aria-label={t("member.personal.moveDownAria")}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#493b79] bg-[#211a45] text-slate-300 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <ChevronDownIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeExercise(index)}
                              aria-label={t("member.personal.removeExerciseNamedAria", { name: exercise.name })}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-700/80 bg-rose-950/60 text-[#ff9a83] transition-colors hover:border-rose-500 hover:bg-rose-900/80 hover:text-white"
                            >
                              <XIcon />
                            </button>
                          </div>
                          {exercise.muscles && (
                            <p className="mt-1 truncate text-[11px] text-slate-400">{exercise.muscles}</p>
                          )}
                          {/* Cách đếm cố định theo bài tập, chỉ hiển thị. */}
                          <div className="mt-2">
                            <p className="mb-1 text-[10px] text-slate-400">{t("member.personal.countBy")}</p>
                            <p className="rounded-lg border border-[#493b79] bg-[#120d29] p-2 text-center text-xs font-semibold text-white">
                              {byDuration
                                ? t("member.personal.countByDuration", { seconds: exercise.reps })
                                : t("member.personal.countBySetsReps")}
                            </p>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            <div>
                              <label className="mb-1 block text-[10px] text-slate-400" htmlFor={`workout-sets-${index}`}>
                                {t("member.personal.sets")}
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="100"
                                step="1"
                                id={`workout-sets-${index}`}
                                aria-label={t("member.personal.setsAria", { name: exercise.name })}
                                value={exercise.sets}
                                onChange={(event) => {
                                  updateExercise(index, "sets", event.target.value);
                                }}
                                onBlur={() => markFieldTouched(`sets-${index}`)}
                                className={`w-full rounded-lg border ${showFieldError(`sets-${index}`) && exerciseErrors[`sets-${index}`] ? "border-rose-500 focus:border-rose-500" : "border-[#643bf6]/70"} bg-[#120d29] px-1 py-2 text-center text-xs text-white focus:outline-none`}
                              />
                              {showFieldError(`sets-${index}`) && exerciseErrors[`sets-${index}`] && <p className="mt-1 text-[11px] text-rose-400">{exerciseErrors[`sets-${index}`]}</p>}
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] text-slate-400" htmlFor={`workout-reps-${index}`}>
                                {byDuration ? t("member.personal.durationSeconds") : t("member.personal.reps")}
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="2147483647"
                                step="1"
                                id={`workout-reps-${index}`}
                                aria-label={t("member.personal.repsAria", { name: exercise.name })}
                                value={exercise.reps}
                                onChange={(event) => {
                                  updateExercise(index, "reps", event.target.value);
                                }}
                                onBlur={() => markFieldTouched(`reps-${index}`)}
                                className={`w-full rounded-lg border ${showFieldError(`reps-${index}`) && exerciseErrors[`reps-${index}`] ? "border-rose-500 focus:border-rose-500" : "border-[#643bf6]/70"} bg-[#120d29] px-1 py-2 text-center text-xs text-white focus:outline-none`}
                              />
                              {showFieldError(`reps-${index}`) && exerciseErrors[`reps-${index}`] && <p className="mt-1 text-[11px] text-rose-400">{exerciseErrors[`reps-${index}`]}</p>}
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] text-slate-400" htmlFor={`workout-rest-${index}`}>
                                {t("member.personal.restSec")}
                              </label>
                              <input
                                type="number"
                                min="10"
                                max="180"
                                step="5"
                                id={`workout-rest-${index}`}
                                aria-label={t("member.personal.restAria", { name: exercise.name })}
                                value={exercise.restSec}
                                onChange={(event) => {
                                  updateExercise(index, "restSec", event.target.value);
                                }}
                                onBlur={() => markFieldTouched(`rest-${index}`)}
                                className={`w-full rounded-lg border ${showFieldError(`rest-${index}`) && exerciseErrors[`rest-${index}`] ? "border-rose-500 focus:border-rose-500" : "border-[#643bf6]/70"} bg-[#120d29] px-1 py-2 text-center text-xs text-white focus:outline-none`}
                              />
                              {showFieldError(`rest-${index}`) && exerciseErrors[`rest-${index}`] && <p className="mt-1 text-[11px] text-rose-400">{exerciseErrors[`rest-${index}`]}</p>}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
                {exercises.length > 0 && (
                  <Pager
                    page={currentItemPage}
                    pageCount={itemPageCount}
                    total={exercises.length}
                    pageSize={ITEM_PAGE_SIZE}
                    noun={t("member.personal.exerciseNoun", { count: exercises.length })}
                    onChange={setItemPage}
                    ariaLabel={t("member.personal.workoutExercisePagesAria")}
                  />
                )}
                {exercises.length > 0 && (
                  <p className="mt-2 text-xs text-slate-400">
                    {t("member.personal.totalsLine", {
                      count: exercises.length,
                      exerciseNoun: t("member.personal.exerciseNoun", { count: exercises.length }),
                      sets: totalSets,
                      setNoun: t("member.personal.setNoun", { count: totalSets }),
                      minutes: Math.max(Math.round(totalDurationSeconds / 60), 1),
                    })}
                  </p>
                )}
              </section>
            </div>

            {/* Tóm tắt */}
            <section className="rounded-2xl border border-[#33285f] bg-[#15102e] p-5 shadow-sm shadow-purple-950/20">
              <h2 className="mb-4 text-sm font-semibold">{t("member.personal.summary")}</h2>
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div className="flex items-center justify-between gap-2 border-b border-[#231b46] pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3">
                  <span className="text-[#8a81ad]">{t("member.personal.level")}</span>
                  <LevelBadge level={level} />
                </div>
                <div className="flex items-center justify-between gap-2 border-b border-[#231b46] pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3">
                  <span className="text-[#8a81ad]">{t("member.personal.exercises")}</span>
                  <strong className="font-bold text-white">{exercises.length}</strong>
                </div>
                <div className="flex items-center justify-between gap-2 border-b border-[#231b46] pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3">
                  <span className="text-[#8a81ad]">{t("member.personal.totalSets")}</span>
                  <strong className="font-bold text-white">{totalSets}</strong>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#8a81ad]">{t("member.personal.totalTime")}</span>
                  <strong className="font-bold text-white">{totalTimeLabel}</strong>
                </div>
              </div>
              <p className="mt-4 text-[10px] leading-relaxed text-slate-400">
                {t("member.personal.summaryNote")}
              </p>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                {t("member.personal.summaryLevelNote")}
              </p>
            </section>
          </div>

          {confirmationModal}
          <ConfirmDialog
            open={confirmCancel}
            title={t("member.personal.discardChangesTitle")}
            message={t("member.personal.discardChangesMessage")}
            confirmLabel={t("member.personal.discard")}
            onCancel={() => setConfirmCancel(false)}
            onConfirm={() => navigate(-1)}
          />

          <footer className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-between border-t border-[#231b46] bg-[#0c0822] px-5 py-3 lg:pl-[calc(var(--sidebar-width)+32px)]">
            <span className={`flex items-center gap-2 text-xs ${isDirty ? "text-amber-300" : "text-slate-500"}`}>
              {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />}
              {isDirty ? t("member.personal.unsavedChanges") : t("member.personal.allChangesSaved")}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="rounded-lg border border-[#514778] bg-[#120d29] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#201748]"
              >
                {t("member.personal.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty || isSaving || Object.keys(validationErrors).length > 0}
                className="rounded-lg bg-[#643bf6] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#522cd9] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving && <span className="mr-2 inline-block h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent align-[-2px] animate-spin" />}
                {isSaving ? t("member.personal.saving") : t("member.personal.saveChanges")}
              </button>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
