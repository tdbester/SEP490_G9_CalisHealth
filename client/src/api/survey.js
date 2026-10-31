import api from "./client";

/** Mã khảo sát onboarding của member (surveys.survey_code). */
export const ONBOARDING_SURVEY_CODE = "CALISHEALTH_ONBOARDING";

export const surveyApi = {
  /** Định nghĩa khảo sát; truyền version để đọc đúng version của phiên đang làm. */
  definition: (version) =>
    api
      .get(`/surveys/${ONBOARDING_SURVEY_CODE}`, { params: version ? { version } : undefined })
      .then((res) => res.data),

  /** Lịch sử phiên của member hiện tại, mới nhất trước. */
  sessions: () =>
    api
      .get("/survey-sessions", { params: { surveyCode: ONBOARDING_SURVEY_CODE } })
      .then((res) => res.data),

  /** Trả về phiên IN_PROGRESS nếu đã có, nếu không thì tạo phiên mới. */
  start: () =>
    api.post("/survey-sessions", { surveyCode: ONBOARDING_SURVEY_CODE }).then((res) => res.data),

  session: (sessionId) => api.get(`/survey-sessions/${sessionId}`).then((res) => res.data),

  saveStep: (sessionId, stepCode, surveyVersion, answers) =>
    api
      .put(`/survey-sessions/${sessionId}/steps/${stepCode}/answers`, { surveyVersion, answers })
      .then((res) => res.data),

  complete: (sessionId) =>
    api.post(`/survey-sessions/${sessionId}/complete`).then((res) => res.data),

  skip: (sessionId) => api.post(`/survey-sessions/${sessionId}/skip`).then((res) => res.data),

  resume: (sessionId) => api.post(`/survey-sessions/${sessionId}/resume`).then((res) => res.data),

  result: (sessionId) => api.get(`/survey-sessions/${sessionId}/result`).then((res) => res.data),
};

/**
 * Member cần làm onboarding khi chưa từng hoàn thành hoặc bỏ qua khảo sát.
 * Lỗi (vd survey chưa được seed) -> không chặn member, coi như không cần.
 */
export async function needsOnboarding() {
  try {
    const sessions = await surveyApi.sessions();
    return !sessions.some((s) => s.status === "COMPLETED" || s.status === "SKIPPED");
  } catch {
    return false;
  }
}

/** Đang đăng nhập bằng tài khoản member (khách gọi Survey API sẽ bị 401 -> bị đẩy sang /login). */
export function isMemberSession() {
  try {
    return Boolean(localStorage.getItem("token")) && JSON.parse(localStorage.getItem("user"))?.role === "MEMBER";
  } catch {
    return false;
  }
}

/**
 * Đã tự đưa member vào survey trong phiên trình duyệt này chưa (tránh kéo lại mỗi lần về dashboard).
 * Tách theo email để đổi tài khoản trong cùng tab không dùng nhầm cờ của tài khoản trước.
 */
function promptedKey() {
  try {
    return `calis.onboardingPrompted:${JSON.parse(localStorage.getItem("user"))?.email ?? ""}`;
  } catch {
    return "calis.onboardingPrompted:";
  }
}

export function onboardingPrompted() {
  try {
    return sessionStorage.getItem(promptedKey()) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingPrompted() {
  try {
    sessionStorage.setItem(promptedKey(), "1");
  } catch {
    // trình duyệt chặn storage -> lần sau có thể được đưa vào survey lại, không ảnh hưởng dữ liệu
  }
}

/** Thông báo lỗi đọc được từ response của Survey API ({code, message, errors}). */
export function surveyErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  const data = err?.response?.data;
  if (typeof data?.message === "string" && data.message) return data.message;
  if (!err?.response) return "Cannot reach the server. Please check your connection.";
  return fallback;
}
