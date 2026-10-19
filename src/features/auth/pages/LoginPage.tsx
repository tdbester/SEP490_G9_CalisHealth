import { AuthLayout } from '@/components/layout/AuthLayout';
import { LoginForm } from '../components/LoginForm';

export function LoginPage() {
  return (
    <AuthLayout
      title="Đăng nhập"
      description="Chào mừng quay lại với CalisHealth"
      footerLink={{ text: 'Chưa có tài khoản?', label: 'Đăng ký ngay', to: '/register' }}
    >
      <LoginForm />
    </AuthLayout>
  );
}
