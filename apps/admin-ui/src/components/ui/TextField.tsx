import type { InputHTMLAttributes } from 'react';
import { cn } from '@lib/cn';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export default function TextField({ label, error, className, ...rest }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        className={cn(
          'h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500',
          className,
        )}
        {...rest}
      />
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
