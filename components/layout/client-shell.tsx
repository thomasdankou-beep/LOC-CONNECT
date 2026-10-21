import type { ReactNode } from "react";
import type { Actor } from "@/lib/auth/actor";
import { DashboardShell } from "./dashboard-shell";
import type { NavGroup } from "./sidebar-nav";
import { Bell, CalendarCheck, CreditCard, Gauge, Heart, Lifebuoy, Scales, Star, UserCircle, ArrowCounterClockwise, Receipt } from "@/components/ui/icons";

const GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/mon-compte", label: "Tableau de bord", icon: <Gauge size={20} />, exact: true },
      { href: "/mes-reservations", label: "Mes réservations", icon: <CalendarCheck size={20} /> },
      { href: "/mes-paiements", label: "Mes paiements", icon: <CreditCard size={20} /> },
      { href: "/mes-remboursements", label: "Mes remboursements", icon: <ArrowCounterClockwise size={20} /> },
      { href: "/mes-factures", label: "Mes factures", icon: <Receipt size={20} /> },
    ],
  },
  {
    title: "Mon activité",
    items: [
      { href: "/mes-favoris", label: "Mes favoris", icon: <Heart size={20} /> },
      { href: "/mes-avis", label: "Mes avis", icon: <Star size={20} /> },
      { href: "/mes-litiges", label: "Mes litiges", icon: <Scales size={20} /> },
    ],
  },
  {
    title: "Compte",
    items: [
      { href: "/mon-profil", label: "Mon profil", icon: <UserCircle size={20} /> },
      { href: "/mes-notifications", label: "Mes notifications", icon: <Bell size={20} /> },
    ],
  },
];

export function ClientShell({ actor, children }: { actor: Actor; children: ReactNode }) {
  return (
    <DashboardShell actor={actor} groups={GROUPS} area="Espace client" notificationsHref="/mes-notifications" spaceHref="/mon-compte" spaceLabel="Mon espace">
      {children}
    </DashboardShell>
  );
}

