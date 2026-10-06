import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { depositPercentFrom } from "@/services/pricing";
import { PageShell } from "@/components/layout/page-shell";
import { CaretDown } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Questions fréquentes",
  description: "Réservation, paiement, caution, livraison, annulation, litiges : toutes les réponses pour louer ou proposer du matériel sur LOC'CONNECT.",
  alternates: { canonical: "/faq" },
};

type QA = { q: string; a: string };
type Group = { title: string; items: QA[] };

function groups(hours: { hold: number; freeze: number; contest: number; response: number; depositPercent: number | null }): Group[] {
  return [
    {
      title: "Réserver",
      items: [
        { q: "Comment réserver du matériel ?", a: "Choisissez vos dates sur la fiche du produit, ajoutez-le au panier, puis passez au paiement. Vous pouvez commander chez plusieurs loueurs dans un même panier et payer une seule fois : chaque loueur reste responsable de sa propre partie de la commande." },
        { q: "Mon matériel est-il bloqué pendant que je paie ?", a: `Oui. Dès que vous validez votre panier, le stock est bloqué ${hours.hold} minutes (HOLD) pour que personne ne vous le prenne pendant le paiement. Passé ce délai sans paiement, le blocage est libéré automatiquement.` },
        { q: "Puis-je modifier ma réservation après paiement ?", a: `Oui, tant que la location n'a pas commencé et dans le délai prévu. Toute modification doit être acceptée par le loueur concerné, qui répond dans un délai de ${hours.response} heures. Sans réponse, la demande est transmise à notre équipe. Un complément éventuel se règle par un paiement distinct ; une baisse de prix est remboursée intégralement.` },
        { q: "Que se passe-t-il si le matériel n'est plus disponible ?", a: "La disponibilité est recalculée par nos serveurs à chaque étape. Si le stock a été pris entre-temps, nous vous l'indiquons avant le paiement, jamais après." },
      ],
    },
    {
      title: "Payer et caution",
      items: [
        { q: "Qu'est-ce que la caution ?", a: `${hours.depositPercent != null ? `La caution vaut ${hours.depositPercent} % du montant de la location chez chaque loueur.` : "Chaque article loué peut avoir une caution, définie par le loueur."} Elle est payée avec votre réservation, ligne par ligne, et restituée après le constat de retour si le matériel revient en bon état. Elle n'est jamais mélangée avec celle d'un autre loueur.` },
        { q: "Quand récupère-je ma caution ?", a: "Sans dommage constaté, la caution est restituée dès le constat de retour. En cas de dommage ou de perte, le loueur déclare le montant avec des photos. La retenue est plafonnée par le montant de la caution." },
        { q: "Puis-je contester une retenue ?", a: `Oui. Vous disposez de ${hours.contest} heures après le constat pour l'accepter ou le contester. Une contestation gèle la caution concernée et ouvre un litige arbitré par LOC'CONNECT.` },
        { q: "Puis-je payer en espèces ?", a: "Oui, chez les loueurs qui le proposent (indiqué « acompte + espèces » sur la fiche du produit et dans le panier). Vous payez en ligne un acompte et la caution, puis le reste en espèces au loueur quand il vous remet le matériel. Votre code de remise, visible dans votre réservation, sert de preuve : donnez-le au loueur seulement après avoir payé et reçu le matériel. Les autres loueurs restent payés en ligne, avec le même paiement unique." },
        { q: "Quels moyens de paiement sont acceptés ?", a: "Orange Money, MTN Money, Moov Money, Wave et carte bancaire. Dans la version de démonstration, le paiement est simulé : aucun argent réel n'est débité." },
      ],
    },
    {
      title: "Livraison et retour",
      items: [
        { q: "Comment fonctionne la livraison ?", a: "Si le loueur propose la livraison, vous la choisissez au moment de la commande et indiquez votre adresse. Chaque loueur livre sa partie de la commande avec ses propres frais. Vous suivez l'état de chaque livraison depuis votre espace." },
        { q: "Comment se passe le retour du matériel ?", a: "À la fin de la location, le loueur constate l'état du matériel (quantités retournées, perdues, endommagées) et ajoute des photos si nécessaire. Vous êtes notifié du résultat." },
      ],
    },
    {
      title: "Annulation et remboursement",
      items: [
        { q: "Puis-je annuler ?", a: "Oui. Le remboursement dépend de la politique d'annulation et du délai avant le début de la location. Un aperçu exact du remboursement, ligne par ligne, vous est montré avant de confirmer. Vous pouvez annuler une seule ligne sans toucher aux autres." },
        { q: "Qu'est-ce qu'un litige ?", a: "Un litige cible un seul loueur. Les autres loueurs de votre commande ne sont pas concernés et leurs lignes continuent normalement. Vous échangez avec le loueur et notre équipe, avec pièces jointes, jusqu'à la décision." },
      ],
    },
    {
      title: "Loueurs",
      items: [
        { q: "Comment devenir loueur ?", a: "Créez un compte professionnel depuis la page « Devenir loueur ». Notre équipe valide votre entreprise, puis vous publiez vos produits, gérez le stock, les livraisons, les retours et vos revenus." },
        { q: "Quand suis-je payé ?", a: `Votre part est versée ${hours.freeze} heures après la fin de la location, sauf litige ou contestation en cours. La commission de LOC'CONNECT est définie par la plateforme et figée au moment de chaque réservation.` },
        { q: "Puis-je être payé en espèces par mes clients ?", a: "Oui, après accord de LOC'CONNECT. Vos clients paient en ligne un acompte (notre commission) et la caution, puis vous règlent le solde en espèces à la remise. Vous confirmez l'encaissement en saisissant leur code de remise. Si un client ne paie pas, vous gardez votre matériel et vous le signalez depuis la réservation. Le choix se fait dans « Mon entreprise »." },
        { q: "Puis-je donner accès à mon équipe ?", a: "Oui. Vous créez des sous-comptes avec des rôles précis (stock, commandes, finance, livraison, retours) ou des rôles personnalisés. Vos collaborateurs n'accèdent qu'à votre entreprise." },
      ],
    },
  ];
}

export default async function FaqPage() {
  const s = await getSettings();
  const data = groups({ hold: s["hold.duration_minutes"], freeze: s["payout.freeze_hours"], contest: s["return.contest_window_hours"], response: s["modification.lender_response_hours"], depositPercent: depositPercentFrom(s) });
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: data.flatMap((g) => g.items).map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })) };
  return (
    <PageShell title="Questions fréquentes" description="Tout ce qu'il faut savoir pour louer ou proposer du matériel sur LOC'CONNECT." narrow>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="space-y-10">
        {data.map((g) => (
          <section key={g.title} aria-labelledby={`faq-${g.title}`}>
            <h2 id={`faq-${g.title}`} className="mb-3 text-xl font-semibold text-ink">{g.title}</h2>
            <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
              {g.items.map((i) => (
                <details key={i.q} className="group">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-medium text-ink transition hover:bg-surface-2/50 [&::-webkit-details-marker]:hidden">
                    {i.q}
                    <CaretDown size={18} className="shrink-0 text-muted transition group-open:rotate-180" />
                  </summary>
                  <p className="px-5 pb-5 text-[15px] leading-relaxed text-muted">{i.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className="mt-10 rounded-card bg-royal-soft p-5 text-ink">Vous ne trouvez pas votre réponse ? <Link href="/contact" className="font-semibold text-royal-ink underline-offset-4 hover:underline">Écrivez-nous</Link>.</p>
    </PageShell>
  );
}
