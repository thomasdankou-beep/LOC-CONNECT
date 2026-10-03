import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/auth/actor";
import { formatDate } from "@/lib/dates";
import { listClientReviews } from "@/services/reviews";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { Stars } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { Star } from "@/components/ui/icons";
import { ReviewButton } from "@/features/reservations/client-actions";

export const metadata: Metadata = { title: "Mes avis", robots: { index: false } };

export default async function Page() {
  const actor = await requireClient();
  const [reviews, toReview] = await Promise.all([
    listClientReviews(actor.userId),
    db.reservationItem.findMany({ where: { reservation: { clientId: actor.userId }, status: "COMPLETED", review: null }, include: { lender: { select: { companyName: true } } }, orderBy: { endDate: "desc" } }),
  ]);
  return (
    <>
      <PageHeader title="Mes avis" description="Donnez votre avis sur le produit, le loueur et votre expérience après chaque location terminée." />
      {toReview.length > 0 && (
        <Card className="mb-6">
          <CardHeader title="Locations à noter" description={`${toReview.length} en attente`} />
          <ul className="divide-y divide-line">
            {toReview.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div><p className="font-medium text-ink">{i.productName}</p><p className="text-sm text-muted">{i.lender.companyName} · terminée le {formatDate(i.endDate)}</p></div>
                <ReviewButton itemId={i.id} productName={i.productName} />
              </li>
            ))}
          </ul>
        </Card>
      )}
      {reviews.length === 0 ? (
        <EmptyState icon={<Star size={24} />} title="Aucun avis publié" description="Vos avis apparaîtront ici une fois publiés." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-card border border-line bg-surface p-5 shadow-card">
              <div className="flex items-center justify-between gap-2"><p className="font-medium text-ink">{r.product.name}</p>{r.status !== "PUBLISHED" && <Badge tone="warning">{r.status === "PENDING" ? "En modération" : "Masqué"}</Badge>}</div>
              <p className="text-sm text-muted">{r.lender.companyName} · {formatDate(r.createdAt)}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 text-sm text-muted"><span>Produit <Stars value={r.productRating} /></span><span>Loueur <Stars value={r.lenderRating} /></span><span>Expérience <Stars value={r.experienceRating} /></span></div>
              {r.comment && <p className="mt-2 text-[15px] text-ink/90">{r.comment}</p>}
              {r.lenderReply && <p className="mt-3 rounded-control bg-surface-2 p-3 text-sm"><span className="font-medium text-ink">Réponse du loueur : </span>{r.lenderReply}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
