import { forwardRef, ButtonHTMLAttributes, ReactElement, cloneElement, isValidElement } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'ghost';
  isLoading?: boolean;
  asChild?: boolean;
}

const variantClasses = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  outline: 'border border-input bg-background hover:bg-secondary',
  ghost: 'hover:bg-secondary',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', isLoading, asChild, disabled, children, ...props }, ref) => {
    const combinedClassName = cn(
      'inline-flex items-center justify-center rounded-md text-sm font-medium',
      'h-10 px-4 py-2',
      'transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'disabled:pointer-events-none disabled:opacity-50',
      variantClasses[variant],
      className
    );

    if (asChild && isValidElement(children)) {
      return cloneElement(children as ReactElement<{ className?: string }>, {
        className: cn(combinedClassName, (children.props as { className?: string }).className),
      });
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={combinedClassName}
        {...props}
      >
        {isLoading ? 'Đang xử lý...' : children}
      </button>
    );
  }
);
Button.displayName = 'Button';
