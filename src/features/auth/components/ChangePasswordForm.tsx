import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePasswordSchema, type ChangePasswordFormValues } from '../schemas/change.schema';
import { useChangePassword } from '../hooks/useChangePassword';
import { useAuthContext } from '@/contexts/AuthContext';
import { parseApiError } from '@/lib/error';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert, AlertDescription } from '@/components/ui/Alert';

export function ChangePasswordForm() {
  const { logout } = useAuthContext();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
  });

  const change = useChangePassword();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = (values: ChangePasswordFormValues) => {
    setServerError(null);
    change.mutate(values, {
      onSuccess: () => {
        setSuccess(true);
        reset();
        // Sau khi đổi mật khẩu, bắt buộc đăng nhập lại
        setTimeout(() => {
          logout();
          navigate('/login', { replace: true });
        }, 1500);
      },
      onError: (err) => setServerError(parseApiError(err).message),
    });
  };

  if (success) {
    return (
      <Alert>
        <AlertDescription>
          Đổi mật khẩu thành công. Bạn sẽ được chuyển về trang đăng nhập.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="oldPassword">Mật khẩu cũ</Label>
        <Input
          id="oldPassword"
          type="password"
          autoComplete="current-password"
          invalid={Boolean(errors.oldPassword)}
          {...register('oldPassword')}
        />
        {errors.oldPassword && (
          <p className="text-sm text-destructive">{errors.oldPassword.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">Mật khẩu mới</Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          invalid={Boolean(errors.newPassword)}
          {...register('newPassword')}
        />
        {errors.newPassword && (
          <p className="text-sm text-destructive">{errors.newPassword.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmNewPassword">Xác nhận mật khẩu mới</Label>
        <Input
          id="confirmNewPassword"
          type="password"
          autoComplete="new-password"
          invalid={Boolean(errors.confirmNewPassword)}
          {...register('confirmNewPassword')}
        />
        {errors.confirmNewPassword && (
          <p className="text-sm text-destructive">
            {errors.confirmNewPassword.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" isLoading={change.isPending}>
        Đổi mật khẩu
      </Button>
    </form>
  );
}
