import { toast } from "react-toastify";
import i18n from "../i18n";

const MAINTENANCE_TOAST_ID = "maintenance-toast";
const MEMBER_APP_ACCESS = "MEMBER_APP_ACCESS";
const DEFAULT_MESSAGE_KEY = "common.apiError.defaultMaintenance";

export function handleMaintenanceError(error) {
  if (error?.response?.status !== 503) return;

  const { serviceKey, message } = error.response.data || {};
  if (typeof window !== "undefined" && serviceKey) {
    window.dispatchEvent(new CustomEvent("calishealth:maintenance", {
      detail: { serviceKey, message },
    }));
  }

  if (serviceKey !== MEMBER_APP_ACCESS) {
    toast.warning(message || i18n.t(DEFAULT_MESSAGE_KEY), { toastId: MAINTENANCE_TOAST_ID });
  }
}
