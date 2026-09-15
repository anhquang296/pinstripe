import { cn } from '@lib/cn';
import { map } from 'lodash-es';
import type { SelectHTMLAttributes } from 'react';

interface SelectFieldOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectFieldOption[];
  error?: string;
}

export default function SelectField({
  label,
  options,
  error,
  className,
  ...rest
}: SelectFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <select
        className={cn(
          'h-9 min-w-56 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500',
          className,
        )}
        {...rest}
      >
        {map(options, (option) => {
          return (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          );
        })}
      </select>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
