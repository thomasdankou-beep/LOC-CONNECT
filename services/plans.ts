import { z } from "zod";
import type { Lender, SubscriptionPlan } from "@prisma/client";
import { db, transaction, type Tx } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { applyBps, formatFcfa, prorate, sum } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { getSettings, type Settings } from "@/lib/settings";
import { can, type Actor } from "@/lib/auth/actor";
import { addBalanceEntry } from "./finance";
import { issueSubscriptionInvoice } from "./invoices";
import { notifyLender } from "./notifications";

/**
 * Formules des loueurs : Découverte (gratuite, commission par défaut), Pro et Premium (prix mensuel, commission réduite).
 * Le prix d'une période est prélevé sur le solde du loueur (déduit de ses versements) et fait l'objet d'une facture d'abonnement.
 * Passer à une formule plus chère est immédiat (la part non utilisée de la période en cours est déduite) ;
 * passer à une formule moins chère prend effet à l'échéance.
 */

export const PLAN_ORDER: SubscriptionPlan[] = ["FREE", "PRO", "PREMIUM"];
export const PLAN_LABEL: Record<SubscriptionPlan, string> = { FREE: "Découverte", PRO: "Pro", PREMIUM: "Premium" };
export const PLAN_PERKS: Record<SubscriptionPlan, string[]> = {
  FREE: ["Tout le site, sans engagement", "Aucun frais fixe"],
  PRO: ["Commission réduite", "Badge « Loueur Pro » sur vos produits et votre page", "Vos produits remontent dans le catalogue"],
  PREMIUM: ["Commission la plus basse", "Badge « Loueur Premium »", "Vos produits en tête du catalogue", "Vos produits mis en avant en page d'accueil"],
};

export type PlanTerms = Record<SubscriptionPlan, { price: number; rateBps: number }>;

export function planTerms(settings: Pick<Settings, "commission.rate_bps" | "plan.pro_price" | "plan.pro_rate_bps" | "plan.premium_price" | "plan.premium_rate_bps">): PlanTerms {
  return {
    FREE: { price: 0, rateBps: settings["commission.rate_bps"] },
    PRO: { price: settings["plan.pro_price"], rateBps: settings["plan.pro_rate_bps"] },
    PREMIUM: { price: settings["plan.premium_price"], rateBps: settings["plan.premium_rate_bps"] },
  };
}

/** Taux de commission d'un loueur : celui de sa formule, ou son taux spécifique (offre de lancement) s'il est plus bas. */
export function commissionRateFor(lender: { commissionRateBps: number | null; plan: SubscriptionPlan }, settings: Parameters<typeof planTerms>[0]): number {
  const planRate = planTerms(settings)[lender.plan].rateBps;
  return lender.commissionRateBps != null ? Math.min(lender.commissionRateBps, planRate) : planRate;
}

/** Coût mensuel d'une formule pour un volume de location donné : prix fixe plus commission. */
export function monthlyCost(terms: PlanTerms, plan: SubscriptionPlan, volume: number): number {
  return terms[plan].price + applyBps(volume, terms[plan].rateBps);
}

const addMonths = (d: Date, n: number) => {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
};

/** Volume de location du loueur sur la plateforme ces 30 derniers jours (lignes payées, hors annulations). */
export async function lenderMonthlyVolume(lenderId: string, now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const r = await db.reservationItem.aggregate({ where: { lenderId, createdAt: { gte: since }, status: { notIn: ["DRAFT", "HOLD", "PENDING_PAYMENT", "CANCELLED", "REFUNDED"] } }, _sum: { subtotal: true } });
  return r._sum.subtotal ?? 0;
}

/** Simulation pour le loueur : coût de chaque formule sur son volume récent et formule la plus avantageuse. */
export async function simulatePlans(lenderId: string) {
  const [settings, lender, volume] = await Promise.all([getSettings(), db.lender.findUniqueOrThrow({ where: { id: lenderId } }), lenderMonthlyVolume(lenderId)]);
  const terms = planTerms(settings);
  const rows = PLAN_ORDER.map((plan) => {
    const rateBps = commissionRateFor({ commissionRateBps: lender.commissionRateBps, plan }, settings);
    return { plan, price: terms[plan].price, rateBps, cost: terms[plan].price + applyBps(volume, rateBps) };
  });
  const best = rows.reduce((a, b) => (b.cost < a.cost ? b : a));
  const current = rows.find((r) => r.plan === lender.plan)!;
  return { volume, rows, best: best.plan, current: lender.plan, saving: Math.max(0, current.cost - best.cost) };
}

