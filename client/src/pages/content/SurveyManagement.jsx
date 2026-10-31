import { useCallback, useEffect, useRef, useState } from "react";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import { contentSurveyApi } from "../../api/contentSurvey";
import { surveyErrorMessage } from "../../api/survey";
import UpdateStepModal from "../../components/content/UpdateStepModal";
import PreviewStepModal from "../../components/content/PreviewStepModal";
import ConfigureResultModal from "../../components/content/ConfigureResultModal";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { STATUS_LABELS, STATUS_TABS, errorDetails, stepMeta } from "../../utils/contentSurvey";
import "./SurveyManagement.css";

/**
 * Survey management (Figma: survey-management). Content Manager quản lý các bước của khảo sát onboarding:
 * tìm theo tên, lọc theo trạng thái, kéo thả rồi Save order, Preview / Edit / Configure, menu ⋮.
 * Kéo thả chỉ bật ở tab All khi không tìm kiếm, vì Save order phải gửi đủ mọi bước.
 */
export default function SurveyManagement() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [list, setList] = useState(null); // response F1
  const [order, setOrder] = useState([]); // bước theo thứ tự đang hiển thị (sau kéo thả)
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState(null); // { tone: "error" | "success", text, details }
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [menuId, setMenuId] = useState(null);
  // popup đang mở: { type: "edit" | "create" | "preview" | "result", stepId }
  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // bước đang chờ xác nhận xóa
  const requestRef = useRef(0);

  const applyList = useCallback((res) => {
    setList(res);
    setOrder(res.steps);
    setLoadError("");
  }, []);

  const load = useCallback(() => {
    // bỏ response cũ nếu người dùng gõ / đổi tab nhanh hơn API trả về
    const requestId = ++requestRef.current;
    return contentSurveyApi
      .listSteps({ search: search.trim(), status })
      .then((res) => requestId === requestRef.current && applyList(res))
      .catch((err) => {
        if (requestId === requestRef.current) setLoadError(surveyErrorMessage(err, "We could not load the survey steps."));
      });
  }, [search, status, applyList]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!menuId) return undefined;
    const close = () => setMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuId]);

  const canReorder = status === "" && search.trim() === "";
  const orderChanged = list != null && order.some((step, i) => step.id !== list.steps[i]?.id);

  const showError = (err, fallback) =>
    setNotice({ tone: "error", text: surveyErrorMessage(err, fallback), details: errorDetails(err) });

  const runAction = async (action, success, fallback) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      await load();
      if (success) setNotice({ tone: "success", text: success });
    } catch (err) {
      showError(err, fallback);
      // danh sách đã đổi ở nơi khác -> tải lại để không thao tác trên dữ liệu cũ
      if (["STEP_ORDER_STALE", "STEP_NOT_FOUND"].includes(err.response?.data?.code)) load();
    } finally {
      setBusy(false);
    }
  };

  const saveOrder = () =>
    runAction(
      () => contentSurveyApi.saveOrder(order.map((s) => s.id)).then(applyList),
      "Step order saved.",
      "We could not save the new order.",
    );

  const changeStatus = (step, next) =>
    runAction(
      () => contentSurveyApi.changeStatus(step.id, next),
      `"${step.stepName}" is now ${STATUS_LABELS[next].toLowerCase()}.`,
      "We could not change the step status.",
    );

  const deleteStep = async () => {
    const step = confirmDelete;
    await runAction(() => contentSurveyApi.deleteStep(step.id), `"${step.stepName}" was deleted.`, "We could not delete the step.");
    // lỗi cũng đóng popup: thông báo lỗi hiện trên danh sách
    setConfirmDelete(null);
  };

  /* ── Kéo thả (HTML5) ─────────────────────────────────────────────── */
  const moveTo = (targetId) => {
    if (!dragId || dragId === targetId) return;
    setOrder((prev) => {
      const from = prev.findIndex((s) => s.id === dragId);
      const to = prev.findIndex((s) => s.id === targetId);
      // bước Result luôn đứng cuối
      if (from < 0 || to < 0 || prev[to].stepType === "RESULT") return prev;
      const next = [...prev];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  };

  const closeModal = useCallback(() => setModal(null), []);
  const onSaved = useCallback(
    (message, nextModal = null) => {
      setModal(nextModal);
      setNotice({ tone: "success", text: message });
      load();
    },
    [load],
  );

  const counts = list?.counts;

  return (
    <div className="survey-mgmt">
      <header className="sm-header">
        <p className="sm-breadcrumb">Content manager / Survey</p>
        <h1 className="sm-title">Survey management</h1>
        <p className="sm-subtitle">Manage the survey steps and questions members answer when they sign up.</p>
      </header>

      <div className="sm-card sm-toolbar">
        <label className="sm-search">
          <SearchRoundedIcon />
          <input
            type="search"
            placeholder="Search step name"
            maxLength={100}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="sm-tabs" role="tablist" aria-label="Step status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={status === tab.status}
              className={status === tab.status ? "active" : ""}
              onClick={() => setStatus(tab.status)}
            >
              {tab.label} ({counts?.[tab.countKey] ?? 0})
            </button>
          ))}
        </div>
      </div>

      <section className="sm-card sm-steps">
        <div className="sm-steps-head">
          <h2>Survey steps</h2>
          <button type="button" className="sm-link-btn" onClick={() => setModal({ type: "create" })}>
            <AddRoundedIcon />
            Create step
          </button>
        </div>

        {notice && (
          <div className={`sm-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
            <p>{notice.text}</p>
            {notice.details?.length > 0 && (
              <ul>
                {notice.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {loadError ? (
          <p className="sm-empty">{loadError}</p>
        ) : !list ? (
          <p className="sm-empty">Loading steps…</p>
        ) : order.length === 0 ? (
          <p className="sm-empty">No steps match this filter.</p>
        ) : (
          <ol className="sm-list">
            {order.map((step) => {
              const isResult = step.stepType === "RESULT";
              const draggable = canReorder && !isResult && !busy;
              return (
                <li
                  key={step.id}
                  className={`sm-row ${dragId === step.id ? "dragging" : ""}`}
                  draggable={draggable}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    setDragId(step.id);
                  }}
                  onDragOver={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    moveTo(step.id);
                  }}
                  onDragEnd={() => setDragId(null)}
                >
                  <span
                    className={`sm-handle ${draggable ? "" : "disabled"}`}
                    title={
                      isResult
                        ? "The result step always stays last"
                        : canReorder
                          ? "Drag to reorder"
                          : "Clear the search and pick All to reorder"
                    }
                  >
                    <DragIndicatorRoundedIcon />
                  </span>
                  <span className="sm-step-no">
                    <small>STEP</small>
                    <strong>{step.position}</strong>
                  </span>
                  <span className="sm-row-info">
                    <span className="sm-row-title">
                      <strong>{step.stepName}</strong>
                      <span className={`sm-badge ${step.status.toLowerCase()}`}>{STATUS_LABELS[step.status]}</span>
                    </span>
                    {step.description && <span className="sm-row-desc">{step.description}</span>}
                    <span className="sm-row-meta">{stepMeta(step).join(" · ")}</span>
                  </span>
                  <span className="sm-row-actions">
                    <button type="button" className="sm-action" onClick={() => setModal({ type: "preview", stepId: step.id })}>
                      <VisibilityOutlinedIcon />
                      Preview
                    </button>
                    {isResult ? (
                      <button type="button" className="sm-action" onClick={() => setModal({ type: "result", stepId: step.id })}>
                        <TuneRoundedIcon />
                        Configure
                      </button>
                    ) : (
                      <button type="button" className="sm-action" onClick={() => setModal({ type: "edit", stepId: step.id })}>
                        <EditOutlinedIcon />
                        Edit
                      </button>
                    )}
                    <span className="sm-menu-wrap">
                      <button
                        type="button"
                        className="sm-kebab"
                        aria-label={`More actions for ${step.stepName}`}
                        aria-expanded={menuId === step.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuId(menuId === step.id ? null : step.id);
                        }}
                      >
                        <MoreVertRoundedIcon />
                      </button>
                      {menuId === step.id && (
                        <span className="sm-menu" role="menu">
                          {step.status === "ACTIVE" ? (
                            <button type="button" role="menuitem" onClick={() => changeStatus(step, "INACTIVE")}>
                              Deactivate
                            </button>
                          ) : (
                            <button type="button" role="menuitem" onClick={() => changeStatus(step, "ACTIVE")}>
                              Activate
                            </button>
                          )}
                          {!isResult && (
                            <button
                              type="button"
                              role="menuitem"
                              className="danger"
                              disabled={step.status === "ACTIVE"}
                              title={step.status === "ACTIVE" ? "Deactivate the step before deleting it" : undefined}
                              onClick={() => setConfirmDelete(step)}
                            >
                              Delete
                            </button>
                          )}
                        </span>
                      )}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        <div className="sm-footer">
          {orderChanged && (
            <button type="button" className="sm-ghost-btn" onClick={() => setOrder(list.steps)} disabled={busy}>
              Reset
            </button>
          )}
          <button type="button" className="sm-primary-btn" onClick={saveOrder} disabled={!orderChanged || busy}>
            {busy && orderChanged ? "Saving…" : "Save order"}
          </button>
        </div>
      </section>

      <UpdateStepModal
        open={modal?.type === "edit" || modal?.type === "create"}
        stepId={modal?.type === "edit" ? modal.stepId : null}
        // counts đã áp dụng search -> khi đang tìm thì không biết tổng số bước
        totalSteps={search.trim() ? null : counts?.all}
        onClose={closeModal}
        onSaved={onSaved}
      />
      <PreviewStepModal
        open={modal?.type === "preview"}
        stepId={modal?.stepId}
        onClose={closeModal}
        onEdit={(step) => setModal({ type: step.stepType === "RESULT" ? "result" : "edit", stepId: step.id })}
      />
      <ConfigureResultModal
        open={modal?.type === "result"}
        stepId={modal?.stepId}
        onClose={closeModal}
        onSaved={onSaved}
      />
      <ConfirmDialog
        open={confirmDelete != null}
        tone="danger"
        title="Delete this step?"
        message={
          confirmDelete && (
            <>
              <strong>{confirmDelete.stepName}</strong> will be removed from the survey. Its questions stay in the
              question bank. This cannot be undone.
            </>
          )
        }
        confirmLabel="Delete step"
        busy={busy}
        onConfirm={deleteStep}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
