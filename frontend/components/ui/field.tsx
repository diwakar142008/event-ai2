import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

function Wrapper({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && !error ? <p className="field-hint">{hint}</p> : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  id,
  label,
  hint,
  error,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; hint?: string; error?: string }) {
  return (
    <Wrapper id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        {...props}
        className={`field-input ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${id}-desc` : undefined}
      />
      {(hint || error) && (
        <span id={`${id}-desc`} className="sr-only">
          {error ?? hint}
        </span>
      )}
    </Wrapper>
  );
}

export function SelectField({
  id,
  label,
  hint,
  error,
  children,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <Wrapper id={id} label={label} hint={hint} error={error}>
      <select id={id} {...props} className={`field-input ${className}`} aria-invalid={error ? true : undefined}>
        {children}
      </select>
    </Wrapper>
  );
}

export function TextAreaField({
  id,
  label,
  hint,
  error,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string; label: string; hint?: string; error?: string }) {
  return (
    <Wrapper id={id} label={label} hint={hint} error={error}>
      <textarea id={id} {...props} className={`field-input min-h-[110px] resize-y ${className}`} aria-invalid={error ? true : undefined}>
        {props.children}
      </textarea>
    </Wrapper>
  );
}