/** Prélève le prix d'une période : écriture négative sur le solde (déduite du prochain versement) et facture d'abonnement. */
async function chargePeriod(tx: Tx, lender: Pick<Lender, "id">, sub: { id: string; plan: SubscriptionPlan; startsAt: Date; endsAt: Date | null; price: number }, fee: number, detail: string) {
  if (fee <= 0) return null;
  await addBalanceEntry(tx, { lenderId: lender.id, kind: "SUBSCRIPTION_FEE", amount: -fee, availableAt: new Date(), note: `Formule ${PLAN_LABEL[sub.plan]} : ${detail}` });
  return issueSubscriptionInvoice(tx, { subscriptionId: sub.id, lenderId: lender.id, plan: PLAN_LABEL[sub.plan], monthlyPrice: sub.price, amount: fee, periodStart: sub.startsAt, periodEnd: sub.endsAt!, detail });
}

/** Ouvre une nouvelle période d'une formule payante, facturée immédiatement. */
async function openPeriod(tx: Tx, lenderId: string, plan: SubscriptionPlan, opts: { settings: Settings; start: Date; months?: number; fee: number; detail: string; note?: string; actorId?: string | null }) {
  const terms = planTerms(opts.settings);
  const endsAt = addMonths(opts.start, opts.months ?? 1);
  const sub = await tx.subscription.create({ data: { lenderId, plan, price: terms[plan].price, rateBps: terms[plan].rateBps, periodFee: opts.fee, startsAt: opts.start, endsAt, note: opts.note } });
  await tx.lender.update({ where: { id: lenderId }, data: { plan, planRenewsAt: endsAt, nextPlan: null } });
  await chargePeriod(tx, { id: lenderId }, sub, opts.fee, opts.detail);
  return sub;
}

async function closeActive(tx: Tx, lenderId: string, status: "CANCELLED" | "EXPIRED", at: Date) {
  const active = await tx.subscription.findFirst({ where: { lenderId, status: "ACTIVE" }, orderBy: { startsAt: "desc" } });
  await tx.subscription.updateMany({ where: { lenderId, status: "ACTIVE" }, data: { status, endsAt: at } });
  return active;
}

export type PlanQuote = { plan: SubscriptionPlan; immediate: boolean; feeNow: number; credit: number; firstMonthFree: boolean; effectiveAt: Date | null };

/** Ce que coûterait le passage à une formule maintenant (affiché avant confirmation, appliqué à l'identique). */
export async function quotePlanChange(client: Tx | typeof db, lenderId: string, plan: SubscriptionPlan, settings: Settings, now = new Date()): Promise<PlanQuote> {
  const lender = await client.lender.findUniqueOrThrow({ where: { id: lenderId } });
  const terms = planTerms(settings);
  const upgrade = PLAN_ORDER.indexOf(plan) > PLAN_ORDER.indexOf(lender.plan);
  if (!upgrade) return { plan, immediate: false, feeNow: 0, credit: 0, firstMonthFree: false, effectiveAt: lender.planRenewsAt };
  const active = await client.subscription.findFirst({ where: { lenderId, status: "ACTIVE" }, orderBy: { startsAt: "desc" } });
  let credit = 0;
  if (active && active.endsAt && active.periodFee > 0 && active.endsAt > now) {
    const total = active.endsAt.getTime() - active.startsAt.getTime();
    credit = prorate(active.periodFee, active.endsAt.getTime() - now.getTime(), total);
  }
  const paidBefore = await client.subscription.count({ where: { lenderId, plan: { not: "FREE" } } });
  const firstMonthFree = settings["plan.first_month_free"] && paidBefore === 0;
  const feeNow = firstMonthFree ? 0 : Math.max(0, terms[plan].price - credit);
  return { plan, immediate: true, feeNow, credit, firstMonthFree, effectiveAt: now };
}

export const choosePlanInput = z.object({ plan: z.enum(["FREE", "PRO", "PREMIUM"]) });

