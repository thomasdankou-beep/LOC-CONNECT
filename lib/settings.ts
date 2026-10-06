import { db, type DbOrTx } from "./db";

export type SettingType = "int" | "bool" | "string" | "enum";

type Def = {
  default: number | boolean | string;
  type: SettingType;
  group: string;
  label: string;
  description: string;
  options?: string[];
};

/** Paramètres commerciaux configurables depuis l'administration. Rien de ceci n'est codé en dur dans la logique métier. */
export const SETTING_DEFS = {
  "commission.rate_bps": { default: 1000, type: "int", group: "Finance", label: "Taux de commission (points de base)", description: "1000 = 10 %. Appliqué sur le sous-total de location de chaque ligne et figé à la réservation." },
  "commission.on_delivery": { default: false, type: "bool", group: "Finance", label: "Commission sur la livraison", description: "Si activé, les frais de livraison entrent dans la base de calcul de la commission." },
  "commission.refund_policy": { default: "PROPORTIONAL", type: "enum", options: ["PROPORTIONAL", "NON_REFUNDABLE"], group: "Finance", label: "Commission en cas de remboursement", description: "PROPORTIONAL : la commission est remboursée au prorata. NON_REFUNDABLE : LOC'CONNECT conserve sa commission." },
  "cash.enabled": { default: true, type: "bool", group: "Paiement en espèces", label: "Mode acompte + espèces", description: "Si activé, les loueurs autorisés par l'administration peuvent faire payer en ligne un acompte (la commission) et encaisser le solde en espèces à la remise." },
  "cash.min_deposit": { default: 1000, type: "int", group: "Paiement en espèces", label: "Acompte minimum en ligne (FCFA)", description: "Montant minimum payé en ligne par ligne de location chez un loueur en mode espèces, même si la commission est plus faible. La part au-delà de la commission revient au loueur." },
  "cash.max_code_attempts": { default: 5, type: "int", group: "Paiement en espèces", label: "Essais de code de remise", description: "Nombre de codes erronés tolérés avant blocage ; le support doit alors débloquer l'encaissement." },
  "payout.freeze_hours": { default: 72, type: "int", group: "Finance", label: "Délai de gel du versement (heures)", description: "Délai après la fin de location avant qu'un montant devienne versable au loueur." },
  "hold.duration_minutes": { default: 15, type: "int", group: "HOLD", label: "Durée d'un HOLD (minutes)", description: "Durée de blocage temporaire du stock pendant le paiement." },
  "hold.payment_grace_minutes": { default: 10, type: "int", group: "HOLD", label: "Délai de grâce après lancement du paiement (minutes)", description: "Prolongation unique du HOLD quand un paiement est en cours." },
  "hold.max_per_product": { default: 1, type: "int", group: "HOLD", label: "HOLD actifs max par produit et par client", description: "Limite anti-abus." },
  "hold.max_total": { default: 3, type: "int", group: "HOLD", label: "HOLD actifs max par client", description: "Limite anti-abus sur le nombre total de HOLD simultanés." },
  "hold.degraded_duration_minutes": { default: 5, type: "int", group: "HOLD", label: "Durée d'un HOLD dégradé (minutes)", description: "Durée accordée aux clients dont le taux de HOLD non convertis est élevé." },
  "hold.nonconversion_threshold_pct": { default: 60, type: "int", group: "HOLD", label: "Seuil de HOLD non convertis (%)", description: "Au-delà, la durée du HOLD du client est réduite." },
  "deposit.mode": { default: "PERCENT_OF_RENTAL", type: "enum", options: ["PERCENT_OF_RENTAL", "FIXED_PER_PRODUCT"], group: "Retour et caution", label: "Calcul de la caution", description: "PERCENT_OF_RENTAL : la caution est un pourcentage du montant de la location de chaque loueur. FIXED_PER_PRODUCT : chaque loueur fixe une caution par unité sur ses produits. Le mode est figé sur chaque réservation." },
  "deposit.percent": { default: 30, type: "int", group: "Retour et caution", label: "Caution en % de la location", description: "Utilisé quand la caution est calculée en pourcentage : 30 = 30 % du montant de la location des articles de chaque loueur (entre 0 et 100)." },
  "return.contest_window_hours": { default: 48, type: "int", group: "Retour et caution", label: "Fenêtre de contestation d'un constat (heures)", description: "Après un constat avec retenue, le client peut contester pendant ce délai." },
  "return.evidence_required": { default: true, type: "bool", group: "Retour et caution", label: "Photos obligatoires pour une retenue", description: "Une retenue de caution exige au moins une photo de preuve." },
  "deposit.release_deadline_days": { default: 7, type: "int", group: "Retour et caution", label: "Date limite de libération de la caution (jours après la fin)", description: "Délai maximal pour traiter le retour et libérer ou retenir la caution." },
  "deposit.extra_billing_default": { default: true, type: "bool", group: "Retour et caution", label: "Facturation complémentaire par défaut", description: "Valeur par défaut de autorise_facturation_complementaire pour les nouveaux produits." },
  "modification.free_deadline_hours": { default: 24, type: "int", group: "Modification", label: "Délai de modification libre (heures avant le début)", description: "Au-delà de ce délai avant le début de la location, aucune modification n'est possible." },
  "modification.lender_response_hours": { default: 2, type: "int", group: "Modification", label: "Délai de réponse du loueur (heures)", description: "Passé ce délai, la demande est escaladée à l'administration." },
  "modification.request_validity_hours": { default: 48, type: "int", group: "Modification", label: "Validité d'une demande (heures)", description: "Une demande non traitée ou non payée expire passé ce délai." },
  "booking.max_days": { default: 90, type: "int", group: "Réservation", label: "Durée maximale d'une location (jours)", description: "Plafond appliqué à toutes les lignes." },
  "booking.min_lead_hours": { default: 0, type: "int", group: "Réservation", label: "Délai minimal avant le début (heures)", description: "Délai minimal entre la réservation et le début de la location." },
  "reservation.lender_must_accept": { default: false, type: "bool", group: "Réservation", label: "Acceptation manuelle par le loueur", description: "Si activé, une réservation payée attend la confirmation du loueur. Sinon elle est confirmée automatiquement." },
  "moderation.products_require_review": { default: true, type: "bool", group: "Modération", label: "Validation des produits avant publication", description: "Les produits soumis par les loueurs passent par la modération." },
  "moderation.reviews_require_approval": { default: false, type: "bool", group: "Modération", label: "Validation des avis avant publication", description: "Si activé, un avis attend la modération pour apparaître." },
  "ratelimit.hold_per_minute": { default: 10, type: "int", group: "Sécurité", label: "Limite de création de HOLD par minute", description: "Rate limiting dédié à POST /api/holds." },
  "ratelimit.login_per_15min": { default: 10, type: "int", group: "Sécurité", label: "Tentatives de connexion par 15 minutes (par IP)", description: "Au-delà, les connexions sont refusées temporairement." },
  "ratelimit.api_per_minute": { default: 240, type: "int", group: "Sécurité", label: "Requêtes API par minute (par IP)", description: "Rate limiting général." },
  "security.max_failed_logins": { default: 5, type: "int", group: "Sécurité", label: "Échecs de connexion avant verrouillage", description: "Nombre d'échecs consécutifs avant verrouillage du compte." },
  "security.lockout_minutes": { default: 15, type: "int", group: "Sécurité", label: "Durée de verrouillage (minutes)", description: "Durée du verrouillage après trop d'échecs." },
  "site.support_phone": { default: "+225 27 20 00 00 00", type: "string", group: "Site", label: "Téléphone du support", description: "Affiché dans le pied de page et la page contact." },
  "site.support_email": { default: "support@locconnect.example", type: "string", group: "Site", label: "E-mail du support", description: "Affiché dans le pied de page et la page contact." },
} as const satisfies Record<string, Def>;

