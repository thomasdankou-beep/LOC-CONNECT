import type { ReactNode } from "react";
import { can, type Actor } from "@/lib/auth/actor";
import { DashboardShell } from "./dashboard-shell";
import type { NavGroup } from "./sidebar-nav";
import { Bank, Bell, Buildings, CalendarBlank, CalendarCheck, ChartLineUp, Gauge, GearSix, Package, Scales, ShieldCheck, Star, Stack, Truck, Users, ArrowCounterClockwise } from "@/components/ui/icons";

/** Navigation de l'espace loueur, filtrée selon les permissions du compte (propriétaire ou sous-compte). */
export function LenderShell({ actor, children }: { actor: Actor; children: ReactNode }) {
  const has = (...perms: string[]) => perms.some((p) => can(actor, p));
  const filter = (items: (NavGroup["items"][number] & { perms?: string[] })[]) => items.filter((i) => !i.perms || has(...i.perms)).map(({ perms, ...rest }) => (void perms, rest));
  const groups: NavGroup[] = [
    {
      items: filter([
        { href: "/loueur/dashboard", label: "Tableau de bord", icon: <Gauge size={20} />, exact: true },
        { href: "/loueur/produits", label: "Mes produits", icon: <Package size={20} />, perms: ["PRODUCT_VIEW"] },
        { href: "/loueur/stock", label: "Stock", icon: <Stack size={20} />, perms: ["STOCK_VIEW"] },
        { href: "/loueur/calendrier", label: "Calendrier", icon: <CalendarBlank size={20} />, perms: ["CALENDAR_MANAGE", "ORDER_VIEW"] },
      ]),
    },
    {
      title: "Opérations",
      items: filter([
        { href: "/loueur/reservations", label: "Réservations", icon: <CalendarCheck size={20} />, perms: ["ORDER_VIEW"] },
        { href: "/loueur/livraisons", label: "Livraisons", icon: <Truck size={20} />, perms: ["DELIVERY_VIEW"] },
        { href: "/loueur/retours", label: "Retours", icon: <ArrowCounterClockwise size={20} />, perms: ["RETURN_VIEW"] },
        { href: "/loueur/cautions", label: "Cautions", icon: <ShieldCheck size={20} />, perms: ["DEPOSIT_VIEW"] },
        { href: "/loueur/litiges", label: "Litiges", icon: <Scales size={20} />, perms: ["DISPUTE_VIEW"] },
      ]),
    },
    {
      title: "Finance",
      items: filter([
        { href: "/loueur/revenus", label: "Revenus", icon: <ChartLineUp size={20} />, perms: ["FINANCE_VIEW"] },
        { href: "/loueur/versements", label: "Versements", icon: <Bank size={20} />, perms: ["PAYOUT_VIEW", "FINANCE_VIEW"] },
      ]),
    },
    {
      title: "Relation client",
      items: filter([
        { href: "/loueur/avis", label: "Avis", icon: <Star size={20} />, perms: ["REVIEW_VIEW"] },
        { href: "/loueur/clients", label: "Clients", icon: <Users size={20} />, perms: ["CUSTOMER_VIEW"] },
      ]),
    },
    {
      title: "Compte",
      items: filter([
        { href: "/loueur/entreprise", label: "Mon entreprise", icon: <Buildings size={20} />, perms: ["COMPANY_MANAGE", "TEAM_MANAGE", "AUDIT_VIEW"] },
        { href: "/loueur/notifications", label: "Notifications", icon: <Bell size={20} /> },
        { href: "/loueur/parametres", label: "Paramètres", icon: <GearSix size={20} /> },
      ]),
    },
  ].filter((g) => g.items.length > 0);
  return (
    <DashboardShell actor={actor} groups={groups} area={actor.lenderName ? `Espace loueur · ${actor.lenderName}` : "Espace loueur"} notificationsHref="/loueur/notifications" spaceHref="/loueur/dashboard" spaceLabel="Espace loueur">
      {children}
    </DashboardShell>
  );
}
