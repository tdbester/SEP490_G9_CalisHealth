import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

/**
 * Ngôn ngữ đang được hỗ trợ.
 * Thêm ngôn ngữ mới: thêm vào đây + tạo khối `xx` trong `resources` bên dưới.
 */
export const SUPPORTED_LANGUAGES = [
  { code: "vi", label: "Tiếng Việt", short: "VI" },
  { code: "en", label: "English", short: "EN" },
];

export const DEFAULT_LANG = "vi";

/**
 * Key lưu lựa chọn ngôn ngữ trong localStorage.
 * Backend cũng đọc key này (qua header Accept-Language) để trả message đúng ngôn ngữ.
 */
export const LANG_STORAGE_KEY = "calishealth_lang";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      vi: {
        translation: {
          common: {
            appName: "CalisHealth",
            language: "Ngôn ngữ",
            loading: "Đang tải...",
            backToHome: "Về trang chủ",
            cancel: "Hủy",
            save: "Lưu",
            search: "Tìm kiếm",
            back: "Quay lại",
            next: "Tiếp theo",
            previous: "Trang trước",
            all: "Tất cả",
            loading_placeholder: "Đang tải...",
          },
          error: {
            forbiddenTitle: "Không có quyền truy cập",
            forbiddenMessage:
              "Tài khoản của bạn không có quyền xem trang này. Vui lòng liên hệ quản trị viên nếu cần.",
            generic: "Đã xảy ra lỗi. Vui lòng thử lại.",
          },
          nav: {
            dashboard: "Bảng điều khiển",
            library: "Thư viện",
            tracking: "Theo dõi",
            logout: "Đăng xuất",
            login: "Đăng nhập",
          },
          auth: {
            login: {
              title: "Đăng nhập",
              email: "Email",
              password: "Mật khẩu",
              submit: "Đăng nhập",
              submitting: "Đang đăng nhập...",
              noAccount: "Chưa có tài khoản? Đăng ký",
              forgotPassword: "Quên mật khẩu?",
              showPassword: "Hiện mật khẩu",
              hidePassword: "Ẩn mật khẩu",
              fallbackError: "Đăng nhập thất bại. Vui lòng thử lại.",
              credentialsError: "Email hoặc mật khẩu không đúng.",
            },
            register: {
              title: "Tạo tài khoản",
              fullName: "Họ và tên",
              email: "Email",
              password: "Mật khẩu",
              confirmPassword: "Xác nhận mật khẩu",
              passwordHint: "Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt",
              submit: "Đăng ký",
              submitting: "Đang đăng ký...",
              successTitle: "Đăng ký thành công!",
              successMessage:
                "Vui lòng kiểm tra email để xác thực tài khoản trước khi đăng nhập.",
              goToLogin: "Đi đến đăng nhập",
              hasAccount: "Đã có tài khoản? Đăng nhập",
              fallbackError: "Đăng ký thất bại.",
            },
            forgotPassword: {
              title: "Quên mật khẩu",
              email: "Email",
              emailPlaceholder: "email@example.com",
              submit: "Gửi liên kết đặt lại",
              submitting: "Đang gửi...",
              successTitle: "Đã gửi yêu cầu",
              successMessage:
                "Nếu email tồn tại, chúng tôi đã gửi liên kết đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.",
              backToLogin: "Quay lại đăng nhập",
            },
            resetPassword: {
              title: "Đặt lại mật khẩu",
              newPassword: "Mật khẩu mới",
              confirmNewPassword: "Xác nhận mật khẩu mới",
              passwordHint: "Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt",
              submit: "Đặt lại mật khẩu",
              submitting: "Đang xử lý...",
              successTitle: "Đặt lại mật khẩu thành công!",
              successMessage: "Hãy đăng nhập lại với mật khẩu mới.",
              goToLogin: "Đăng nhập",
              missingTokenTitle: "Liên kết không hợp lệ",
              missingTokenMessage:
                "Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu một link mới.",
              requestNewLink: "Yêu cầu link mới",
              backToLogin: "Về trang đăng nhập",
              mismatchError: "Mật khẩu xác nhận không khớp",
              fallbackError: "Đặt lại mật khẩu thất bại.",
            },
            verifyEmail: {
              verifying: "Đang xác thực...",
              verifyingMessage: "Đang xác thực email của bạn, vui lòng chờ...",
              successTitle: "Xác thực thành công!",
              errorTitle: "Xác thực thất bại",
              loginNow: "Đăng nhập ngay",
              backToLogin: "Về trang đăng nhập",
              missingToken: "Thiếu mã xác thực.",
              defaultError: "Link không hợp lệ hoặc đã hết hạn.",
            },
            common: {
              mismatchError: "Mật khẩu xác nhận không khớp",
            },
          },
          // ---- Khối dùng chung cho các màn khác trong nhóm ----
          library: {
            title: "Thư viện bài tập",
            description: "Chọn một mục để xem danh sách.",
            sectionExercise: "Bài tập",
            sectionWorkout: "Chương trình tập luyện",
            groupSystemExercise: "Bài tập hệ thống",
            groupMemberExercise: "Bài tập do thành viên thêm",
            groupSystemWorkout: "Chương trình hệ thống",
            groupCustomWorkout: "Chương trình tự tạo",
            cardHealthTitle: "Bài tập cho sức khỏe",
            cardSkillTitle: "Bài tập cho kỹ năng",
            cardMemberTitle: "Bài tập do thành viên thêm",
            cardMemberDescription: "Các bài tập bạn tự thêm.",
            viewList: "Xem danh sách",
          },
          exercise: {
            title: "Danh sách bài tập sức khỏe & kỹ năng",
            memberTitle: "Bài tập do thành viên thêm",
            backToLibrary: "Quay lại Thư viện",
            tabHealth: "Sức khỏe",
            tabSkills: "Kỹ năng",
            addCustom: "Thêm bài tập tùy chỉnh",
            createExercise: "Tạo bài tập",
            searchPlaceholder: "Tìm theo tên bài tập hoặc nhóm cơ...",
            emptyTitle: "Không tìm thấy bài tập nào",
            emptyMemberTitle: "Không tìm thấy bài tập tùy chỉnh nào",
            parameters: "Thông số:",
            muscleGroupFullBody: "Toàn thân",
            levelAll: "Tất cả cấp độ",
            levelBeginner: "Sơ cấp",
            levelIntermediate: "Trung cấp",
            levelAdvanced: "Nâng cao",
            sourceSystem: "Hệ thống",
            sourceMember: "Thành viên thêm",
            sourceCustom: "Tùy chỉnh",
            setsCount: "{{count}} bài",
          },
        },
      },
      en: {
        translation: {
          common: {
            appName: "CalisHealth",
            language: "Language",
            loading: "Loading...",
            backToHome: "Back to home",
            cancel: "Cancel",
            save: "Save",
            search: "Search",
            back: "Back",
            next: "Next",
            previous: "Previous",
            all: "All",
            loading_placeholder: "Loading...",
          },
          error: {
            forbiddenTitle: "Access denied",
            forbiddenMessage:
              "Your account does not have permission to view this page. Please contact an administrator if needed.",
            generic: "Something went wrong. Please try again.",
          },
          nav: {
            dashboard: "Dashboard",
            library: "Library",
            tracking: "Tracking",
            logout: "Log out",
            login: "Login",
          },
          auth: {
            login: {
              title: "Login",
              email: "Email",
              password: "Password",
              submit: "Login",
              submitting: "Signing in...",
              noAccount: "Don't have an account? Register",
              forgotPassword: "Forgot Password?",
              showPassword: "Show password",
              hidePassword: "Hide password",
              fallbackError: "Login failed. Please try again.",
              credentialsError: "Email or password is incorrect.",
            },
            register: {
              title: "Create Account",
              fullName: "Full Name",
              email: "Email",
              password: "Password",
              confirmPassword: "Confirm Password",
              passwordHint: "Min 8 chars, uppercase, lowercase, number and special character",
              submit: "Sign Up",
              submitting: "Creating...",
              successTitle: "Registration successful!",
              successMessage:
                "Please check your email to verify your account before logging in.",
              goToLogin: "Go to Login",
              hasAccount: "Already have an account? Login",
              fallbackError: "Registration failed.",
            },
            forgotPassword: {
              title: "Forgot Password",
              email: "Email",
              emailPlaceholder: "your@email.com",
              submit: "Send Reset Link",
              submitting: "Sending...",
              successTitle: "Request sent",
              successMessage:
                "If the email exists, we have sent a password reset link. Please check your inbox.",
              backToLogin: "Back to Login",
            },
            resetPassword: {
              title: "Reset Password",
              newPassword: "New Password",
              confirmNewPassword: "Confirm New Password",
              passwordHint: "Min 8 chars, uppercase, lowercase, number and special character",
              submit: "Reset Password",
              submitting: "Processing...",
              successTitle: "Password reset successful!",
              successMessage: "Please log in again with your new password.",
              goToLogin: "Login",
              missingTokenTitle: "Invalid link",
              missingTokenMessage:
                "The password reset link is invalid or has expired. Please request a new one.",
              requestNewLink: "Request a new link",
              backToLogin: "Back to login",
              mismatchError: "Password confirmation does not match",
              fallbackError: "Password reset failed.",
            },
            verifyEmail: {
              verifying: "Verifying...",
              verifyingMessage: "Verifying your email, please wait...",
              successTitle: "Verified successfully!",
              errorTitle: "Verification failed",
              loginNow: "Login now",
              backToLogin: "Back to login",
              missingToken: "Missing verification token.",
              defaultError: "The link is invalid or has expired.",
            },
            common: {
              mismatchError: "Password confirmation does not match",
            },
          },
          // ---- Shared blocks for the other members' screens ----
          library: {
            title: "Exercise & Skill library",
            description: "Choose a section to open its list.",
            sectionExercise: "Exercise",
            sectionWorkout: "Workout",
            groupSystemExercise: "System exercise",
            groupMemberExercise: "Member provided exercise",
            groupSystemWorkout: "System workout",
            groupCustomWorkout: "Custom workout",
            cardHealthTitle: "Exercise for health",
            cardSkillTitle: "Exercise for skill",
            cardMemberTitle: "Member provided exercise",
            cardMemberDescription: "Exercises you added yourself.",
            viewList: "View list",
          },
          exercise: {
            title: "Exercise for health & skill list",
            memberTitle: "Member Provided Exercises",
            backToLibrary: "Back to Library",
            tabHealth: "Health",
            tabSkills: "Skills",
            addCustom: "Add Custom Exercise",
            createExercise: "Create Exercise",
            searchPlaceholder: "Search by exercise name or muscle group...",
            emptyTitle: "No exercises found",
            emptyMemberTitle: "No custom exercises found",
            parameters: "Parameters:",
            muscleGroupFullBody: "Full body",
            levelAll: "All levels",
            levelBeginner: "Beginner",
            levelIntermediate: "Intermediate",
            levelAdvanced: "Advanced",
            sourceSystem: "System",
            sourceMember: "Member Added",
            sourceCustom: "Custom",
            setsCount: "{{count}} sets",
          },
        },
      },
    },
    fallbackLng: DEFAULT_LANG,
    supportedLngs: ["vi", "en"],
    // load: "currentOnly" -> "en-US" phải map về "en", không tạo namespace "en-US"
    load: "currentOnly",
    interpolation: { escapeValue: false },
    detection: {
      // Ưu tiên lựa chọn của user đã lưu, sau đó mới tới trình duyệt
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LANG_STORAGE_KEY,
      caches: ["localStorage"],
    },
  });

export default i18n;
