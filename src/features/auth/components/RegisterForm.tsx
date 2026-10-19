import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { registerSchema, type RegisterFormValues } from '../schemas/register.schema';
import { useRegister } from '../hooks/useRegister';
import { parseApiError } from '@/lib/error';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert, AlertDescription } from '@/components/ui/Alert';

export function RegisterForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const registerMutation = useRegister();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const onSubmit = (values: RegisterFormValues) => {
    setServerError(null);
    setSuccessMessage(null);
    registerMutation.mutate(values, {
      onSuccess: (data) => setSuccessMessage(data.message),
      onError: (err) => setServerError(parseApiError(err).message),
    });
  };

  if (successMessage) {
    return (
      <Alert>
        <AlertDescription>
          {successMessage}
          <br />
          <span className="text-sm text-muted-foreground">
            Kiểm tra hộp thư (cả mục spam) để lấy link xác thực.
          </span>
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
        <Label htmlFor="fullName">Họ và tên</Label>
        <Input
          id="fullName"
          type="text"
          autoComplete="name"
          invalid={Boolean(errors.fullName)}
          {...register('fullName')}
        />
        {errors.fullName && (
          <p className="text-sm text-destructive">{errors.fullName.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          invalid={Boolean(errors.email)}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Mật khẩu</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          invalid={Boolean(errors.password)}
          {...register('password')}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          invalid={Boolean(errors.confirmPassword)}
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-destructive">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" isLoading={registerMutation.isPending}>
        Đăng ký
      </Button>
    </form>
  );
}
