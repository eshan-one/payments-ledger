import { useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  /** Inline validation/help text rendered under the field. */
  hint?: ReactNode;
  /** Marks the hint as an error and wires aria-invalid for assistive tech. */
  error?: boolean;
}

/**
 * A labelled input. The label is always associated via a generated id so the
 * field is keyboard/screen-reader accessible without callers wiring ids.
 */
export function Input({ label, hint, error, id, className, ...rest }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;

  return (
    <div className={["field", className].filter(Boolean).join(" ")}>
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className="input"
        aria-invalid={error || undefined}
        aria-describedby={hintId}
        {...rest}
      />
      {hint && (
        <span id={hintId} className={error ? "field__hint field__hint--error" : "field__hint"}>
          {hint}
        </span>
      )}
    </div>
  );
}
