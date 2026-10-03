/** Les montants sont des entiers en FCFA (XOF). Aucun calcul monétaire en virgule flottante. */
const FCFA = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export const formatFcfa = (amount: number): string => `${FCFA.format(Math.round(amount)).replace(/ | /g, " ")} FCFA`;

/** Applique un taux en points de base (1000 = 10 %), arrondi à l'entier le plus proche. */
export function applyBps(amount: number, bps: number): number {
  return Math.round((amount * bps) / 10_000);
}

/** Part proportionnelle d'un montant (ratio entier a/b), arrondie. */
export function prorate(amount: number, part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((amount * part) / whole);
}

export const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);
