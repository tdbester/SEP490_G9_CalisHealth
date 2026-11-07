import api from "./client";

/**
 * Màn "Form correction" — kế hoạch sửa form cho bài member vừa tập.
 *
 * Server trả về các ngưỡng chấm form đang áp dụng (do Content Manager khai
 * báo) và tối đa 3 bước sửa form.
 */
export const formCorrectionApi = {
  /**
   * Lấy kế hoạch sửa form của một bài tập.
   *
   * @param {string} exerciseCode - mã bài tập
   * @param {string[]} [failedJoints] - các khớp vừa bị lỗi (vd: ["KNEE", "HIP"])
   *   để server ưu tiên bước sửa đúng với lỗi vừa gặp.
   */
  getPlan: (exerciseCode, failedJoints = []) =>
    api
      .get("/member/form-correction", {
        params: {
          exerciseCode,
          ...(failedJoints.length > 0
            ? { failedJoints: failedJoints.join(",") }
            : {}),
        },
      })
      .then((res) => res.data),
};

export default formCorrectionApi;
