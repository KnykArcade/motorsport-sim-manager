import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};

const styles: Record<Variant, string> = {
  primary: 'bg-amber-500 text-neutral-950 hover:bg-amber-400 font-semibold',
  secondary: 'bg-neutral-800 text-neutral-100 hover:bg-neutral-700',
  ghost: 'bg-transparent text-neutral-300 hover:bg-neutral-800/60 border border-neutral-700',
  danger: 'bg-red-600 text-white hover:bg-red-500 font-semibold',
};

export function Button({ variant = 'secondary', className = '', children, ...rest }: Props) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
