"use client";

import { ChangeEvent } from 'react';

export type ClinicFilterOption = { value: string; label: string };

export type ClinicFilterProps = {
  value: string;
  options: ClinicFilterOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function ClinicFilter({ value, options, onChange, disabled }: ClinicFilterProps) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value);
  };

  return (
    <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-700">
      <span className="text-[10px] font-semibold text-slate-500">Clinic</span>
      <select
        className="h-10 w-52 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-500"
        value={value}
        onChange={handleChange}
        disabled={disabled}
      >
        <option value="">All Clinics</option>
        {options.map(({ value: optionValue, label }) => (
          <option key={optionValue} value={optionValue}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

