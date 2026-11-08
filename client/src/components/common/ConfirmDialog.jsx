import { useTranslation } from "react-i18next";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import ModalShell from "./ModalShell";
import "./ConfirmDialog.css";

/**
 * Popup xác nhận dùng chung thay cho window.confirm.
 * tone="danger" cho thao tác không hoàn tác được (xóa...). busy: đang xử lý -> khóa nút, không đóng được.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = "default",
  busy = false,
  onConfirm,
  onCancel,
}) {
  const { t } = useTranslation();
  const Icon = tone === "danger" ? WarningAmberRoundedIcon : HelpOutlineRoundedIcon;
  const close = busy ? () => {} : onCancel;

  return (
    <ModalShell open={open} onClose={close} labelledBy="confirm-dialog-title" className={`confirm-dialog ${tone}`}>
      <span className="confirm-dialog-icon">
        <Icon />
      </span>
      <h2 id="confirm-dialog-title">{title}</h2>
      {message && <p className="confirm-dialog-message">{message}</p>}
      <div className="confirm-dialog-actions">
        <button type="button" className="confirm-dialog-cancel" onClick={close} disabled={busy}>
          {cancelLabel || t("common.ui.cancel")}
        </button>
        <button type="button" className="confirm-dialog-confirm" onClick={onConfirm} disabled={busy} autoFocus>
          {busy ? t("common.ui.working") : confirmLabel || t("common.ui.confirm")}
        </button>
      </div>
    </ModalShell>
  );
}
