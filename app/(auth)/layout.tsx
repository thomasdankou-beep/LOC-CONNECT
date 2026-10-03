import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { Photo } from "@/components/ui/photo";
import { IMAGES } from "@/lib/images";
import { ShieldCheck, Handshake, Receipt } from "@/components/ui/icons";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Logo />
        <main id="contenu" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          {children}
        </main>
        <p className="text-center text-xs text-muted">
          <Link href="/conditions" className="hover:text-ink">Conditions</Link> · <Link href="/confidentialite" className="hover:text-ink">Confidentialité</Link> · <Link href="/contact" className="hover:text-ink">Contact</Link>
        </p>
      </div>
      <aside className="relative isolate hidden overflow-hidden bg-navy lg:block" aria-hidden>
        <Photo src={IMAGES.auth} alt="" w={1000} h={1400} priority className="absolute inset-0 -z-10 size-full opacity-60" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-navy via-navy/60 to-navy/20" />
        <div className="flex h-full flex-col justify-end p-12 text-white">
          <p className="max-w-md text-3xl font-semibold leading-tight">La plateforme de location qui connecte clients et loueurs.</p>
          <ul className="mt-8 space-y-4 text-[15px] text-white/85">
            <li className="flex items-center gap-3"><Handshake size={22} /> Un panier, plusieurs loueurs, un seul paiement</li>
            <li className="flex items-center gap-3"><ShieldCheck size={22} /> Caution par article, restituée après le constat de retour</li>
            <li className="flex items-center gap-3"><Receipt size={22} /> Suivi de chaque réservation, du paiement au retour</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
