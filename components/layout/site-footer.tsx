import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { Logo } from "./logo";
import { Envelope, Phone } from "@/components/ui/icons";

const COLUMNS = [
  {
    title: "Louer",
    links: [
      { href: "/catalogue", label: "Catalogue" },
      { href: "/categories", label: "Catégories" },
      { href: "/#comment-ca-marche", label: "Comment ça marche" },
      { href: "/faq", label: "Questions fréquentes" },
    ],
  },
  {
    title: "Loueurs",
    links: [
      { href: "/devenir-loueur", label: "Devenir loueur" },
      { href: "/connexion", label: "Espace professionnel" },
      { href: "/conditions", label: "Conditions de location" },
    ],
  },
  {
    title: "LOC'CONNECT",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/confidentialite", label: "Confidentialité" },
      { href: "/conditions", label: "Conditions d'utilisation" },
    ],
  },
];

export async function SiteFooter() {
  const settings = await getSettings();
  return (
    <footer className="mt-24 bg-navy text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo inverse />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/75">La plateforme de location qui connecte clients et loueurs.</p>
          <ul className="mt-5 space-y-2 text-sm text-white/80">
            <li className="flex items-center gap-2">
              <Phone size={16} /> {settings["site.support_phone"]}
            </li>
            <li className="flex items-center gap-2">
              <Envelope size={16} /> {settings["site.support_email"]}
            </li>
          </ul>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="text-sm font-semibold text-white">{c.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {c.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className="text-sm text-white/75 transition hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-white/60 sm:px-6">
          <p>© {new Date().getFullYear()} LOC&apos;CONNECT. Tous droits réservés.</p>
          <p>Les paiements de démonstration sont simulés : aucun argent réel n&apos;est déplacé.</p>
        </div>
      </div>
    </footer>
  );
}
