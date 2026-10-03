import type { Metadata } from "next";
import { getActor } from "@/lib/auth/actor";
import { getSettings } from "@/lib/settings";
import { PageShell } from "@/components/layout/page-shell";
import { ContactForm } from "@/features/contact/contact-form";
import { Envelope, Phone } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Contact",
  description: "Une question sur une réservation, un paiement ou votre compte loueur ? Contactez l'équipe LOC'CONNECT.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const [actor, s] = await Promise.all([getActor(), getSettings()]);
  const phone = s["site.support_phone"];
  const email = s["site.support_email"];
  return (
    <PageShell title="Nous contacter" description="Une question sur une réservation, un paiement, une caution ou votre compte ? Notre équipe vous répond.">
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <ContactForm defaults={actor ? { name: `${actor.firstName} ${actor.lastName}`.trim(), email: actor.email, phone: "" } : undefined} />
        <aside className="space-y-4">
          <div className="rounded-card border border-line bg-surface p-5 shadow-card">
            <h2 className="font-semibold text-ink">Coordonnées</h2>
            <ul className="mt-4 space-y-4 text-[15px]">
              <li className="flex gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-royal-soft text-royal-ink"><Envelope size={20} /></span><span><span className="block text-sm text-muted">E-mail</span><a href={`mailto:${email}`} className="font-medium text-ink hover:underline">{email}</a></span></li>
              <li className="flex gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-royal-soft text-royal-ink"><Phone size={20} /></span><span><span className="block text-sm text-muted">Téléphone</span><a href={`tel:${phone.replace(/\s/g, "")}`} className="font-medium text-ink hover:underline">{phone}</a></span></li>
            </ul>
          </div>
          <p className="rounded-card bg-surface-2 p-5 text-sm text-muted">Pour un problème sur une location en cours, ouvrez plutôt un litige depuis le détail de votre réservation : le loueur concerné et notre équipe sont alors tous deux informés.</p>
        </aside>
      </div>
    </PageShell>
  );
}
