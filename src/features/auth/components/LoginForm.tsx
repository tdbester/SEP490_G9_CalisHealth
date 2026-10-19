import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { loginSchema, type LoginFormValues } from '../schemas/login.schema';
import { useLogin } from '../hooks/useLogin';
import { parseApiError } from '@/lib/error';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert, AlertDescription } from '@/components/ui/Alert';

export function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const login = useLogin();
  const [serverError, setServerError] = useState<string | null>(null);

  const onSubmit = (values: LoginFormValues) => {
    setServerError(null);
    login.mutate(values, {
      onError: (err) => {
        setServerError(parseApiError(err).message);
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          invalid={Boolean(errors.email)}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Mật khẩu</Label>
          <Link
            to="/forgot-password"
            className="text-sm text-primary hover:underline"
          >
            Quên mật khẩu?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          invalid={Boolean(errors.password)}
          {...register('password')}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" isLoading={login.isPending}>
        Đăng nhập
      </Button>
    </form>
  );
}
