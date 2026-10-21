import { db, transaction } from "@/lib/db";
import { audit } from "@/lib/audit";
import { todayUTC } from "@/lib/dates";
import { deliverPending, notifyUsers } from "./notifications";
import { expireHolds } from "./holds";
import { escalateAndExpireModifications } from "./modifications";
import { settleExpiredReports } from "./returns";
import { transitionItems } from "./reservations";
import { renewPlans } from "./plans";

let lastRun = 0;

/**
 * Tâches périodiques : expiration des HOLD, avancement automatique des lignes (livré, puis en cours, puis retour attendu),
 * règlement des constats non contestés, escalade des modifications. Appelée par /api/cron/maintenance et, de façon opportuniste
 * (au plus une fois toutes les 30 s), par les pages tableau de bord.
 */
export async function runMaintenance(now = new Date()) {
  const today = todayUTC(now);
  const expired = await expireHolds(now);

  // Une location livrée ou remise passe en cours dès son premier jour, puis attend son retour après sa date de fin.
  let started = 0;
  let dueBack = 0;
  const toStart = await db.reservationItem.findMany({ where: { status: "DELIVERED", startDate: { lte: today } }, select: { id: true, reservationId: true } });
  for (const item of toStart) {
    await transaction(async (tx) => {
      await transitionItems(tx, item.reservationId, "IN_USE", { itemIds: [item.id], onlyFrom: ["DELIVERED"], note: "Début de la location" });
    });
    started++;
  }
  const late = await db.reservationItem.findMany({ where: { status: "IN_USE", endDate: { lt: today } }, include: { reservation: { select: { clientId: true, reference: true } } } });
  for (const item of late) {
    await transaction(async (tx) => {
      await transitionItems(tx, item.reservationId, "RETURN_PENDING", { itemIds: [item.id], onlyFrom: ["IN_USE"], note: "Date de retour atteinte" });
      await notifyUsers(tx, [item.reservation.clientId], { type: "return.due", title: `Retour attendu : ${item.productName}`, body: "La date de fin de location est passée. Merci de restituer le matériel.", link: `/mes-reservations/${item.reservationId}` });
    });
    dueBack++;
  }

  const settled = await settleExpiredReports(now);
  const modifications = await escalateAndExpireModifications(now);
  const plans = await renewPlans(now);
  const emails = await deliverPending();
  const result = { expiredHolds: expired, started, dueBack, settledReturns: settled, escalated: modifications.escalated, expiredModifications: modifications.expired, plansRenewed: plans.renewed, plansDowngraded: plans.downgraded, emails };
  if (Object.values(result).some((n) => n > 0)) await audit(db, { action: "maintenance.run", entity: "System", newValue: result });
  lastRun = Date.now();
  return result;
}

/** Exécution opportuniste, limitée dans le temps, sans bloquer la requête appelante en cas d'erreur. */
export async function maybeRunMaintenance(): Promise<void> {
  if (Date.now() - lastRun < 30_000) return;
  lastRun = Date.now();
  try {
    await runMaintenance();
  } catch (e) {
    console.error("[maintenance]", e);
  }
}
