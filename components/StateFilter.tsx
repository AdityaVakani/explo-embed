"use client";

import { ChangeEvent } from 'react';

export type StateFilterProps = {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function StateFilter({ value, options, onChange, disabled }: StateFilterProps) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value);
  };

  return (
    <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-200">
      <span className="text-[10px] font-semibold text-slate-400">State</span>
      <select
        className="h-10 w-40 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-500"
        value={value}
        onChange={handleChange}
        disabled={disabled}
      >
        <option value="">All States</option>
        {options.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
    </label>
  );
}
