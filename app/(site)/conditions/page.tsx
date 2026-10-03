import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PageShell } from "@/components/layout/page-shell";
import { Notice } from "@/components/ui/states";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation et de location",
  description: "Règles de réservation, paiement, caution, annulation, litiges et responsabilités entre clients, loueurs et LOC'CONNECT.",
  alternates: { canonical: "/conditions" },
};

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9" aria-labelledby={`art-${n}`}>
      <h2 id={`art-${n}`} className="text-xl font-semibold text-ink">{n}. {title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink/85">{children}</div>
    </section>
  );
}

export default async function ConditionsPage() {
  const [s, policy] = await Promise.all([
    getSettings(),
    db.cancellationPolicy.findFirst({ where: { active: true, isDefault: true }, include: { rules: { orderBy: { minHoursBefore: "desc" } } } }),
  ]);
  return (
    <PageShell title="Conditions générales d'utilisation et de location" description="Ces règles s'appliquent à tout client et à tout loueur utilisant LOC'CONNECT." narrow>
      <Notice tone="warning" title="Version de démonstration">Ce texte décrit fidèlement le fonctionnement de la plateforme. Avant une mise en service commerciale, il doit être relu et complété par un conseil juridique (identité de l&apos;éditeur, droit applicable, juridiction compétente).</Notice>

      <Section n={1} title="Rôle de LOC'CONNECT">
        <p>LOC&apos;CONNECT est une plateforme de mise en relation entre des clients qui souhaitent louer du matériel et des loueurs professionnels. Le contrat de location est conclu entre le client et chaque loueur pour les articles qu&apos;il fournit. LOC&apos;CONNECT encaisse le paiement, répartit les montants entre loueurs, gère les cautions et arbitre les litiges.</p>
      </Section>
      <Section n={2} title="Comptes">
        <p>La création d&apos;un compte exige des informations exactes. Un loueur est validé par LOC&apos;CONNECT avant de publier des produits, et chaque produit peut être soumis à modération. Chacun est responsable de la confidentialité de son mot de passe. LOC&apos;CONNECT peut suspendre un compte en cas de fraude, d&apos;abus ou de manquement répété.</p>
      </Section>
      <Section n={3} title="Réservation et disponibilité">
        <p>Les disponibilités affichées sont calculées en temps réel. À la validation du panier, le stock est bloqué pendant {s["hold.duration_minutes"]} minutes pour permettre le paiement. Sans paiement dans ce délai, le blocage est libéré. Une réservation n&apos;est confirmée qu&apos;après réception du paiement.</p>
        <p>Une période de location est comptée en jours calendaires : la date de début est incluse, la date de fin est exclue. La durée maximale d&apos;une location est de {s["booking.max_days"]} jours.</p>
      </Section>
      <Section n={4} title="Prix, frais et paiement">
        <p>Les prix sont exprimés en francs CFA (FCFA). Le total d&apos;une commande comprend la location de chaque article, les frais de livraison éventuels de chaque loueur et les cautions. Le client règle l&apos;ensemble en un seul paiement, même lorsque la commande concerne plusieurs loueurs.</p>
        <p>La commission de LOC&apos;CONNECT est prélevée sur la part du loueur et n&apos;ajoute aucun frais au client. Elle est figée au moment de la réservation.</p>
      </Section>
      <Section n={5} title="Caution">
        <p>Chaque article peut être assorti d&apos;une caution fixée par le loueur. Elle est bloquée avec le paiement et gérée séparément pour chaque article et chaque loueur. Après la location, le loueur constate l&apos;état du matériel. Sans dommage, la caution est restituée. En cas de dommage ou de perte, la retenue ne peut pas dépasser la caution, sauf si le produit autorise expressément une facturation complémentaire.</p>
        <p>Le client dispose de {s["return.contest_window_hours"]} heures pour accepter ou contester une retenue. La contestation gèle la caution concernée jusqu&apos;à décision.</p>
      </Section>
      <Section n={6} title="Livraison et retrait">
        <p>Chaque loueur définit s&apos;il livre, ses zones et ses frais. Les livraisons sont suivies par loueur. Lorsqu&apos;une commande mêle livraison et retrait, ou plusieurs loueurs, chaque partie suit son propre déroulement.</p>
      </Section>
      <Section n={7} title="Annulation et remboursement">
        <p>Le client peut annuler une réservation ou seulement certaines lignes. Le remboursement des locations dépend du délai restant avant le début de la location :</p>
        {policy && policy.rules.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5">
            {policy.rules.map((r) => <li key={r.id}>au moins {r.minHoursBefore} heures avant le début : remboursement de {r.refundPercent} % ;</li>)}
            <li>en deçà du dernier délai : aucun remboursement de la location.</li>
          </ul>
        ) : (
          <p>La politique en vigueur est affichée au moment de l&apos;annulation, avec le montant exact remboursé ligne par ligne.</p>
        )}
        <p>Les cautions sont intégralement restituées en cas d&apos;annulation.</p>
      </Section>
      <Section n={8} title="Modification d'une réservation">
        <p>Une réservation payée peut être modifiée (quantité, dates, articles) avant le début de la location, avec l&apos;accord du loueur concerné, qui répond sous {s["modification.lender_response_hours"]} heures. Sans réponse, la demande est transmise à LOC&apos;CONNECT. Un complément est réglé par un paiement distinct, une baisse de prix est remboursée.</p>
      </Section>
      <Section n={9} title="Litiges">
        <p>Un litige vise un loueur précis ; les autres loueurs de la commande ne sont pas concernés. Les parties échangent des messages et des pièces jointes, puis LOC&apos;CONNECT rend une décision motivée qui peut impliquer un remboursement ou une retenue de caution.</p>
      </Section>
      <Section n={10} title="Versement aux loueurs">
        <p>La part du loueur est versée {s["payout.freeze_hours"]} heures après la fin de la location, sous réserve de l&apos;absence de litige ou de contestation en cours. Les remboursements imputables au loueur peuvent être déduits de ses versements.</p>
      </Section>
      <Section n={11} title="Responsabilités">
        <p>Le client utilise le matériel conformément à sa destination et le restitue dans l&apos;état où il l&apos;a reçu, à l&apos;usure normale près. Le loueur garantit que son matériel est conforme à sa description et en bon état de fonctionnement. LOC&apos;CONNECT n&apos;est pas partie au contrat de location mais garantit le bon traitement des paiements, cautions et litiges décrits ici.</p>
      </Section>
      <Section n={12} title="Contact">
        <p>Pour toute question, écrivez à {s["site.support_email"]} ou utilisez la page Contact.</p>
      </Section>
    </PageShell>
  );
}
