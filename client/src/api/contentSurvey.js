import api from "./client";
import { ONBOARDING_SURVEY_CODE } from "./survey";

/**
 * Survey management của Content Manager: /api/content/surveys/{surveyCode}/steps
 * (server/docs/survey-management/SURVEY_MANAGEMENT_BE.md, F1–F10).
 */
const base = (surveyCode = ONBOARDING_SURVEY_CODE) => `/content/surveys/${surveyCode}/steps`;
const data = (res) => res.data;

export const contentSurveyApi = {
  /** F1. status: ACTIVE | DRAFT | INACTIVE, bỏ trống = tab All. */
  listSteps: ({ search, status } = {}) =>
    api.get(base(), { params: { search: search || undefined, status: status || undefined } }).then(data),

  /** F2. Dữ liệu cho popup Update step. */
  getStep: (stepId) => api.get(`${base()}/${stepId}`).then(data),

  /** F3. Bước mới luôn ở DRAFT, chèn trước bước Result; questions (tùy chọn) được lưu cùng lúc. */
  createStep: ({ stepName, description, questions }) =>
    api.post(base(), { stepName, description, questions }).then(data),

  /** F4. Lưu toàn bộ popup Update step: { revision, stepName, description, status, questions }. */
  updateStep: (stepId, body) => api.put(`${base()}/${stepId}`, body).then(data),

  /** F4a. Câu hỏi trong ngân hàng có thể thêm vào bước; stepId null = bước đang tạo. */
  availableQuestions: (stepId, search) =>
    api
      .get(stepId == null ? `${base()}/available-questions` : `${base()}/${stepId}/available-questions`, {
        params: { search: search || undefined },
      })
      .then(data),

  /** F5. Bước như member thấy. */
  preview: (stepId) => api.get(`${base()}/${stepId}/preview`).then(data),

  /** F5a. Kiểm tra thử câu trả lời, không lưu gì. */
  previewCheck: (stepId, answers) => api.post(`${base()}/${stepId}/preview/check`, { answers }).then(data),

  /** F6. ACTIVE | INACTIVE. */
  changeStatus: (stepId, status) => api.put(`${base()}/${stepId}/status`, { status }).then(data),

  /** F7. */
  deleteStep: (stepId) => api.delete(`${base()}/${stepId}`),

  /** F8. stepIds = toàn bộ bước theo thứ tự mới; trả về danh sách như F1. */
  saveOrder: (stepIds) => api.put(`${base()}/order`, { stepIds }).then(data),

  /** F9 / F10. Bước Result. */
  getResultConfig: (stepId) => api.get(`${base()}/${stepId}/result-config`).then(data),
  updateResultConfig: (stepId, body) => api.put(`${base()}/${stepId}/result-config`, body).then(data),
};
