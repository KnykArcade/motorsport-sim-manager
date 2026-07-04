import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};

export function Button({ variant = 'secondary', className = '', children, ...rest }: Props) {
  return (
    <button
      {...rest}
      className={`era-button era-button-${variant} inline-flex items-center justify-center gap-2 px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}
