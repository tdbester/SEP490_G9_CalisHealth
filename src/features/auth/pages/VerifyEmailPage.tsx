import { AuthLayout } from '@/components/layout/AuthLayout';
import { VerifyEmailMessage } from '../components/VerifyEmailMessage';

export function VerifyEmailPage() {
  return (
    <AuthLayout title="Xác thực email" description="Đang xử lý xác thực tài khoản...">
      <VerifyEmailMessage />
    </AuthLayout>
  );
}
