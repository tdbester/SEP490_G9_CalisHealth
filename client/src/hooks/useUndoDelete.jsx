import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import i18n from "../i18n";

const UNDO_SECONDS = 10;

function UndoDeleteToast({ onUndo, message }) {
  const [secondsLeft, setSecondsLeft] = useState(UNDO_SECONDS);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="fixed top-24 right-6 z-[9999] flex items-center gap-3 rounded-xl border border-[#3c3063] bg-[#1a1438] px-4 py-3 shadow-2xl backdrop-blur-md animate-bounce-short">
      <span className="text-sm font-medium text-slate-200">{message}</span>
      <button
        type="button"
        onClick={onUndo}
        className="!appearance-none flex items-center gap-1.5 rounded-lg border border-indigo-400/30 bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-indigo-500 active:scale-95"
      >
        {i18n.t("common.ui.undo")} ({secondsLeft}s)
      </button>
    </div>
  );
}

export default function useUndoDelete() {
  const [confirmation, setConfirmation] = useState(null);
  const scheduledDeletes = useRef(new Map());

  const requestDelete = (operation) => setConfirmation(operation);
  const cancelConfirmation = () => {
    const operation = confirmation;
    setConfirmation(null);
    toast.info(i18n.t("common.ui.actionCancelled"), operation?.toastOptions);
  };

  const confirmDelete = () => {
    if (!confirmation) return;
    const operation = confirmation;
    setConfirmation(null);

    try {
      operation.onOptimisticDelete();
    } catch (error) {
      console.error("Could not temporarily remove item:", error);
      toast.error(i18n.t("common.ui.deleteFailed"), operation.toastOptions);
      return;
    }

    let id;
    const handleUndo = () => {
      const scheduled = scheduledDeletes.current.get(id);
      if (!scheduled) return;
      window.clearTimeout(scheduled.timeoutId);
      scheduledDeletes.current.delete(id);
      toast.dismiss(id);
      scheduled.onUndo();
      toast.info(scheduled.undoMessage || i18n.t("common.ui.deletionUndone"), scheduled.toastOptions);
    };
    id = toast(
      <UndoDeleteToast
        onUndo={handleUndo}
        message={operation.toastMessage || i18n.t("common.ui.itemDeleted")}
      />,
      {
        autoClose: false,
        closeButton: false,
        closeOnClick: false,
        draggable: false,
        className: "notification-toast !w-0 !min-h-0 !border-0 !bg-transparent !p-0 !shadow-none",
        style: { width: 0, minHeight: 0 },
      }
    );

    const timeoutId = window.setTimeout(async () => {
      const scheduled = scheduledDeletes.current.get(id);
      if (!scheduled) return;
      scheduledDeletes.current.delete(id);
      toast.dismiss(id);
      try {
        await scheduled.onDelete();
        if (scheduled.successMessage) toast.success(scheduled.successMessage, scheduled.toastOptions);
      } catch (error) {
        scheduled.onUndo();
        console.error("Delete request failed:", error);
        toast.error(
          error?.response?.data?.message || scheduled.failureMessage || i18n.t("common.ui.deleteFailed"),
          scheduled.toastOptions,
        );
      }
    }, UNDO_SECONDS * 1000);

    scheduledDeletes.current.set(id, {
      timeoutId,
      onDelete: operation.onDelete,
      onUndo: operation.onUndo,
      successMessage: operation.successMessage,
      undoMessage: operation.undoMessage,
      failureMessage: operation.failureMessage,
      toastOptions: operation.toastOptions,
    });
  };

  const confirmationModal = confirmation && (
    <div
      className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) cancelConfirmation();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        className="w-full max-w-md rounded-2xl border border-[#44366f] bg-[#17112f] p-6 shadow-2xl shadow-black/50"
      >
        <h2 id="confirm-delete-title" className="text-lg font-semibold text-white">
          {confirmation.confirmationTitle || i18n.t("common.ui.confirmDelete")}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          {confirmation.confirmationMessage
            || i18n.t("common.ui.confirmDeleteMessage", { seconds: UNDO_SECONDS })}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={cancelConfirmation}
            className="rounded-xl border border-[#51456f] bg-transparent px-4 py-2 text-sm font-medium text-[#d2ccdf] transition hover:border-[#8068c4] hover:bg-white/5"
          >
            {confirmation.cancelLabel || i18n.t("common.ui.cancel")}
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            className="rounded-xl border border-rose-700 bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600"
          >
            {confirmation.confirmLabel || i18n.t("common.ui.delete")}
          </button>
        </div>
      </section>
    </div>
  );

  return { requestDelete, confirmationModal };
}
