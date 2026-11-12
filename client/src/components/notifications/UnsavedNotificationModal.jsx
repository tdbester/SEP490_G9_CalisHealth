import { useTranslation } from "react-i18next";

export default function UnsavedNotificationModal({ onCancel, onDiscard, onPublish, saving }) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-[1600] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onCancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-notification-title"
        className="w-full max-w-md rounded-2xl border border-[#463b61] bg-[#17112d] p-6 shadow-2xl"
      >
        <h2 id="unsaved-notification-title" className="text-lg font-bold text-white">
          {t("admin.notifications.unsavedModalTitle")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#b8afd0]">
          {t("admin.notifications.unsavedModalMessage")}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="rounded-lg border border-[#51456f] bg-transparent px-4 py-2 text-sm text-[#d2ccdf] transition hover:border-[#8068c4] hover:bg-white/5 disabled:opacity-50"
          >
            {t("admin.notifications.keepEditing")}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onDiscard}
            className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
          >
            {t("admin.notifications.discardChanges")}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onPublish}
            className="rounded-lg bg-[#7c5dfa] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6c4dce] disabled:opacity-50"
          >
            {saving ? t("common.ui.working") : t("admin.notifications.publishAndLeave")}
          </button>
        </div>
      </section>
    </div>
  );
}
