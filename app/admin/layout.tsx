import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/actor";
import { AdminShell } from "@/components/layout/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/connexion?next=/admin");
  if (actor.accountType !== "ADMIN") redirect("/");
  return <AdminShell actor={actor}>{children}</AdminShell>;
}
