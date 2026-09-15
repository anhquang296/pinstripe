import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@lib/cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost';
}

export default function Button({ variant = 'primary', className, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary'
          ? 'bg-indigo-600 text-white hover:bg-indigo-500'
          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
        className,
      )}
      {...rest}
    />
  );
}