/** Le loueur change de formule. Plus chère : immédiat. Moins chère : à l'échéance. Même formule : annule un changement prévu. */
export async function choosePlan(actor: Actor, plan: SubscriptionPlan) {
  if (actor.accountType !== "LENDER" || !actor.lenderId) throw forbidden();
  if (!actor.isLenderOwner && !can(actor, "COMPANY_MANAGE")) throw forbidden("Seul le responsable de l'entreprise peut changer de formule.");
  if (actor.lenderStatus !== "APPROVED") throw forbidden("Votre entreprise doit être validée pour choisir une formule.");
  const settings = await getSettings();
  if (!settings["plan.self_service"]) throw forbidden("Les formules sont attribuées par LOC'CONNECT : contactez-nous pour en changer.");
  const lenderId = actor.lenderId;

  return transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "Lender" WHERE id = ${lenderId} FOR UPDATE`;
    const lender = await tx.lender.findUniqueOrThrow({ where: { id: lenderId } });
    const now = new Date();
    if (plan === lender.plan) {
      if (!lender.nextPlan) throw new AppError("CONFLICT", `Vous êtes déjà en formule ${PLAN_LABEL[plan]}.`);
      await tx.lender.update({ where: { id: lenderId }, data: { nextPlan: null } });
      await tx.subscription.updateMany({ where: { lenderId, status: "ACTIVE" }, data: { autoRenew: true } });
      await audit(tx, { userId: actor.userId, lenderId, action: "plan.keep", entity: "Lender", entityId: lenderId, newValue: { plan }, meta: actor.meta });
      return { plan, scheduled: null, feeNow: 0 };
    }
    const quote = await quotePlanChange(tx, lenderId, plan, settings, now);
    if (!quote.immediate) {
      // Formule moins chère : la période déjà payée va à son terme.
      await tx.lender.update({ where: { id: lenderId }, data: { nextPlan: plan } });
      await tx.subscription.updateMany({ where: { lenderId, status: "ACTIVE" }, data: { autoRenew: false } });
      await audit(tx, { userId: actor.userId, lenderId, action: "plan.schedule", entity: "Lender", entityId: lenderId, oldValue: { plan: lender.plan }, newValue: { nextPlan: plan, at: lender.planRenewsAt }, meta: actor.meta });
      await notifyLender(tx, lenderId, { type: "plan.scheduled", title: `Passage en formule ${PLAN_LABEL[plan]} prévu`, body: `Il prendra effet le ${lender.planRenewsAt ? formatDate(lender.planRenewsAt) : "prochain renouvellement"}. Votre formule ${PLAN_LABEL[lender.plan]} reste active jusque-là.`, link: "/loueur/abonnement" }, "COMPANY_MANAGE");
      return { plan: lender.plan, scheduled: plan, feeNow: 0 };
    }
    await closeActive(tx, lenderId, "CANCELLED", now);
    const detail = quote.firstMonthFree ? "premier mois offert" : quote.credit > 0 ? `${formatFcfa(quote.credit)} déduits pour la période non utilisée de la formule précédente` : "période d'un mois";
    await openPeriod(tx, lenderId, plan, { settings, start: now, fee: quote.feeNow, detail, note: quote.firstMonthFree ? "Premier mois offert" : undefined });
    await audit(tx, { userId: actor.userId, lenderId, action: "plan.change", entity: "Lender", entityId: lenderId, oldValue: { plan: lender.plan }, newValue: { plan, feeNow: quote.feeNow, credit: quote.credit }, meta: actor.meta });
    await notifyLender(tx, lenderId, { type: "plan.changed", title: `Formule ${PLAN_LABEL[plan]} activée`, body: quote.feeNow > 0 ? `${formatFcfa(quote.feeNow)} seront déduits de votre prochain versement.` : quote.firstMonthFree ? "Votre premier mois est offert." : "Aucun montant à régler pour cette période.", link: "/loueur/abonnement" }, "COMPANY_MANAGE");
    return { plan, scheduled: null, feeNow: quote.feeNow };
  });
}

export const adminPlanInput = z.object({
  lenderId: z.string().min(1),
  plan: z.enum(["FREE", "PRO", "PREMIUM"]),
  months: z.number().int().min(1).max(36).default(1),
  /** Montant facturé pour toute la durée (0 = offert). Par défaut : prix mensuel x durée. */
  amount: z.number().int().min(0).optional(),
  note: z.string().trim().max(200).optional(),
});

/** L'administration attribue une formule (accord commercial, geste, régularisation). Effet immédiat. */
export async function adminSetPlan(actor: Actor, input: z.infer<typeof adminPlanInput>) {
  if (actor.accountType !== "ADMIN" || !can(actor, "ADMIN_SUBSCRIPTIONS")) throw forbidden();
  const settings = await getSettings();
  return transaction(async (tx) => {
    const lender = await tx.lender.findUnique({ where: { id: input.lenderId } });
    if (!lender) throw notFound("Loueur");
    const now = new Date();
    await closeActive(tx, lender.id, "CANCELLED", now);
    let sub;
    if (input.plan === "FREE") {
      sub = await tx.subscription.create({ data: { lenderId: lender.id, plan: "FREE", price: 0, rateBps: settings["commission.rate_bps"], startsAt: now, note: input.note } });
      await tx.lender.update({ where: { id: lender.id }, data: { plan: "FREE", planRenewsAt: null, nextPlan: null } });
    } else {
      const amount = input.amount ?? planTerms(settings)[input.plan].price * input.months;
      sub = await openPeriod(tx, lender.id, input.plan, { settings, start: now, months: input.months, fee: amount, detail: `${input.months} mois attribués par LOC'CONNECT${amount === 0 ? ", offerts" : ""}`, note: input.note, actorId: actor.userId });
    }
    await audit(tx, { userId: actor.userId, lenderId: lender.id, action: "plan.admin_set", entity: "Lender", entityId: lender.id, oldValue: { plan: lender.plan }, newValue: input, meta: actor.meta });
    await notifyLender(tx, lender.id, { type: "plan.changed", title: `Formule ${PLAN_LABEL[input.plan]} activée`, body: "LOC'CONNECT a mis à jour votre formule.", link: "/loueur/abonnement" }, "COMPANY_MANAGE");
    return sub;
  });
}

