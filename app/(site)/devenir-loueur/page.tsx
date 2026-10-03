import type { Metadata } from "next";
import { listCities } from "@/services/catalog";
import { Card } from "@/components/ui/card";
import { CalendarCheck, ChartLineUp, Receipt, ShieldCheck, Storefront, Wallet } from "@/components/ui/icons";
import { RegisterLenderForm } from "@/features/auth/forms";

export const metadata: Metadata = {
  title: "Devenir loueur : publiez votre matériel",
  description: "Rejoignez LOC'CONNECT : publiez vos produits, gérez stock, réservations, livraisons, retours et revenus depuis un espace professionnel avec sous-comptes.",
  alternates: { canonical: "/devenir-loueur" },
};

const POINTS = [
  { i: <Storefront size={22} />, t: "Vos produits en vitrine", d: "Photos, prix, caution et conditions : vous gardez la main sur votre offre." },
  { i: <CalendarCheck size={22} />, t: "Stock et calendrier fiables", d: "Aucune double réservation : la disponibilité est calculée par le serveur à chaque commande." },
  { i: <ShieldCheck size={22} />, t: "Caution et retour encadrés", d: "Constat avec photos, retenue plafonnée par la caution, complément possible selon le produit." },
  { i: <Wallet size={22} />, t: "Versements transparents", d: "Vous voyez les montants gelés, disponibles et versés. Le gel protège aussi contre les contestations." },
  { i: <Receipt size={22} />, t: "Équipe et permissions", d: "Créez des sous-comptes (stock, commandes, finance, livraison, retours) avec des droits précis." },
  { i: <ChartLineUp size={22} />, t: "Pilotage de l'activité", d: "Tableau de bord des revenus, des réservations à venir, des retours et des avis." },
];

export default async function BecomeLenderPage() {
  const cities = await listCities();
  return (
    <div className="mx-auto max-w-7xl px-4 pb-4 pt-10 sm:px-6">
      <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <div>
          <h1 className="text-4xl font-semibold leading-tight text-ink sm:text-5xl">Faites travailler votre matériel.</h1>
          <p className="mt-4 max-w-xl text-lg text-muted">LOC&apos;CONNECT vous met en relation avec des clients qui cherchent exactement ce que vous louez, et sécurise paiement, caution et retour.</p>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2">
            {POINTS.map((p) => (
              <li key={p.t} className="flex gap-3.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-royal-soft text-royal-ink">{p.i}</span>
                <div>
                  <h2 className="font-semibold text-ink">{p.t}</h2>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted">{p.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <Card className="p-6 sm:p-8 lg:sticky lg:top-24">
          <h2 className="text-xl font-semibold text-ink">Ouvrir mon compte professionnel</h2>
          <p className="mt-1 text-sm text-muted">Votre dossier est examiné par notre équipe avant la publication de vos produits.</p>
          <div className="mt-6">
            <RegisterLenderForm cities={cities.map((c) => ({ id: c.id, name: c.name }))} />
          </div>
        </Card>
      </div>
    </div>
  );
}
