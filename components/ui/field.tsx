import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "w-full rounded-control border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-muted/80 transition focus-visible:border-royal focus-visible:outline-2 focus-visible:outline-royal/30 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger";

type Common = { label: string; hint?: string; error?: string; className?: string };

function Wrap({ id, label, hint, error, className, children }: Common & { id: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ label, hint, error, className, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint} error={error} className={className}>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} className={cn(CONTROL, "h-11")} {...rest} />
    </Wrap>
  );
}

export function Textarea({ label, hint, error, className, rows = 4, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint} error={error} className={className}>
      <textarea id={id} rows={rows} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} className={cn(CONTROL, "py-2.5")} {...rest} />
    </Wrap>
  );
}

export function Select({ label, hint, error, className, children, ...rest }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint} error={error} className={className}>
      <select id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} className={cn(CONTROL, "h-11 pr-8")} {...rest}>
        {children}
      </select>
    </Wrap>
  );
}

export function Checkbox({ label, className, ...rest }: { label: ReactNode; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <input id={id} type="checkbox" className="mt-1 size-4 shrink-0 rounded border-line accent-[var(--lc-royal)]" {...rest} />
      <label htmlFor={id} className="text-sm text-ink">
        {label}
      </label>
    </div>
  );
}
