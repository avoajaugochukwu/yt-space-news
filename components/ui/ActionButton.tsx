'use client';

interface ActionButtonProps {
  children: React.ReactNode;
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  type?: 'button' | 'submit';
}

export function ActionButton({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
}: ActionButtonProps) {
  const baseStyles = 'font-mono font-semibold rounded-md border-none cursor-pointer transition-all duration-200 uppercase tracking-wider inline-flex items-center justify-center gap-2';

  const variantStyles = {
    primary: 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] active:scale-[0.98]',
    secondary: 'bg-[var(--background-secondary)] text-[var(--foreground)] border border-[var(--border)] hover:border-[var(--border-light)]',
    ghost: 'bg-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-secondary)]',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const disabledStyles = disabled
    ? 'bg-[var(--border)] cursor-not-allowed opacity-60 hover:bg-[var(--border)]'
    : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${disabledStyles} ${className}`}
    >
      {children}
    </button>
  );
}
