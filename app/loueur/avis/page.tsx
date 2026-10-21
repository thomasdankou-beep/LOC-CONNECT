import type { Metadata } from "next";
import Link from "next/link";
import { can } from "@/lib/auth/actor";
import { pageLender } from "@/lib/auth/page";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { listLenderReviews } from "@/services/reviews";
import { Card, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { KpiCard, Stars } from "@/components/ui/misc";
import { FormAction } from "@/components/ui/action";
import { Star } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Avis clients", robots: { index: false } };

export default async function Page() {
  const actor = await pageLender("REVIEW_VIEW");
  const [reviews, lender] = await Promise.all([listLenderReviews(actor.lenderId), db.lender.findUniqueOrThrow({ where: { id: actor.lenderId }, select: { ratingAvg: true, reviewCount: true } })]);
  const canReply = can(actor, "REVIEW_REPLY");
  const unanswered = reviews.filter((r) => !r.lenderReply && r.status === "PUBLISHED").length;

  return (
    <>
      <PageHeader title="Avis clients" description="Les avis sont publiés après une location terminée. Répondez publiquement pour rassurer les futurs clients." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Note moyenne" value={lender.reviewCount > 0 ? <Stars value={lender.ratingAvg} size={20} /> : "Aucun avis"} icon={<Star size={20} />} />
        <KpiCard label="Avis reçus" value={lender.reviewCount} />
        <KpiCard label="Sans réponse" value={unanswered} hint={unanswered > 0 ? "Répondre améliore la confiance" : "Tout est traité"} />
      </div>
      {reviews.length === 0 ? (
        <EmptyState icon={<Star size={28} />} title="Aucun avis pour le moment" description="Les avis apparaissent lorsque vos clients évaluent une location terminée." />
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li key={r.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">{r.client.firstName} {r.client.lastName.slice(0, 1)}. <span className="font-normal text-muted">sur</span> <Link href={`/produits/${r.product.slug}`} className="text-royal-ink hover:underline">{r.product.name}</Link></p>
                    <p className="text-xs text-muted">{formatDate(r.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.status === "HIDDEN" && <Badge tone="danger">Masqué par la modération</Badge>}
                    <Stars value={(r.productRating + r.lenderRating + r.experienceRating) / 3} />
                  </div>
                </div>
                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
                  <div>Produit {r.productRating}/5</div>
                  <div>Loueur {r.lenderRating}/5</div>
                  <div>Expérience {r.experienceRating}/5</div>
                </dl>
                {r.comment && <p className="mt-3 text-[15px] text-ink/90">{r.comment}</p>}
                {r.lenderReply ? (
                  <div className="mt-4 rounded-control bg-surface-2/60 p-3 text-sm">
                    <p className="font-medium text-ink">Votre réponse</p>
                    <p className="mt-1 text-ink/90">{r.lenderReply}</p>
                  </div>
                ) : (
                  canReply && r.status === "PUBLISHED" && (
                    <div className="mt-4">
                      <FormAction endpoint={`/api/reviews/${r.id}/reply`} label="Répondre" title="Répondre à l'avis" description="Votre réponse est publique." fields={[{ name: "reply", label: "Votre réponse", type: "textarea", required: true }]} submitLabel="Publier la réponse" success="Réponse publiée" />
                    </div>
                  )
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
