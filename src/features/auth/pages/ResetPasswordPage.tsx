import { AuthLayout } from '@/components/layout/AuthLayout';
import { ResetPasswordForm } from '../components/ResetPasswordForm';

export function ResetPasswordPage() {
  return (
    <AuthLayout
      title="Đặt lại mật khẩu"
      description="Nhập mật khẩu mới cho tài khoản của bạn"
    >
      <ResetPasswordForm />
    </AuthLayout>
  );
}
