import { AuthLayout } from '@/components/layout/AuthLayout';
import { RegisterForm } from '../components/RegisterForm';

export function RegisterPage() {
  return (
    <AuthLayout
      title="Đăng ký tài khoản"
      description="Tạo tài khoản CalisHealth của bạn"
      footerLink={{ text: 'Đã có tài khoản?', label: 'Đăng nhập', to: '/login' }}
    >
      <RegisterForm />
    </AuthLayout>
  );
}
