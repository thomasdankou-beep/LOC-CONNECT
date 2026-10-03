import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { PageShell } from "@/components/layout/page-shell";
import { Notice } from "@/components/ui/states";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Quelles données LOC'CONNECT collecte, pourquoi, combien de temps, et comment exercer vos droits.",
  alternates: { canonical: "/confidentialite" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink/85">{children}</div>
    </section>
  );
}

export default async function PrivacyPage() {
  const s = await getSettings();
  return (
    <PageShell title="Politique de confidentialité" description="Nous collectons le minimum de données nécessaire pour faire fonctionner vos locations." narrow>
      <Notice tone="warning" title="Version de démonstration">Ce texte décrit les traitements réellement réalisés par la plateforme. Il doit être complété par l&apos;identité de l&apos;éditeur et validé par un conseil juridique avant une mise en service commerciale.</Notice>

      <Section title="Données collectées">
        <ul className="list-disc space-y-1 pl-5">
          <li>Identité et contact : nom, prénom, adresse e-mail, téléphone, adresse de livraison.</li>
          <li>Données de réservation : produits, dates, montants, statuts, messages de litige et pièces jointes.</li>
          <li>Données de paiement : montant, moyen de paiement, référence et statut. Les numéros de carte ou de compte mobile ne sont jamais conservés par LOC&apos;CONNECT.</li>
          <li>Preuves de retour et de livraison : photos privées, visibles uniquement par le client, le loueur concerné et l&apos;administration.</li>
          <li>Données techniques : adresse IP et navigateur, utilisés pour la sécurité et le journal d&apos;audit.</li>
        </ul>
      </Section>
      <Section title="Finalités">
        <p>Vos données servent à exécuter vos réservations, encaisser et répartir les paiements, gérer les cautions et les litiges, vous notifier, prévenir la fraude et respecter nos obligations comptables. Elles ne sont ni vendues ni cédées à des tiers publicitaires.</p>
      </Section>
      <Section title="Qui voit quoi">
        <p>Un loueur ne voit que les clients ayant réservé chez lui, et uniquement ce qui est nécessaire à la location (nom, téléphone, adresse de livraison). Il ne voit jamais les lignes d&apos;un autre loueur dans une commande partagée. Les collaborateurs d&apos;un loueur n&apos;accèdent qu&apos;aux informations autorisées par leur rôle.</p>
      </Section>
      <Section title="Sécurité">
        <p>Les mots de passe sont stockés sous forme hachée. Les sessions sont révocables. Les actions sensibles sont journalisées avec leur auteur, leur date et la valeur avant et après modification. Les fichiers privés ne sont accessibles qu&apos;après contrôle des droits.</p>
      </Section>
      <Section title="Conservation">
        <p>Les données de compte sont conservées tant que le compte est actif. Les données financières et l&apos;historique des réservations sont conservés pour les durées légales de conservation comptable, y compris après la suppression d&apos;un compte.</p>
      </Section>
      <Section title="Vos droits">
        <p>Vous pouvez consulter et corriger vos informations depuis votre profil, et supprimer votre compte : vos données personnelles sont alors anonymisées, tandis que les éléments financiers nécessaires aux obligations légales sont conservés sans identité directe. Pour toute demande, écrivez à {s["site.support_email"]}.</p>
      </Section>
      <Section title="Cookies">
        <p>LOC&apos;CONNECT utilise un unique cookie de session, strictement nécessaire à la connexion. Aucun cookie publicitaire ou de suivi n&apos;est déposé.</p>
      </Section>
    </PageShell>
  );
}
