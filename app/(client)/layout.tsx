import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/actor";
import { ClientShell } from "@/components/layout/client-shell";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/connexion");
  if (actor.accountType === "LENDER") redirect("/loueur/dashboard");
  if (actor.accountType === "ADMIN") redirect("/admin");
  return <ClientShell actor={actor}>{children}</ClientShell>;
}
