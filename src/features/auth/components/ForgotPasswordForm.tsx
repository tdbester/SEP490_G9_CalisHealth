import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { forgotSchema, type ForgotFormValues } from '../schemas/forgot.schema';
import { useForgotPassword } from '../hooks/useForgotPassword';
import { parseApiError } from '@/lib/error';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert, AlertDescription } from '@/components/ui/Alert';

export function ForgotPasswordForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
  });

  const forgot = useForgotPassword();
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = (values: ForgotFormValues) => {
    setServerError(null);
    forgot.mutate(values, {
      onSuccess: () => setDone(true),
      onError: (err) => setServerError(parseApiError(err).message),
    });
  };

  if (done) {
    return (
      <Alert>
        <AlertDescription>
          Nếu email tồn tại trong hệ thống, chúng tôi đã gửi link đặt lại mật khẩu.
          Vui lòng kiểm tra hộp thư.
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

      <Button type="submit" className="w-full" isLoading={forgot.isPending}>
        Gửi link đặt lại
      </Button>
    </form>
  );
}
