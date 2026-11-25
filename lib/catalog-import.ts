export const SHEET_NAME = "Articles";
export const MAX_IMPORT_ROWS = 200;
export const IMPORT_COLUMNS = [
  "Référence", "Nom", "Description", "Code catégorie", "Code ville",
  "Stock", "Prix par jour (FCFA)", "Valeur de remplacement (FCFA)",
] as const;

export type ImportPreview = {
  row: number;
  reference: string;
  name: string;
  status: "ready" | "error" | "existing";
  message?: string;
};
