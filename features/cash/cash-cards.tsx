import type { CashSettlementStatus } from "@prisma/client";
import { formatFcfa } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { CASH_STATUS } from "@/lib/labels";
import { StatusBadge } from "@/components/ui/badge";
import { FormAction } from "@/components/ui/action";
import { HandCoins, LockKey } from "@/components/ui/icons";

export type CashView = {
  id: string;
  lenderId: string;
  amountDue: number;
  deliveryDue: number;
  status: CashSettlementStatus;
  failedAttempts: number;
  confirmedAt: Date | null;
  reportedAt: Date | null;
  note: string | null;
  code?: string | boolean | null;
  lender: { companyName: string };
};

const codeOf = (c: CashView) => (typeof c.code === "string" ? c.code : null);

/** Côté client : montant à remettre en espèces au loueur et code de remise à donner une fois le solde payé. */
export function ClientCashBox({ cash, paid }: { cash: CashView; paid: boolean }) {
  const code = codeOf(cash);
  return (
    <div className="border-t border-line bg-warn-soft/40 px-5 py-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-medium text-ink"><HandCoins size={18} className="text-royal-ink" /> À régler en espèces à {cash.lender.companyName} : <span className="tabular-nums">{formatFcfa(cash.amountDue)}</span></p>
        <StatusBadge entry={CASH_STATUS[cash.status]} />
      </div>
      {cash.deliveryDue > 0 && <p className="mt-1 text-muted">dont livraison {formatFcfa(cash.deliveryDue)}</p>}
      {cash.status === "PENDING" && paid && code && (
        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-control border border-line bg-surface px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Votre code de remise</p>
            <p className="font-mono text-3xl font-semibold tracking-[0.3em] text-ink">{code}</p>
          </div>
          <p className="min-w-0 flex-1 text-muted">Donnez ce code au loueur <strong className="text-ink">seulement après</strong> lui avoir payé le solde et reçu le matériel. Il le saisit pour confirmer votre paiement : vous recevez alors un reçu.</p>
        </div>
      )}
      {cash.status === "PENDING" && !paid && <p className="mt-1 text-muted">Votre code de remise s&apos;affichera ici une fois le paiement en ligne confirmé.</p>}
      {cash.status === "PAID" && cash.confirmedAt && <p className="mt-1 text-muted">Paiement confirmé par le loueur le {formatDateTime(cash.confirmedAt)}.</p>}
      {cash.status === "UNPAID" && <p className="mt-1 text-danger">Le loueur a signalé un solde non payé{cash.note ? ` : ${cash.note}` : ""}. Si c&apos;est une erreur, contactez le support.</p>}
    </div>
  );
}

/** Côté loueur : solde à encaisser, saisie du code de remise, signalement d'un impayé. Le code n'est jamais affiché au loueur. */
export function LenderCashBox({ cash, reservationId, canAct, canReportUnpaid }: { cash: CashView; reservationId: string; canAct: boolean; canReportUnpaid: boolean }) {
  return (
    <div className="rounded-card border border-line bg-surface p-5 text-sm shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-base font-semibold text-ink"><HandCoins size={20} className="text-royal-ink" /> Solde à encaisser en espèces</p>
        <StatusBadge entry={CASH_STATUS[cash.status]} />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{formatFcfa(cash.amountDue)}</p>
      {cash.deliveryDue > 0 && <p className="text-muted">dont livraison {formatFcfa(cash.deliveryDue)}</p>}
      {cash.status === "PENDING" && (
        <>
          <p className="mt-2 text-muted">À la remise, encaissez ce montant puis demandez au client son code de remise à 4 chiffres. Sans ce code, le matériel ne peut pas être marqué comme remis ou livré.</p>
          {cash.failedAttempts > 0 && <p className="mt-1 text-warn">{cash.failedAttempts} code{cash.failedAttempts > 1 ? "s" : ""} erroné{cash.failedAttempts > 1 ? "s" : ""} saisi{cash.failedAttempts > 1 ? "s" : ""}.</p>}
          {canAct && (
            <div className="mt-3 flex flex-wrap gap-2">
              <FormAction
                endpoint={`/api/reservations/${reservationId}/cash`}
                label="Confirmer l'encaissement"
                variant="primary"
                icon={<LockKey size={16} />}
                title="Confirmer l'encaissement"
                description={`Vous avez reçu ${formatFcfa(cash.amountDue)} en espèces ? Saisissez le code de remise donné par le client.`}
                fields={[{ name: "code", label: "Code de remise", required: true, placeholder: "4 chiffres" }]}
                submitLabel="Confirmer"
                success="Encaissement confirmé, reçu envoyé au client"
              />
              {canReportUnpaid && <FormAction
                endpoint={`/api/reservations/${reservationId}/cash/unpaid`}
                label="Le client n'a pas payé"
                variant="secondary"
                title="Signaler un solde non payé"
                description="Gardez votre matériel. Vos lignes seront annulées, la caution sera restituée au client et l'acompte payé en ligne ne lui sera pas remboursé. L'administration est prévenue."
                fields={[{ name: "reason", label: "Que s'est-il passé ?", type: "textarea", required: true, placeholder: "Ex. : client absent au rendez-vous, refus de payer le solde" }]}
                submitLabel="Signaler"
                success="Signalement enregistré"
              />}
            </div>
          )}
        </>
      )}
      {cash.status === "PAID" && cash.confirmedAt && <p className="mt-2 text-muted">Encaissement confirmé le {formatDateTime(cash.confirmedAt)}.</p>}
      {cash.status === "UNPAID" && <p className="mt-2 text-muted">Signalé impayé{cash.reportedAt ? ` le ${formatDateTime(cash.reportedAt)}` : ""}{cash.note ? ` : ${cash.note}` : ""}.</p>}
    </div>
  );
}

/** Côté administration : état du solde et actions de support. */
export function AdminCashActions({ cash }: { cash: Pick<CashView, "id" | "status" | "failedAttempts"> }) {
  if (cash.status !== "PENDING") return null;
  return (
    <FormAction
      endpoint={`/api/admin/cash/${cash.id}`}
      label="Support"
      title="Solde en espèces : action du support"
      description="Débloquez la saisie du code après trop d'essais, ou constatez un paiement confirmé par le client et le loueur."
      fields={[
        { name: "action", label: "Action", type: "select", required: true, defaultValue: cash.failedAttempts > 0 ? "UNLOCK" : "MARK_PAID", options: [{ value: "UNLOCK", label: "Débloquer la saisie du code" }, { value: "MARK_PAID", label: "Constater le paiement en espèces" }] },
        { name: "note", label: "Justification", type: "textarea", required: true, placeholder: "Ex. : vérifié par téléphone avec le client" },
      ]}
      submitLabel="Valider"
      success="Solde mis à jour"
    />
  );
}