export type SettingKey = keyof typeof SETTING_DEFS;
export type Settings = { [K in SettingKey]: (typeof SETTING_DEFS)[K]["default"] extends boolean ? boolean : (typeof SETTING_DEFS)[K]["default"] extends number ? number : string };

/**
 * Cache partagé via globalThis : Next.js compile les routes API et les pages dans des bundles distincts, chacun avec sa propre
 * copie du module. Un cache local au module ne serait pas invalidé par une modification faite depuis une autre route.
 */
const shared = globalThis as unknown as { __lcSettingsCache?: { at: number; values: Settings } | null };
const TTL_MS = 10_000;

function defaults(): Settings {
  const out: Record<string, unknown> = {};
  for (const [k, def] of Object.entries(SETTING_DEFS)) out[k] = def.default;
  return out as Settings;
}

export function invalidateSettings(): void {
  shared.__lcSettingsCache = null;
}

export async function getSettings(client: DbOrTx = db): Promise<Settings> {
  const cache = shared.__lcSettingsCache;
  if (client === db && cache && Date.now() - cache.at < TTL_MS) return cache.values;
  const rows = await client.setting.findMany();
  const values = defaults() as unknown as Record<string, unknown>;
  for (const row of rows) {
    const def = SETTING_DEFS[row.key as SettingKey] as Def | undefined;
    if (def && typeof row.value === typeof def.default) values[row.key] = row.value;
  }
  const typed = values as unknown as Settings;
  if (client === db) shared.__lcSettingsCache = { at: Date.now(), values: typed };
  return typed;
}

export function validateSettingValue(key: string, value: unknown): number | boolean | string {
  const def = (SETTING_DEFS as Record<string, Def>)[key];
  if (!def) throw new Error(`Paramètre inconnu: ${key}`);
  if (def.type === "int") {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) throw new Error(`${def.label} : entier positif attendu.`);
    if (key === "deposit.percent" && n > 100) throw new Error(`${def.label} : entre 0 et 100.`);
    return n;
  }
  if (def.type === "bool") {
    if (typeof value !== "boolean") throw new Error(`${def.label} : booléen attendu.`);
    return value;
  }
  if (def.type === "enum") {
    if (typeof value !== "string" || !def.options?.includes(value)) throw new Error(`${def.label} : valeur non autorisée.`);
    return value;
  }
  if (typeof value !== "string" || value.length > 200) throw new Error(`${def.label} : texte attendu.`);
  return value;
}
