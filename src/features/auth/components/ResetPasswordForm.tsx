import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { resetSchema, type ResetFormValues } from '../schemas/reset.schema';
import { useResetPassword } from '../hooks/useResetPassword';
import { parseApiError } from '@/lib/error';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert, AlertDescription } from '@/components/ui/Alert';

export function ResetPasswordForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromUrl = searchParams.get('token') || '';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { token: tokenFromUrl },
  });

  // Đồng bộ token từ URL vào form
  if (tokenFromUrl) setValue('token', tokenFromUrl);

  const reset = useResetPassword();
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = (values: ResetFormValues) => {
    setServerError(null);
    reset.mutate(values, {
      onSuccess: () => setDone(true),
      onError: (err) => setServerError(parseApiError(err).message),
    });
  };

  if (done) {
    return (
      <Alert>
        <AlertDescription>
          Đặt lại mật khẩu thành công. Đang chuyển về trang đăng nhập...
          <Button
            className="mt-3 w-full"
            onClick={() => navigate('/login', { replace: true })}
          >
            Đăng nhập ngay
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!tokenFromUrl) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.
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

      <input type="hidden" {...register('token')} />

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

      <Button type="submit" className="w-full" isLoading={reset.isPending}>
        Đặt lại mật khẩu
      </Button>
    </form>
  );
}
