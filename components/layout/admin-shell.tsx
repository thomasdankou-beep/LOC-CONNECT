import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { can, type Actor } from "@/lib/auth/actor";
import { DashboardShell } from "./dashboard-shell";
import type { NavGroup } from "./sidebar-nav";
import { ArrowCounterClockwise, Bank, Bell, Envelope, CalendarCheck, ChartLineUp, ClipboardText, CreditCard, Gauge, GearSix, HandCoins, IdentificationCard, Key, MapPin, Package, Percent, Receipt, Scales, ShieldCheck, Siren, Stack, Star, Tag, Truck, Users, Wallet, ArrowsClockwise, Storefront, Money } from "@/components/ui/icons";

type Item = NavGroup["items"][number] & { perm?: string };

/** Navigation de l'administration, filtrée par permission. Les pastilles signalent le travail en attente. */
export async function AdminShell({ actor, children }: { actor: Actor; children: ReactNode }) {
  const maxAttempts = (await getSettings())["cash.max_code_attempts"];
  const [pendingLenders, pendingProducts, escalations, openDisputes, validations, newMessages, lockedCash] = await Promise.all([
    can(actor, "ADMIN_LENDERS") ? db.lender.count({ where: { status: "PENDING" } }) : 0,
    can(actor, "ADMIN_PRODUCTS") ? db.product.count({ where: { status: "PENDING_REVIEW", deletedAt: null } }) : 0,
    can(actor, "ADMIN_MODIFICATIONS") ? db.modificationRequest.count({ where: { status: "PENDING_VALIDATION", escalatedAt: { not: null } } }) : 0,
    can(actor, "ADMIN_DISPUTES") ? db.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }) : 0,
    can(actor, "ADMIN_PAYOUTS") ? db.validationAction.count({ where: { status: "PENDING" } }) : 0,
    can(actor, "ADMIN_NOTIFICATIONS") ? db.contactMessage.count({ where: { handled: false } }) : 0,
    can(actor, "ADMIN_PAYMENTS") ? db.cashSettlement.count({ where: { status: "PENDING", failedAttempts: { gte: maxAttempts } } }) : 0,
  ]);
  const groups: { title?: string; items: Item[] }[] = [
    { items: [{ href: "/admin", label: "Tableau de bord", icon: <Gauge size={20} />, exact: true, perm: "ADMIN_DASHBOARD" }] },
    {
      title: "Plateforme",
      items: [
        { href: "/admin/utilisateurs", label: "Utilisateurs", icon: <Users size={20} />, perm: "ADMIN_USERS" },
        { href: "/admin/loueurs", label: "Loueurs", icon: <Storefront size={20} />, perm: "ADMIN_LENDERS", badge: pendingLenders },
        { href: "/admin/produits", label: "Produits", icon: <Package size={20} />, perm: "ADMIN_PRODUCTS", badge: pendingProducts },
        { href: "/admin/categories", label: "Catégories", icon: <Tag size={20} />, perm: "ADMIN_CATALOG" },
        { href: "/admin/villes", label: "Villes", icon: <MapPin size={20} />, perm: "ADMIN_CATALOG" },
        { href: "/admin/stock", label: "Stocks", icon: <Stack size={20} />, perm: "ADMIN_STOCK" },
      ],
    },
    {
      title: "Opérations",
      items: [
        { href: "/admin/reservations", label: "Réservations", icon: <CalendarCheck size={20} />, perm: "ADMIN_RESERVATIONS" },
        { href: "/admin/modifications", label: "Modifications", icon: <ArrowsClockwise size={20} />, perm: "ADMIN_MODIFICATIONS", badge: escalations },
        { href: "/admin/livraisons", label: "Livraisons", icon: <Truck size={20} />, perm: "ADMIN_DELIVERIES" },
        { href: "/admin/retours", label: "Retours", icon: <ArrowCounterClockwise size={20} />, perm: "ADMIN_RETURNS" },
        { href: "/admin/litiges", label: "Litiges", icon: <Scales size={20} />, perm: "ADMIN_DISPUTES", badge: openDisputes },
        { href: "/admin/avis", label: "Avis", icon: <Star size={20} />, perm: "ADMIN_REVIEWS" },
      ],
    },
    {
      title: "Finance",
      items: [
        { href: "/admin/paiements", label: "Paiements", icon: <CreditCard size={20} />, perm: "ADMIN_PAYMENTS" },
        { href: "/admin/especes", label: "Paiements en espèces", icon: <Money size={20} />, perm: "ADMIN_PAYMENTS", badge: lockedCash },
        { href: "/admin/remboursements", label: "Remboursements", icon: <Receipt size={20} />, perm: "ADMIN_REFUNDS" },
        { href: "/admin/commissions", label: "Commissions", icon: <Percent size={20} />, perm: "ADMIN_COMMISSIONS" },
        { href: "/admin/cautions", label: "Cautions", icon: <ShieldCheck size={20} />, perm: "ADMIN_DEPOSITS" },
        { href: "/admin/versements", label: "Versements", icon: <Bank size={20} />, perm: "ADMIN_PAYOUTS" },
        { href: "/admin/validations", label: "Validations", icon: <IdentificationCard size={20} />, perm: "ADMIN_PAYOUTS", badge: validations },
        { href: "/admin/recouvrements", label: "Recouvrements", icon: <HandCoins size={20} />, perm: "ADMIN_RECOVERIES" },
        { href: "/admin/abonnements", label: "Abonnements", icon: <Wallet size={20} />, perm: "ADMIN_SUBSCRIPTIONS" },
        { href: "/admin/mises-en-avant", label: "Mises en avant", icon: <ChartLineUp size={20} />, perm: "ADMIN_PROMOTIONS" },
      ],
    },
    {
      title: "Système",
      items: [
        { href: "/admin/messages", label: "Messages de contact", icon: <Envelope size={20} />, perm: "ADMIN_NOTIFICATIONS", badge: newMessages },
        { href: "/admin/notifications", label: "Notifications", icon: <Bell size={20} />, perm: "ADMIN_NOTIFICATIONS" },
        { href: "/admin/audit", label: "Journal d'audit", icon: <ClipboardText size={20} />, perm: "ADMIN_AUDIT" },
        { href: "/admin/roles", label: "Rôles et accès", icon: <Key size={20} />, perm: "ADMIN_ROLES" },
        { href: "/admin/parametres", label: "Paramètres", icon: <GearSix size={20} />, perm: "ADMIN_SETTINGS" },
        { href: "/admin/annulation", label: "Politique d'annulation", icon: <ArrowCounterClockwise size={20} />, perm: "ADMIN_SETTINGS" },
      ],
    },
  ];
  const filtered: NavGroup[] = groups
    .map((g) => ({ title: g.title, items: g.items.filter((i) => !i.perm || can(actor, i.perm)).map(({ perm, ...rest }) => (void perm, rest)) }))
    .filter((g) => g.items.length > 0);
  return (
    <DashboardShell actor={actor} groups={filtered} area="Administration LOC'CONNECT" notificationsHref="/admin/notifications" spaceHref="/admin" spaceLabel="Administration">
      {children}
    </DashboardShell>
  );
}