/**
 * Échéances : renouvelle les périodes arrivées à terme (au prix en vigueur), applique les changements prévus,
 * et repasse en Découverte un loueur suspendu. Appelée par la maintenance.
 */
export async function renewPlans(now = new Date()) {
  const due = await db.lender.findMany({ where: { plan: { not: "FREE" }, planRenewsAt: { lte: now } }, select: { id: true } });
  let renewed = 0;
  let downgraded = 0;
  for (const { id } of due) {
    await transaction(async (tx) => {
      const lender = await tx.lender.findUniqueOrThrow({ where: { id } });
      if (lender.plan === "FREE" || !lender.planRenewsAt || lender.planRenewsAt > now) return;
      const settings = await getSettings(tx);
      const target: SubscriptionPlan = lender.status === "SUSPENDED" ? "FREE" : (lender.nextPlan ?? lender.plan);
      const start = lender.planRenewsAt;
      await closeActive(tx, id, "EXPIRED", start);
      if (target === "FREE") {
        await tx.subscription.create({ data: { lenderId: id, plan: "FREE", price: 0, rateBps: settings["commission.rate_bps"], startsAt: start } });
        await tx.lender.update({ where: { id }, data: { plan: "FREE", planRenewsAt: null, nextPlan: null } });
        await notifyLender(tx, id, { type: "plan.changed", title: "Formule Découverte", body: "Votre formule payante est arrivée à échéance : vous êtes en formule Découverte.", link: "/loueur/abonnement" }, "COMPANY_MANAGE");
        downgraded++;
        return;
      }
      const price = planTerms(settings)[target].price;
      await openPeriod(tx, id, target, { settings, start, fee: price, detail: "renouvellement mensuel" });
      await notifyLender(tx, id, { type: "plan.renewed", title: `Formule ${PLAN_LABEL[target]} renouvelée`, body: `${formatFcfa(price)} seront déduits de votre prochain versement.`, link: "/loueur/abonnement" }, "COMPANY_MANAGE");
      renewed++;
    });
  }
  return { renewed, downgraded };
}

export async function lenderSubscriptions(lenderId: string) {
  return db.subscription.findMany({ where: { lenderId }, orderBy: { startsAt: "desc" }, take: 24 });
}

export const totalFees = (rows: { periodFee: number }[]) => sum(rows.map((r) => r.periodFee));
