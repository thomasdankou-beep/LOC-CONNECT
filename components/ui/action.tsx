"use client";

import { useState, type ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./button";
import { Modal } from "./modal";
import { Input, Select, Textarea } from "./field";
import { useAction } from "@/hooks/use-action";

type Method = "POST" | "PATCH" | "PUT" | "DELETE";

/** Bouton de mutation générique : appel API, confirmation optionnelle, toast, rafraîchissement. */
export function ActionButton({ endpoint, method = "POST", body, label, variant = "secondary", size = "sm", confirm, success, icon, disabled, className }: { endpoint: string; method?: Method; body?: unknown; label: ReactNode; variant?: ButtonVariant; size?: ButtonSize; confirm?: { title: string; description?: string; confirmLabel?: string }; success?: string; icon?: ReactNode; disabled?: boolean; className?: string }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const go = async () => {
    const res = await run(endpoint, { method, body }, { success });
    if (res !== undefined) setOpen(false);
  };
  return (
    <>
      <Button variant={variant} size={size} loading={pending && !open} disabled={disabled} className={className} onClick={() => (confirm ? setOpen(true) : void go())}>
        {icon}
        {label}
      </Button>
      {confirm && (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title={confirm.title}
          description={confirm.description}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button variant={variant === "danger" ? "danger" : "primary"} loading={pending} onClick={go}>
                {confirm.confirmLabel ?? "Confirmer"}
              </Button>
            </>
          }
        />
      )}
    </>
  );
}

export type FormField = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "select" | "date";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
  defaultValue?: string | number;
  min?: number;
  max?: number;
};

/** Bouton qui ouvre un formulaire (champs déclaratifs) puis envoie le JSON à l'API. */
export function FormAction({ endpoint, method = "POST", label, title, description, fields, submitLabel = "Envoyer", variant = "secondary", size = "sm", success, icon, extra, className, transform }: { endpoint: string; method?: Method; label: ReactNode; title: string; description?: string; fields: FormField[]; submitLabel?: string; variant?: ButtonVariant; size?: ButtonSize; success?: string; icon?: ReactNode; extra?: Record<string, unknown>; className?: string; transform?: (values: Record<string, unknown>) => unknown }) {
  const { run, pending, error } = useAction();
  const [open, setOpen] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const values: Record<string, unknown> = { ...extra };
    for (const f of fields) {
      const raw = String(fd.get(f.name) ?? "").trim();
      if (raw === "" && !f.required) continue;
      values[f.name] = f.type === "number" ? Number(raw) : raw;
    }
    const res = await run(endpoint, { method, body: transform ? transform(values) : values }, { success, silentError: true });
    if (res !== undefined) setOpen(false);
  }

  const fieldError = (name: string) => error?.details?.find((d) => d.path === name)?.message;

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        {icon}
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description}>
        <form onSubmit={submit} id={`form-${endpoint}-${String(label)}`} className="flex flex-col gap-4">
          {fields.map((f) =>
            f.type === "textarea" ? (
              <Textarea key={f.name} name={f.name} label={f.label} required={f.required} placeholder={f.placeholder} hint={f.hint} defaultValue={f.defaultValue} error={fieldError(f.name)} />
            ) : f.type === "select" ? (
              <Select key={f.name} name={f.name} label={f.label} required={f.required} hint={f.hint} defaultValue={f.defaultValue} error={fieldError(f.name)}>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            ) : (
              <Input key={f.name} name={f.name} label={f.label} type={f.type ?? "text"} required={f.required} placeholder={f.placeholder} hint={f.hint} defaultValue={f.defaultValue} min={f.min} max={f.max} error={fieldError(f.name)} />
            ),
          )}
          {error && !error.details?.length && (
            <p role="alert" className="text-sm text-danger">
              {error.message}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={pending}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
