import { ChangePasswordForm } from '../components/ChangePasswordForm';

/**
 * Trang đổi mật khẩu (protected).
 * Chưa có layout riêng, sau này thêm vào AppLayout nếu cần.
 */
export function ChangePasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary px-4 py-12">
      <div className="w-full max-w-md rounded-lg border bg-background shadow-sm p-6">
        <h2 className="text-2xl font-semibold tracking-tight mb-1">Đổi mật khẩu</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Nhập mật khẩu cũ và mật khẩu mới.
        </p>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
