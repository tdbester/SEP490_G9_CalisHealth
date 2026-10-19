import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-6xl font-bold text-primary">404</h1>
      <p className="text-lg text-muted-foreground mt-2 mb-6">
        Trang bạn tìm không tồn tại.
      </p>
      <Button asChild={false}>
        <Link to="/">Về trang chủ</Link>
      </Button>
    </div>
  );
}
