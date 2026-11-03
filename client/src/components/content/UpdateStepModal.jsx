import { useCallback, useEffect, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import LibraryAddOutlinedIcon from "@mui/icons-material/LibraryAddOutlined";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ModalShell from "../common/ModalShell";
import QuestionEditor from "./QuestionEditor";
import { contentSurveyApi } from "../../api/contentSurvey";
import { surveyErrorMessage } from "../../api/survey";
import { questionLabel } from "../../utils/survey";
import {
  DESCRIPTION_MAX,
  STATUS_LABELS,
  blankRow,
  errorDetails,
  questionToRow,
  rangeText,
  rowProblems,
  rowSummary,
  rowToInput,
  typeLabel,
} from "../../utils/contentSurvey";
import "./ContentSurvey.css";

const STATUSES = ["ACTIVE", "DRAFT", "INACTIVE"];

/**
 * Popup Create / Update step (Figma: survey-update-step), câu hỏi soạn ngay trong popup kiểu Google Form:
 * "New question" tạo câu mới, "Add existing" lấy lại câu có sẵn trong ngân hàng; mỗi câu bấm để mở editor.
 * stepId = null -> Create step: bước mới ở DRAFT, lưu cả câu hỏi trong 1 request rồi quay về trang Survey.
 * Save changes gửi toàn bộ popup trong 1 request (F4), kèm revision để không ghi đè người khác.
 */
export default function UpdateStepModal({ open, stepId, totalSteps, onClose, onSaved }) {
  const isCreate = stepId == null;
  const [state, setState] = useState({ status: "idle" }); // loading | ready | error
  const [form, setForm] = useState({ stepName: "", description: "", status: "DRAFT", questions: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null); // { text, details, stale }
  const [dragKey, setDragKey] = useState(null);
  const [expandedKey, setExpandedKey] = useState(null);
  const [picker, setPicker] = useState(null); // { search, items, loading } khi đang Add existing

  const load = useCallback(() => {
    setError(null);
    setPicker(null);
    setExpandedKey(null);
    if (isCreate) {
      setForm({ stepName: "", description: "", status: "DRAFT", questions: [] });
      setState({ status: "ready", step: null });
      return;
    }
    setState({ status: "loading" });
    contentSurveyApi
      .getStep(stepId)
      .then(({ step, questions }) => {
        setForm({
          stepName: step.stepName,
          description: step.description ?? "",
          status: step.status,
          // câu đã tắt không hiện: gửi lại sẽ bật lại liên kết cũ
          questions: questions.filter((q) => q.active).map(questionToRow),
        });
        setState({ status: "ready", step });
      })
      .catch((err) => setState({ status: "error", message: surveyErrorMessage(err, "We could not load this step.") }));
  }, [isCreate, stepId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Add existing: tải câu hỏi có thể thêm, lọc theo ô tìm kiếm (trễ 250ms)
  const pickerSearch = picker?.search;
  useEffect(() => {
    if (pickerSearch === undefined) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      contentSurveyApi
        .availableQuestions(stepId, pickerSearch.trim())
        .then((items) => active && setPicker((p) => p && { ...p, items, loading: false }))
        .catch((err) => active && setPicker((p) => p && { ...p, items: [], loading: false, error: surveyErrorMessage(err) }));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [pickerSearch, stepId]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const setQuestions = (update) => setForm((f) => ({ ...f, questions: update(f.questions) }));
  const patchQuestion = (key, patch) => setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));

  const addNewQuestion = () => {
    const row = blankRow();
    setQuestions((qs) => [...qs, row]);
    setExpandedKey(row.key);
    setPicker(null);
  };

  const moveQuestion = (targetKey) => {
    if (!dragKey || dragKey === targetKey) return;
    setQuestions((qs) => {
      const from = qs.findIndex((q) => q.key === dragKey);
      const to = qs.findIndex((q) => q.key === targetKey);
      const next = [...qs];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.stepName.trim()) {
      setError({ text: "Step name is required." });
      return;
    }
    const problems = form.questions.map((row, i) => rowProblems(row, i + 1));
    const firstInvalid = problems.findIndex((p) => p.length > 0);
    if (firstInvalid >= 0) {
      setExpandedKey(form.questions[firstInvalid].key);
      setError({ text: "Some questions need attention.", details: problems.flat() });
      return;
    }
    setSaving(true);
    setError(null);
    const description = form.description.trim() || null;
    const questions = form.questions.map(rowToInput);
    try {
      if (isCreate) {
        const { step: created } = await contentSurveyApi.createStep({
          stepName: form.stepName.trim(),
          description,
          questions,
        });
        onSaved(`"${created.stepName}" was created as a draft.`);
      } else {
        await contentSurveyApi.updateStep(stepId, {
          revision: state.step.revision,
          stepName: form.stepName.trim(),
          description,
          status: form.status,
          questions,
        });
        onSaved(`"${form.stepName.trim()}" was saved.`);
      }
    } catch (err) {
      setError({
        text: surveyErrorMessage(err, "We could not save this step."),
        details: errorDetails(err),
        stale: err.response?.data?.code === "STEP_MODIFIED",
      });
    } finally {
      setSaving(false);
    }
  };

  const step = state.step;
  const published = step && step.status !== "DRAFT";
  const inForm = new Set(form.questions.map((q) => q.questionCode).filter(Boolean));

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      labelledBy="update-step-title"
      className="cs-modal cs-modal--wide"
      as="form"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="cs-modal-head">
        <div>
          <h2 id="update-step-title">{isCreate ? "Create step" : "Update step"}</h2>
          <p className="cs-muted">
            {isCreate
              ? "New steps start as drafts, placed before the result step."
              : step && (totalSteps ? `Step ${step.position} of ${totalSteps}` : `Step ${step.position}`)}
          </p>
        </div>
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
          <CloseRoundedIcon />
        </button>
      </div>

      {state.status === "loading" && <p className="cs-muted cs-pad">Loading step…</p>}
      {state.status === "error" && (
        <div className="cs-alert error" role="alert">
          <p>{state.message}</p>
          <button type="button" className="cs-text-btn" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {state.status === "ready" && (
        <>
          <label className="cs-field">
            <span className="cs-label">Step name</span>
            <input
              className="cs-input"
              value={form.stepName}
              maxLength={255}
              onChange={(e) => set("stepName", e.target.value)}
              placeholder="e.g. Mobility check"
              autoFocus={isCreate}
            />
          </label>

          <label className="cs-field">
            <span className="cs-label">Description</span>
            <textarea
              className="cs-input cs-textarea"
              rows={3}
              value={form.description}
              maxLength={DESCRIPTION_MAX}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What does this step collect?"
            />
            <span className="cs-counter">
              {form.description.length} / {DESCRIPTION_MAX}
            </span>
          </label>

          {!isCreate && (
            <div className="cs-field">
              <span className="cs-label">Status</span>
              <div className="cs-status-row">
                <div className="cs-segmented" role="radiogroup" aria-label="Status">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={form.status === s}
                      className={form.status === s ? `active is-${s.toLowerCase()}` : ""}
                      // bước đã publish không quay về Draft được (BE: INVALID_STATUS_TRANSITION)
                      disabled={s === "DRAFT" && published}
                      title={s === "DRAFT" && published ? "Published steps cannot go back to draft" : undefined}
                      onClick={() => set("status", s)}
                    >
                      <span className="cs-dot" />
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
                <span className="cs-muted">Only active steps are shown to members.</span>
              </div>
            </div>
          )}

          <div className="cs-field">
            <div className="cs-questions-head">
              <span className="cs-label cs-label--lg">Questions ({form.questions.length})</span>
              <div className="cs-questions-actions">
                <button
                  type="button"
                  className="cs-text-btn"
                  onClick={() => setPicker(picker ? null : { search: "", items: [], loading: true })}
                >
                  <LibraryAddOutlinedIcon />
                  {picker ? "Done adding" : "Add existing"}
                </button>
                <button type="button" className="cs-text-btn" onClick={addNewQuestion}>
                  <AddRoundedIcon />
                  New question
                </button>
              </div>
            </div>

            {picker && (
              <div className="cs-picker">
                <label className="cs-picker-search">
                  <SearchRoundedIcon />
                  <input
                    type="search"
                    placeholder="Search questions"
                    maxLength={100}
                    value={picker.search}
                    onChange={(e) => setPicker({ ...picker, search: e.target.value, loading: true })}
                    onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                    autoFocus
                  />
                </label>
                {picker.loading ? (
                  <p className="cs-muted cs-pad">Loading questions…</p>
                ) : picker.error ? (
                  <p className="cs-error">{picker.error}</p>
                ) : picker.items.length === 0 ? (
                  <p className="cs-muted cs-pad">No questions available. Questions used in other steps are hidden.</p>
                ) : (
                  <ul className="cs-picker-list">
                    {picker.items.map((q) => {
                      const added = inForm.has(q.questionCode);
                      return (
                        <li key={q.questionCode}>
                          <span>
                            <strong>{questionLabel(q)}</strong>
                            <small>
                              {[typeLabel(q.questionType), rangeText(q.validationRules, q.unit), q.optionCount ? `${q.optionCount} options` : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </small>
                          </span>
                          <button
                            type="button"
                            className="cs-text-btn"
                            disabled={added}
                            onClick={() => setQuestions((qs) => [...qs, questionToRow(q)])}
                          >
                            {added ? "Added" : "Add"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {form.questions.length === 0 ? (
              <p className="cs-muted cs-pad">
                No questions yet. Create a new question or reuse an existing one. Active steps need at least one question.
              </p>
            ) : (
              <ul className="cs-question-list">
                {form.questions.map((q, index) => {
                  const expanded = expandedKey === q.key;
                  const summary = rowSummary(q);
                  return (
                    <li
                      key={q.key}
                      className={`cs-question ${expanded ? "expanded" : ""} ${dragKey === q.key ? "dragging" : ""}`}
                      // đang mở editor thì không kéo, để chọn chữ trong ô nhập được
                      draggable={!expanded}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        setDragKey(q.key);
                      }}
                      onDragOver={(e) => {
                        if (!dragKey) return;
                        e.preventDefault();
                        moveQuestion(q.key);
                      }}
                      onDragEnd={() => setDragKey(null)}
                    >
                      <div className="cs-question-row">
                        <span className="cs-handle" title="Drag to reorder">
                          <DragIndicatorRoundedIcon />
                        </span>
                        <button
                          type="button"
                          className="cs-question-info"
                          aria-expanded={expanded}
                          onClick={() => setExpandedKey(expanded ? null : q.key)}
                        >
                          <strong>{q.title.trim() || "Untitled question"}</strong>
                          <span>
                            <span className="cs-type-tag">{typeLabel(q.questionType)}</span>
                            {summary}
                            {!q.questionCode && <span className="cs-new-tag">New</span>}
                          </span>
                        </button>
                        <label className="cs-switch">
                          <input
                            type="checkbox"
                            checked={q.required}
                            onChange={(e) => patchQuestion(q.key, { required: e.target.checked })}
                          />
                          <span className="cs-switch-track" />
                          Required
                        </label>
                        <button
                          type="button"
                          className="cs-icon-btn cs-icon-btn--edit"
                          aria-label={`Edit ${q.title || "question"}`}
                          aria-expanded={expanded}
                          onClick={() => setExpandedKey(expanded ? null : q.key)}
                        >
                          <EditOutlinedIcon />
                        </button>
                        <button
                          type="button"
                          className="cs-icon-btn"
                          aria-label={`Remove ${q.title || "question"}`}
                          onClick={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))}
                        >
                          <CloseRoundedIcon />
                        </button>
                      </div>
                      {expanded && (
                        <QuestionEditor
                          row={q}
                          position={index + 1}
                          onChange={(patch) => patchQuestion(q.key, patch)}
                          onDone={() => setExpandedKey(null)}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="cs-muted cs-note">
              Changes apply to new answers only. Answers members already gave stay the same.
            </p>
          </div>

          {error && (
            <div className="cs-alert error" role="alert">
              <p>{error.text}</p>
              {error.details?.length > 0 && (
                <ul>
                  {error.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
              {error.stale && (
                <button type="button" className="cs-text-btn" onClick={load}>
                  Reload the latest version
                </button>
              )}
            </div>
          )}

          <div className="cs-modal-actions">
            <button type="button" className="cs-ghost-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="cs-primary-btn" disabled={saving}>
              {saving ? "Saving…" : isCreate ? "Create step" : "Save changes"}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
