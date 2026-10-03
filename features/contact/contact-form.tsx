"use client";

import { useRef, useState } from "react";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { CheckCircle } from "@/components/ui/icons";

export function ContactForm({ defaults }: { defaults?: { name: string; email: string; phone: string } }) {
  const { run, pending, error } = useAction();
  const [sent, setSent] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  const fe = (n: string) => error?.details?.find((d) => d.path === n)?.message;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "").trim();
    const res = await run("/api/contact", { body: { name: get("name"), email: get("email"), phone: get("phone") || undefined, subject: get("subject"), message: get("message"), website: get("website") } }, { silentError: true, refresh: false });
    if (res !== undefined) {
      setSent(true);
      ref.current?.reset();
    }
  }

  if (sent) {
    return (
      <div className="rounded-card border border-line bg-surface p-8 text-center shadow-card" role="status">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-soft text-success"><CheckCircle size={30} weight="fill" /></span>
        <h2 className="mt-4 text-xl font-semibold text-ink">Message envoyé</h2>
        <p className="mt-1 text-muted">Notre équipe vous répond par e-mail.</p>
        <Button variant="secondary" className="mt-6" onClick={() => setSent(false)}>Envoyer un autre message</Button>
      </div>
    );
  }
  return (
    <form ref={ref} onSubmit={submit} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6 shadow-card sm:p-8" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nom" name="name" required autoComplete="name" defaultValue={defaults?.name} error={fe("name")} />
        <Input label="Adresse e-mail" name="email" type="email" required autoComplete="email" defaultValue={defaults?.email} error={fe("email")} />
      </div>
      <Input label="Téléphone (facultatif)" name="phone" type="tel" autoComplete="tel" defaultValue={defaults?.phone} error={fe("phone")} />
      <Input label="Objet" name="subject" required error={fe("subject")} />
      <Textarea label="Message" name="message" required rows={6} error={fe("message")} hint="Pour une réservation, indiquez sa référence." />
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden><label>Ne pas remplir<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      {error && !error.details?.length && <Notice tone="danger">{error.message}</Notice>}
      <div><Button type="submit" size="lg" loading={pending}>Envoyer le message</Button></div>
    </form>
  );
}
