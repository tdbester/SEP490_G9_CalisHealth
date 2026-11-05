import { toast } from "react-toastify";

const MAINTENANCE_TOAST_ID = "maintenance-toast";
const MEMBER_APP_ACCESS = "MEMBER_APP_ACCESS";
const DEFAULT_MESSAGE = "This service is temporarily under maintenance.";

export function handleMaintenanceError(error) {
  if (error?.response?.status !== 503) return;

  const { serviceKey, message } = error.response.data || {};
  if (typeof window !== "undefined" && serviceKey) {
    window.dispatchEvent(new CustomEvent("calishealth:maintenance", {
      detail: { serviceKey, message },
    }));
  }

  if (serviceKey !== MEMBER_APP_ACCESS) {
    toast.warning(message || DEFAULT_MESSAGE, { toastId: MAINTENANCE_TOAST_ID });
  }
}
