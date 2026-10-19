import { AuthLayout } from '@/components/layout/AuthLayout';
import { ForgotPasswordForm } from '../components/ForgotPasswordForm';

export function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Quên mật khẩu"
      description="Nhập email để nhận link đặt lại mật khẩu"
      footerLink={{ text: 'Nhớ mật khẩu rồi?', label: 'Đăng nhập', to: '/login' }}
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
