"use client";

import { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';

export type ClinicFilterOption = { value: string; label: string };

export type ClinicFilterProps = {
  values: string[];
  options: ClinicFilterOption[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
};

export function ClinicFilter({ values, options, onChange, disabled }: ClinicFilterProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!containerRef.current || !target) {
        return;
      }
      if (!containerRef.current.contains(target)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSearchTerm('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const input = searchInputRef.current;
    if (input) {
      input.focus();
      const length = input.value.length;
      if (typeof input.setSelectionRange === 'function') {
        input.setSelectionRange(length, length);
      }
    }
  }, [open]);

  const selectedOptions = useMemo(() => {
    if (!values.length) {
      return [] as Array<{ value: string; label: string }>;
    }
    const labelMap = new Map(options.map((option) => [option.value, option.label]));
    return values.map((value) => ({ value, label: labelMap.get(value) ?? value }));
  }, [options, values]);

  const filteredOptions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return options;
    }
    return options.filter(({ label, value }) => {
      const haystack = `${label} ${value}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [options, searchTerm]);

  const summary = useMemo(() => {
    if (!selectedOptions.length) {
      return 'All clinics';
    }
    if (selectedOptions.length <= 2) {
      return selectedOptions.map((option) => option.label).join(', ');
    }
    return `${selectedOptions.length} clinics selected`;
  }, [selectedOptions]);

  const toggleOpen = () => {
    if (disabled) {
      return;
    }
    setOpen((value) => !value);
  };

  const handleButtonKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    const { key } = event;
    if (key === 'Enter' || key === ' ' || key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      return;
    }
    const isPrintable = key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
    if (isPrintable) {
      event.preventDefault();
      setOpen(true);
      setSearchTerm(key);
    }
  };

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleToggle = (rawValue: string) => {
    if (disabled) {
      return;
    }
    const normalized = normalizeValue(rawValue);
    if (!normalized) {
      return;
    }
    if (values.includes(normalized)) {
      onChange(values.filter((value) => value !== normalized));
    } else {
      onChange([...values, normalized]);
    }
  };

  const handleRemove = (rawValue: string) => {
    const normalized = normalizeValue(rawValue);
    if (!normalized) {
      return;
    }
    if (values.includes(normalized)) {
      onChange(values.filter((value) => value !== normalized));
    }
  };

  const handleClear = () => {
    if (values.length) {
      onChange([]);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-700 ${open ? 'z-[1100]' : 'z-20'}`}
    >
      <span className="text-[10px] font-semibold text-slate-500">Clinics</span>
      <button
        type="button"
        className={`h-10 w-60 rounded-md border px-3 text-left text-sm normal-case text-slate-900 transition focus:outline-none focus:ring-2 focus:ring-slate-500/60 ${
          disabled
            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
            : 'border-slate-300 bg-white hover:border-slate-400'
        }`}
        onClick={toggleOpen}
        onKeyDown={handleButtonKeyDown}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate">{summary}</span>
          <span className="text-[10px] text-slate-400" aria-hidden="true">
            v
          </span>
        </div>
      </button>
      {selectedOptions.length ? (
        <div className="flex flex-wrap gap-1 text-[10px] normal-case text-slate-500">
          {selectedOptions.map(({ value, label }) => (
            <button
              type="button"
              key={value}
              onClick={() => handleRemove(value)}
              className="flex items-center gap-1 rounded-full bg-slate-200/70 px-2 py-[2px] text-slate-600 transition hover:bg-slate-300 hover:text-slate-800"
            >
              <span className="truncate">{label}</span>
              <span aria-hidden="true">x</span>
            </button>
          ))}
        </div>
      ) : null}
      {open ? (
        <div className="absolute right-0 top-full z-[1200] shadow-2xl mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-xl">
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search clinics..."
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
          />
          <div className="mt-3 max-h-60 overflow-auto rounded-md border border-slate-100">
            {filteredOptions.length ? (
              filteredOptions.map(({ value, label }) => {
                const isSelected = values.includes(value);
                return (
                  <button
                    type="button"
                    key={value}
                    onClick={() => handleToggle(value)}
                    className={`flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left normal-case last:border-b-0 ${
                      isSelected
                        ? 'border-slate-200 bg-slate-100 font-semibold text-slate-900'
                        : 'border-slate-100 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{label}</span>
                    {isSelected ? <span aria-hidden="true" className="text-slate-500">*</span> : null}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-center text-slate-400">No clinics match that search.</div>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400">
            <button
              type="button"
              onClick={handleClear}
              className="rounded px-2 py-1 text-[10px] normal-case text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
              disabled={!values.length}
            >
              Clear all
            </button>
            <span>{values.length ? `${values.length} selected` : 'No filters applied'}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function normalizeValue(value: string): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.toUpperCase();
}
