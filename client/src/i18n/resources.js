/**
 * Tổng hợp các namespace theo từng ngôn ngữ.
 *
 * Cấu trúc: `i18n/locales/<lang>/<namespace>.js` -> namespace là tên file
 * (không có `.js`). Thêm namespace mới: tạo file ở cả hai thư mục `en` và
 * `vi`, rồi khai báo trong `NAMESPACES`.
 */
import enCommon from "./locales/en/common.js";
import enMember from "./locales/en/member.js";
import enAdmin from "./locales/en/admin.js";
import enContentManager from "./locales/en/contentManager.js";

import viCommon from "./locales/vi/common.js";
import viMember from "./locales/vi/member.js";
import viAdmin from "./locales/vi/admin.js";
import viContentManager from "./locales/vi/contentManager.js";

/** Danh sách namespace đang có — dùng để kiểm tra khi phát triển. */
export const NAMESPACES = ["common", "member", "admin", "contentManager"];

/**
 * Chuỗi của namespace `common` được dùng ở hai kiểu key:
 *   - `common.imeWarning`      -> nằm trong khối `common` của file common.js
 *   - `common.security.title`  -> nằm ở cấp gốc của file common.js
 * Nên bản "phẳng" hợp nhất cả hai: nối khối `common` lên cấp gốc, đồng thời
 * giữ lại khối `common` để `common.common.*` vẫn dùng được.
 *
 * @param {Record<string, unknown>} file
 * @returns {Record<string, unknown>}
 */
function flattenCommon(file) {
  return { ...file.common, ...file };
}

/**
 * Namespace mặc định (`translation`): gom tất cả namespace lại để key dạng
 * `member.profile.title` / `common.ui.close` / `admin.users.title` tra được
 * đúng chuỗi, bất kể component dùng `useTranslation()` hay `useTranslation("member")`.
 */
function buildDefaultNamespace({ common, member, admin, contentManager }) {
  const flatCommon = flattenCommon(common);
  return {
    // Các khối dùng không có tiền tố (nav.*, auth.*, date.*, survey.*, ...)
    ...flatCommon,
    ...member,
    // ...và các namespace dùng có tiền tố.
    common: flatCommon,
    member,
    admin,
    contentManager,
  };
}

export const resources = {
  en: {
    common: enCommon,
    member: enMember,
    admin: enAdmin,
    contentManager: enContentManager,
    translation: buildDefaultNamespace({
      common: enCommon,
      member: enMember,
      admin: enAdmin,
      contentManager: enContentManager,
    }),
  },
  vi: {
    common: viCommon,
    member: viMember,
    admin: viAdmin,
    contentManager: viContentManager,
    translation: buildDefaultNamespace({
      common: viCommon,
      member: viMember,
      admin: viAdmin,
      contentManager: viContentManager,
    }),
  },
};

export default resources;
