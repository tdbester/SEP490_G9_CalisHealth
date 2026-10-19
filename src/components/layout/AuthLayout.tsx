import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  footerLink?: { text: string; to: string; label: string };
}

/**
 * Layout chung cho các trang auth: căn giữa, có card.
 * Ví dụ: Login, Register, Forgot Password...
 */
export function AuthLayout({ children, title, description, footerLink }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-primary">CalisHealth</h1>
        </div>
        <div className="rounded-lg border bg-background shadow-sm p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          {children}
        </div>
        {footerLink && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            {footerLink.text}{' '}
            <Link to={footerLink.to} className="font-medium text-primary hover:underline">
              {footerLink.label}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
