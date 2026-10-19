import { Link } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';

/**
 * Trang chủ tạm thời (protected).
 * Sẽ thay thế bằng Dashboard thật sau.
 */
export function HomePage() {
  const { user, logout } = useAuthContext();

  return (
    <div className="min-h-screen bg-secondary">
      <header className="bg-background border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary">CalisHealth</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              Xin chào, <span className="font-medium text-foreground">{user?.fullName}</span>
            </span>
            <Button asChild={false} variant="outline">
              <Link to="/change-password">Đổi MK</Link>
            </Button>
            <Button variant="destructive" onClick={logout}>
              Đăng xuất
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="rounded-lg border bg-background p-6">
          <h2 className="text-2xl font-semibold mb-2">Chào mừng bạn đến với CalisHealth</h2>
          <p className="text-muted-foreground">
            Khung frontend đã sẵn sàng. Các tính năng sức khỏe & calisthenics sẽ được bổ sung sau.
          </p>
        </div>
      </main>
    </div>
  );
}
