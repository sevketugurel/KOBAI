import { forwardRef, useId } from "react";
import type { SelectHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

const SELECT_BASE =
  "w-full rounded-lg border bg-surface px-3 py-2 text-sm text-navy-900 outline-none transition focus:ring-2 focus:ring-navy-500";

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, id, className, children, ...rest },
  ref,
) {
  const reactId = useId();
  const selectId = id ?? reactId;
  const describedBy = error
    ? `${selectId}-error`
    : hint
      ? `${selectId}-hint`
      : undefined;

  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={selectId} className="text-xs font-medium text-navy-600">
          {label}
        </label>
      ) : null}
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          SELECT_BASE,
          error
            ? "border-red-500 focus:ring-red-500 focus:border-red-500"
            : "border-border focus:border-navy-500",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <p id={`${selectId}-error`} className="text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${selectId}-hint`} className="text-xs text-navy-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export default Select;
