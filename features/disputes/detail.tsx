import type { ReactNode } from "react";
import { formatFcfa } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { DISPUTE_STATUS } from "@/lib/labels";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";
import { Notice } from "@/components/ui/states";
import { Paperclip } from "./paperclip";
import { DisputeMessageForm } from "./message-form";
import type { getDisputeForActor } from "@/services/disputes";

type Dispute = Awaited<ReturnType<typeof getDisputeForActor>>;

const ROLE = { CLIENT: "Client", LENDER: "Loueur", ADMIN: "LOC'CONNECT" } as const;

/** Litige : résumé, fil de messages, pièces jointes et décision. Les actions propres à chaque rôle sont passées en `actions`. */
export function DisputeDetail({ dispute, actions }: { dispute: Dispute; actions?: ReactNode }) {
  const closed = ["RESOLVED", "REJECTED", "CLOSED"].includes(dispute.status);
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <Card>
          <CardHeader title={`Messages`} description="Les échanges et pièces jointes sont visibles par le client, le loueur concerné et l'administration." />
          <ul className="space-y-5 p-5">
            {dispute.messages.map((m) => (
              <li key={m.id} className="flex gap-3">
                <Avatar name={`${m.author.firstName} ${m.author.lastName}`} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm"><span className="font-medium text-ink">{m.author.firstName} {m.author.lastName}</span> <Badge>{ROLE[m.author.accountType]}</Badge> <span className="text-xs text-muted">{formatDateTime(m.createdAt)}</span></p>
                  <p className="mt-1 whitespace-pre-line text-[15px] text-ink/90">{m.message}</p>
                  {m.attachments.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{m.attachments.map((a) => <Paperclip key={a.id} href={`/api/files/${a.storageKey}`} name={a.fileName} />)}</div>}
                </div>
              </li>
            ))}
          </ul>
          {!closed && (
            <div className="border-t border-line p-5">
              <DisputeMessageForm disputeId={dispute.id} />
            </div>
          )}
        </Card>
        {dispute.decision && (
          <Notice tone={dispute.status === "RESOLVED" ? "success" : "info"} title="Décision de LOC'CONNECT">
            <p>{dispute.decision}</p>
            {dispute.resolutionAmount != null && <p className="mt-1 font-medium">Montant retenu ou remboursé : {formatFcfa(dispute.resolutionAmount)}</p>}
          </Notice>
        )}
      </div>
      <aside className="space-y-6">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-ink">Litige</h2>
            <StatusBadge entry={DISPUTE_STATUS[dispute.status]} />
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div><dt className="text-xs uppercase tracking-wide text-muted">Référence</dt><dd className="font-mono text-ink">{dispute.reference}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted">Réservation</dt><dd className="font-mono text-ink">{dispute.reservation.reference}</dd></div>
            {dispute.lender && <div><dt className="text-xs uppercase tracking-wide text-muted">Loueur visé</dt><dd className="text-ink">{dispute.lender.companyName}</dd></div>}
            {dispute.item && <div><dt className="text-xs uppercase tracking-wide text-muted">Article</dt><dd className="text-ink">{dispute.item.productName}</dd></div>}
            <div><dt className="text-xs uppercase tracking-wide text-muted">Motif</dt><dd className="text-ink">{dispute.reason}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted">Montant contesté</dt><dd className="tabular-nums text-ink">{formatFcfa(dispute.disputedAmount)}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted">Ouvert le</dt><dd className="text-ink">{formatDateTime(dispute.createdAt)}</dd></div>
          </dl>
          {dispute.item?.returnReport && ["CONTESTED", "SUBMITTED"].includes(dispute.item.returnReport.status) && (
            <p className="mt-4 rounded-control bg-warn-soft px-3 py-2 text-sm text-ink">Constat de retour contesté : caution gelée ({formatFcfa(dispute.item.returnReport.withheldAmount)} en jeu) jusqu&apos;à résolution.</p>
          )}
        </Card>
        {actions}
      </aside>
    </div>
  );
}
