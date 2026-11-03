import { toast } from "react-toastify";

const options = {
  className: "notification-toast",
  style: { fontFamily: "Arial, sans-serif" },
};

const notificationToast = {
  success: (message) => toast.success(message, options),
  error: (message) => toast.error(message, options),
  info: (message) => toast.info(message, options),
};

export default notificationToast;
