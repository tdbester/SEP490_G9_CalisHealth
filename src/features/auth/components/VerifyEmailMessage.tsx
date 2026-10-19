import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { parseApiError } from '@/lib/error';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';

type Status = 'loading' | 'success' | 'error';

/**
 * Trang xử lý link xác thực email từ backend.
 * URL dạng: /verify?token=...
 */
export function VerifyEmailMessage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token xác thực không hợp lệ.');
      return;
    }
    authApi
      .verifyEmail(token)
      .then((res) => {
        setStatus('success');
        setMessage(res.message);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(parseApiError(err).message);
      });
  }, [token]);

  return (
    <Alert variant={status === 'error' ? 'destructive' : 'default'}>
      <AlertDescription>
        {status === 'loading' && 'Đang xác thực email...'}
        {status !== 'loading' && message}
        {status === 'success' && (
          <Button asChild={false} className="mt-3 w-full">
            <Link to="/login">Đăng nhập ngay</Link>
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
