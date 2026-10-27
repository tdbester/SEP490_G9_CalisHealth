import axios from "axios";

/**
 * API client riêng cho khu Content Manager. Không tự đăng xuất khi nhận 401
 * để giữ nguyên form hiện tại trong lúc xử lý lỗi xác thực.
 */
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

const contentApi = axios.create({
  baseURL: API_URL,
  headers: { Accept: "application/json" },
});

contentApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

contentApi.interceptors.response.use((response) => response);

/** Media (video/anatomy) được backend phục vụ ở origin gốc, không kèm /api. */
export function mediaUrl(value) {
  if (!value) return null;
  try {
    return new URL(value, new URL(API_URL, window.location.origin)).toString();
  } catch {
    return value;
  }
}

export class ApiRequestError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

function messageFromPayload(payload) {
  if (payload && typeof payload === "object" && typeof payload.message === "string") {
    return payload.message.trim() || null;
  }
  if (payload && typeof payload === "object" && typeof payload.error === "string") {
    return payload.error.trim() || null;
  }
  return typeof payload === "string" && payload.trim() ? payload.trim() : null;
}

function statusMessage(status) {
  if (status == null) {
    return "Could not reach the server. Check that the backend is running and the API URL is correct.";
  }
  if (status === 401) {
    return "The server rejected this sign-in token (HTTP 401). Your session is still open; check the backend log for the authentication reason.";
  }
  if (status === 403) {
    return "This account does not have the Content Manager role. Sign in with a Content Manager account.";
  }
  if (status === 404) return "The requested data could not be found.";
  if (status === 409) return "This data already exists or is still used elsewhere.";
  if (status === 413) return "The uploaded file is too large. Choose a smaller file.";
  if (status >= 500) return "Server error. Please try again later.";
  return `The server rejected the request (HTTP ${status}).`;
}

export function requestError(error) {
  if (error instanceof ApiRequestError) return error;
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const message = messageFromPayload(error.response?.data) || statusMessage(status);
    return new ApiRequestError(message, status);
  }
  return new ApiRequestError(
    error instanceof Error ? error.message : "Could not send the request. Please try again.",
  );
}

export const contentManagerApi = {
  exercises: () => contentApi.get("/content/exercises").then((r) => r.data),

  memberLevels: () => contentApi.get("/content/dashboard/member-levels").then((r) => r.data),

  exercise: (code) =>
    contentApi.get(`/content/exercises/${encodeURIComponent(code)}`).then((r) => r.data),

  exercisesByCodes: (codes) => Promise.all(
    [...new Set(codes.filter(Boolean))].map((code) =>
      contentApi
        .get(`/content/exercises/${encodeURIComponent(code)}`)
        .then((response) => response.data)
        .catch(() => null),
    ),
  ),

  /**
   * Tạo exercise/skill: backend nhận multipart với part "data" (JSON) và 2 part
   * file tuỳ chọn.
   */
  createExercise: (data, demoVideo, anatomyImage) => {
    const form = new FormData();
    form.append("data", new Blob([JSON.stringify(data)], { type: "application/json" }));
    if (demoVideo) form.append("demoVideo", demoVideo);
    if (anatomyImage) form.append("anatomyImage", anatomyImage);

    if (!localStorage.getItem("token")) {
      return Promise.reject(
        new ApiRequestError("You are not signed in. Sign in with a Content Manager account and retry.", 401),
      );
    }

    return contentApi
      .post("/content/exercises", form)
      .then((r) => r.data)
      .catch((error) => {
        throw requestError(error);
      });
  },

  updateExercise: (code, data, demoVideo, anatomyImage) => {
    const form = new FormData();
    form.append("data", new Blob([JSON.stringify(data)], { type: "application/json" }));
    if (demoVideo) form.append("demoVideo", demoVideo);
    if (anatomyImage) form.append("anatomyImage", anatomyImage);
    if (!localStorage.getItem("token")) {
      return Promise.reject(
        new ApiRequestError("No sign-in token is stored in this browser. Sign in with a Content Manager account and retry.", 401),
      );
    }
    return contentApi
      .put(`/content/exercises/${encodeURIComponent(code)}`, form)
      .then((r) => r.data)
      .catch((error) => { throw requestError(error); });
  },

  updateExerciseStatus: (code, active) =>
    contentApi
      .patch(`/content/exercises/${encodeURIComponent(code)}/status`, { active })
      .then((r) => r.data)
      .catch((error) => { throw requestError(error); }),

  deleteExercise: (code) =>
    contentApi
      .delete(`/content/exercises/${encodeURIComponent(code)}`)
      .catch((error) => { throw requestError(error); }),

  /**
   * Chỉ bài tập do người dùng tạo (CUSTOM) chưa được duyệt mới nằm trong hàng chờ.
   * Dùng danh sách hiện có vì backend chưa có endpoint moderation riêng.
   */
  pendingExercises: () => contentApi.get("/content/exercises/pending-moderation").then((r) => r.data),

  exerciseApprovalHistory: () => contentApi.get("/content/exercises/approval-history").then((r) => r.data),

  workouts: () => contentApi.get("/content/workouts").then((r) => r.data),

  updateWorkoutStatus: (code, active) =>
    contentApi
      .patch(`/content/workouts/${encodeURIComponent(code)}/status`, { active })
      .then((r) => r.data)
      .catch((error) => { throw requestError(error); }),

  deleteWorkout: (code) =>
    contentApi
      .delete(`/content/workouts/${encodeURIComponent(code)}`)
      .catch((error) => { throw requestError(error); }),

  workout: (code) =>
    contentApi.get(`/content/workouts/${encodeURIComponent(code)}`).then((r) => r.data),

  createWorkout: (data) =>
    contentApi
      .post("/content/workouts", data)
      .then((r) => r.data)
      .catch((error) => {
        throw requestError(error);
      }),

  updateWorkout: (code, data) =>
    contentApi
      .put(`/content/workouts/${encodeURIComponent(code)}`, data)
      .then((r) => r.data)
      .catch((error) => { throw requestError(error); }),
};

export default contentApi;
