"use client";

import { useState } from "react";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { PAYMENT_MODE } from "@/lib/labels";
import { cn } from "@/lib/cn";

type Mode = "ONLINE_FULL" | "DEPOSIT_CASH";

/** Choix du loueur : tout en ligne, ou acompte en ligne et solde en espèces (si l'administration l'a ouvert). */
export function PaymentModeForm({ mode, allowed, globallyEnabled, minDeposit, canEdit }: { mode: Mode; allowed: boolean; globallyEnabled: boolean; minDeposit: string; canEdit: boolean }) {
  const { run, pending } = useAction();
  const [value, setValue] = useState<Mode>(mode);
  const cashAvailable = allowed && globallyEnabled;

  return (
    <Card className="mt-6">
      <CardHeader title="Mode de paiement de vos clients" description="S'applique aux nouvelles réservations. Les réservations en cours gardent le mode choisi au moment de la commande." />
      <div className="flex flex-col gap-4 p-5">
        <div className="grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="Mode de paiement">
          {(["ONLINE_FULL", "DEPOSIT_CASH"] as const).map((m) => {
            const disabled = !canEdit || (m === "DEPOSIT_CASH" && !cashAvailable);
            return (
              <label key={m} className={cn("flex cursor-pointer gap-3 rounded-card border p-4 transition", value === m ? "border-royal bg-royal-soft" : "border-line hover:bg-surface-2", disabled && "cursor-not-allowed opacity-60")}>
                <input type="radio" name="paymentMode" value={m} checked={value === m} disabled={disabled} onChange={() => setValue(m)} className="mt-1 size-4 accent-[var(--lc-royal)]" />
                <span>
                  <span className="block text-sm font-semibold text-ink">{PAYMENT_MODE[m].label}</span>
                  <span className="mt-1 block text-sm text-muted">{PAYMENT_MODE[m].description}</span>
                  {m === "DEPOSIT_CASH" && <span className="mt-1 block text-xs text-muted">Acompte en ligne : la commission LOC&apos;CONNECT, au minimum {minDeposit} par article. La part au-delà de la commission vous est versée.</span>}
                </span>
              </label>
            );
          })}
        </div>
        {!cashAvailable && (
          <Notice tone="info">
            {globallyEnabled ? "Le paiement en espèces s'ouvre sur demande, après validation par LOC'CONNECT. Écrivez-nous depuis la page contact." : "Le paiement en espèces est momentanément désactivé sur la plateforme."}
          </Notice>
        )}
        {value === "DEPOSIT_CASH" && (
          <Notice tone="warning" title="Ce qui change pour vous">
            Vous encaissez le solde à la remise, puis vous saisissez le code de remise du client : sans ce code, le matériel ne peut pas être marqué remis ou livré. Si le client ne paie pas, gardez le matériel et signalez-le depuis la réservation. Vos clients voient « acompte + espèces » au lieu de « paiement 100 % protégé ».
          </Notice>
        )}
        {canEdit && (
          <div>
            <Button loading={pending} disabled={value === mode} onClick={() => run("/api/lenders/me/payment-mode", { method: "PUT", body: { paymentMode: value } }, { success: "Mode de paiement enregistré" })}>
              Enregistrer
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
