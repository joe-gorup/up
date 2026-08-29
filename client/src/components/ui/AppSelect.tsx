import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type AppSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type AppSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: AppSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  'data-testid'?: string;
};

export default function AppSelect({
  value,
  onChange,
  options,
  placeholder = 'Choose an option…',
  className = '',
  disabled = false,
  id,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: AppSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find(option => option.value === value);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid={testId}
        onClick={() => setOpen(current => !current)}
        onKeyDown={handleTriggerKeyDown}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={selected ? '' : 'text-slate-400'}>{selected?.label || placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 z-50 mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              disabled={option.disabled}
              onClick={() => {
                if (option.disabled) return;
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                option.value === value
                  ? 'bg-amber-50 font-semibold text-amber-900'
                  : 'text-slate-700 hover:bg-slate-50'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <span>{option.label}</span>
              {option.value === value && <Check className="h-4 w-4 text-amber-700" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}