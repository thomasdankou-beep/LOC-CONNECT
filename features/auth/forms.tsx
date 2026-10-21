"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";

type City = { id: string; name: string };

function useSubmit<T>(path: string, onDone: (data: T) => void) {
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(body: unknown) {
    setPending(true);
    setError(null);
    try {
      onDone(await api<T>(path, { body }));
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("Une erreur est survenue.", "INTERNAL_ERROR", 500));
    } finally {
      setPending(false);
    }
  }
  return { submit, error, pending, fieldError: (name: string) => error?.details?.find((d) => d.path === name)?.message };
}

const form = (e: React.FormEvent<HTMLFormElement>) => Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;

const DEMO = [
  { label: "Client", email: "client01@demo-locconnect.ci" },
  { label: "Loueur", email: "loueur01@demo-locconnect.ci" },
  { label: "Administrateur", email: "admin@demo-locconnect.ci" },
  { label: "Finance", email: "finance@demo-locconnect.ci" },
];

export function LoginForm({ next, demo }: { next?: string; demo?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { submit, error, pending } = useSubmit<{ next: string }>("/api/auth/login", (data) => {
    router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : data.next);
    router.refresh();
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit({ email, password });
      }}
      className="flex flex-col gap-5"
      noValidate
    >
      <Input label="Adresse e-mail" type="email" name="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <div>
        <Input label="Mot de passe" type="password" name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <p className="mt-2 text-right text-sm">
          <Link href="/mot-de-passe-oublie" className="font-medium text-royal-ink hover:underline">Mot de passe oublié ?</Link>
        </p>
      </div>
      {error && (
        <div role="alert">
          <Notice tone="danger">{error.message}</Notice>
        </div>
      )}
      <Button type="submit" size="lg" loading={pending}>Se connecter</Button>
      {demo && (
        <div className="rounded-card border border-dashed border-line bg-surface-2/60 p-4">
          <p className="text-sm font-medium text-ink">Comptes de démonstration</p>
          <p className="mt-0.5 text-xs text-muted">Mot de passe commun : Demo2026!Loc</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DEMO.map((d) => (
              <button key={d.email} type="button" onClick={() => { setEmail(d.email); setPassword("Demo2026!Loc"); }} className="h-9 rounded-full border border-line bg-surface px-3.5 text-sm text-ink transition hover:bg-royal-soft">
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}

export function RegisterClientForm({ cities }: { cities: City[] }) {
  const router = useRouter();
  const { submit, error, pending, fieldError } = useSubmit("/api/auth/register", () => {
    router.push("/mon-compte");
    router.refresh();
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = form(e);
        void submit({ accountType: "CLIENT", firstName: v.firstName, lastName: v.lastName, email: v.email, phone: v.phone || undefined, cityId: v.cityId || undefined, password: v.password });
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Prénom" name="firstName" autoComplete="given-name" required error={fieldError("firstName")} />
        <Input label="Nom" name="lastName" autoComplete="family-name" required error={fieldError("lastName")} />
      </div>
      <Input label="Adresse e-mail" type="email" name="email" autoComplete="email" required error={fieldError("email")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Téléphone" type="tel" name="phone" autoComplete="tel" placeholder="+225 07 00 00 00 00" error={fieldError("phone")} />
        <Select label="Ville" name="cityId" defaultValue="">
          <option value="">Choisir</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </div>
      <Input label="Mot de passe" type="password" name="password" autoComplete="new-password" required hint="8 caractères minimum, avec au moins une lettre et un chiffre." error={fieldError("password")} />
      <Checkbox required label={<>J&apos;accepte les <Link href="/conditions" className="font-medium text-royal-ink hover:underline">conditions d&apos;utilisation</Link> et la <Link href="/confidentialite" className="font-medium text-royal-ink hover:underline">politique de confidentialité</Link>.</>} />
      {error && !error.details?.length && (
        <div role="alert"><Notice tone="danger">{error.message}</Notice></div>
      )}
      <Button type="submit" size="lg" loading={pending}>Créer mon compte</Button>
      <p className="text-center text-sm text-muted">
        Déjà inscrit ? <Link href="/connexion" className="font-medium text-royal-ink hover:underline">Se connecter</Link>
      </p>
    </form>
  );
}

export function RegisterLenderForm({ cities }: { cities: City[] }) {
  const router = useRouter();
  const { submit, error, pending, fieldError } = useSubmit("/api/auth/register", () => {
    router.push("/loueur/dashboard");
    router.refresh();
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = form(e);
        void submit({ accountType: "LENDER", companyName: v.companyName, rccm: v.rccm || undefined, cityId: v.cityId, description: v.description || undefined, firstName: v.firstName, lastName: v.lastName, email: v.email, phone: v.phone || undefined, password: v.password });
      }}
      className="flex flex-col gap-4"
    >
      <Input label="Nom de l'entreprise" name="companyName" required error={fieldError("companyName")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Numéro RCCM" name="rccm" placeholder="CI-ABJ-2024-B-00000" error={fieldError("rccm")} />
        <Select label="Ville principale" name="cityId" required defaultValue="">
          <option value="" disabled>Choisir</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </div>
      <Textarea label="Présentation de votre activité" name="description" rows={3} placeholder="Matériel proposé, zones desservies, expérience" error={fieldError("description")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Prénom du responsable" name="firstName" required error={fieldError("firstName")} />
        <Input label="Nom du responsable" name="lastName" required error={fieldError("lastName")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Adresse e-mail" type="email" name="email" autoComplete="email" required error={fieldError("email")} />
        <Input label="Téléphone" type="tel" name="phone" autoComplete="tel" error={fieldError("phone")} />
      </div>
      <Input label="Mot de passe" type="password" name="password" autoComplete="new-password" required hint="8 caractères minimum, avec au moins une lettre et un chiffre." error={fieldError("password")} />
      <Checkbox required label={<>J&apos;accepte les <Link href="/conditions" className="font-medium text-royal-ink hover:underline">conditions d&apos;utilisation</Link> et je comprends que mon entreprise sera validée par LOC&apos;CONNECT avant de publier.</>} />
      {error && !error.details?.length && (
        <div role="alert"><Notice tone="danger">{error.message}</Notice></div>
      )}
      <Button type="submit" size="lg" loading={pending}>Créer mon compte professionnel</Button>
    </form>
  );
}

export function ForgotForm() {
  const [done, setDone] = useState<{ devLink?: string } | null>(null);
  const { submit, error, pending } = useSubmit<{ devLink?: string }>("/api/auth/forgot-password", (d) => setDone(d));
  if (done)
    return (
      <div className="space-y-4">
        <Notice tone="success" title="Demande envoyée">Si un compte existe avec cette adresse, un lien de réinitialisation vient d&apos;être envoyé. Il est valable 1 heure.</Notice>
        {done.devLink && (
          <Notice tone="info" title="Mode démonstration">
            Aucun e-mail n&apos;est configuré. Utilisez ce lien : <Link href={done.devLink.replace(/^https?:\/\/[^/]+/, "")} className="break-all font-medium text-royal-ink underline">ouvrir le formulaire de réinitialisation</Link>
          </Notice>
        )}
      </div>
    );
  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit({ email: form(e).email }); }} className="flex flex-col gap-5">
      <Input label="Adresse e-mail" type="email" name="email" autoComplete="email" required />
      {error && <div role="alert"><Notice tone="danger">{error.message}</Notice></div>}
      <Button type="submit" size="lg" loading={pending}>Envoyer le lien</Button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const { submit, error, pending, fieldError } = useSubmit("/api/auth/reset-password", () => router.push("/connexion?reset=1"));
  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit({ token, password: form(e).password }); }} className="flex flex-col gap-5">
      <Input label="Nouveau mot de passe" type="password" name="password" autoComplete="new-password" required hint="8 caractères minimum, avec au moins une lettre et un chiffre." error={fieldError("password")} />
      {error && !error.details?.length && <div role="alert"><Notice tone="danger">{error.message}</Notice></div>}
      <Button type="submit" size="lg" loading={pending}>Enregistrer le mot de passe</Button>
    </form>
  );
}
