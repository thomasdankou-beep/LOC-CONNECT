import bcrypt from "bcryptjs";
import { AppError } from "../errors";

const COST = 11;

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, COST);
export const verifyPassword = (plain: string, hash: string): Promise<boolean> => bcrypt.compare(plain, hash);

let dummy: Promise<string> | null = null;

/** Hash factice pour égaliser le temps de réponse quand l'e-mail n'existe pas (anti-énumération). */
export const dummyHash = (): Promise<string> => (dummy ??= bcrypt.hash("dummy-password-for-timing", COST));

export function assertPasswordStrength(password: string): void {
  if (password.length < 8) throw new AppError("VALIDATION_ERROR", "Le mot de passe doit contenir au moins 8 caractères.");
  if (password.length > 128) throw new AppError("VALIDATION_ERROR", "Le mot de passe est trop long.");
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new AppError("VALIDATION_ERROR", "Le mot de passe doit contenir au moins une lettre et un chiffre.");
  }
}
