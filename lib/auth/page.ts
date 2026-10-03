import { redirect } from "next/navigation";
import { getActor, can, type Actor } from "./actor";

/** Gardes pour les pages serveur : redirigent au lieu de lever une erreur API. */
export async function pageActor(next?: string): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect(`/connexion${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return actor;
}

export async function pageClient(next?: string): Promise<Actor> {
  const actor = await pageActor(next);
  if (actor.accountType === "LENDER") redirect("/loueur/dashboard");
  if (actor.accountType === "ADMIN") redirect("/admin");
  return actor;
}

export async function pageLender(permission?: string): Promise<Actor & { lenderId: string }> {
  const actor = await pageActor("/loueur/dashboard");
  if (actor.accountType !== "LENDER" || !actor.lenderId) redirect("/");
  if (permission && !can(actor, permission)) redirect("/loueur/dashboard?denied=1");
  return actor as Actor & { lenderId: string };
}

export async function pageAdmin(permission?: string): Promise<Actor> {
  const actor = await pageActor("/admin");
  if (actor.accountType !== "ADMIN") redirect("/");
  if (permission && !can(actor, permission)) redirect("/admin?denied=1");
  return actor;
}
