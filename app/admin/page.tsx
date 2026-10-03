import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { can } from "@/lib/auth/actor";
import { pageAdmin } from "@/lib/auth/page";
import { formatDateTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { RESERVATION_STATUS } from "@/lib/labels";
import { dashboardStats } from "@/services/admin";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/misc";
import { Notice } from "@/components/ui/states";
import { BarChart } from "@/components/charts/bar-chart";
import { Bank, ChartLineUp, Percent, ShieldCheck, Storefront, Users, Warning } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Administration", robots: { index: false } };

const MONTH = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });
const STATUS_ORDER = ["PAID", "CONFIRMED", "READY", "DELIVERING", "IN_USE", "RETURN_PENDING", "RETURNED", "COMPLETED", "DISPUTED", "CANCELLED", "REFUNDED"] as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const actor = await pageAdmin();
  const sp = await searchParams;
  if (!can(actor, "ADMIN_DASHBOARD")) {
    return <PageHeader title="Administration" description="Utilisez le menu pour accéder aux modules autorisés par votre rôle." />;
  }
  const [s, escalations, validations, audit] = await Promise.all([
    dashboardStats(actor),
    db.modificationRequest.count({ where: { status: "PENDING_VALIDATION", escalatedAt: { not: null } } }),
    db.validationAction.count({ where: { status: "PENDING" } }),
    can(actor, "ADMIN_AUDIT") ? db.auditLog.findMany({ include: { user: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, take: 8 }) : [],
  ]);
  const chart = s.monthly.map((m) => ({ label: MONTH.format(new Date(`${m.month}-01T00:00:00Z`)), values: { revenue: m.revenue - m.commission, commission: m.commission } }));
  const todo = [
    s.pendingLenders > 0 && { href: "/admin/loueurs?status=PENDING", text: `${s.pendingLenders} loueur${s.pendingLenders > 1 ? "s" : ""} à valider`, tone: "warning" as const },
    s.pendingProducts > 0 && { href: "/admin/produits?status=PENDING_REVIEW", text: `${s.pendingProducts} produit${s.pendingProducts > 1 ? "s" : ""} à modérer`, tone: "warning" as const },
    escalations > 0 && { href: "/admin/modifications", text: `${escalations} modification${escalations > 1 ? "s" : ""} escaladée${escalations > 1 ? "s" : ""}, sans réponse du loueur`, tone: "danger" as const },
    s.openDisputes > 0 && { href: "/admin/litiges", text: `${s.openDisputes} litige${s.openDisputes > 1 ? "s" : ""} ouvert${s.openDisputes > 1 ? "s" : ""}`, tone: "danger" as const },
    validations > 0 && { href: "/admin/validations", text: `${validations} changement${validations > 1 ? "s" : ""} de coordonnées de versement à valider`, tone: "info" as const },
    s.toRecover > 0 && { href: "/admin/recouvrements", text: `${formatFcfa(s.toRecover)} à recouvrer auprès de loueurs`, tone: "warning" as const },
  ].filter(Boolean) as { href: string; text: string; tone: "warning" | "danger" | "info" }[];

  return (
    <>
      {sp.denied && <div className="mb-6"><Notice tone="warning">Votre rôle ne permet pas d&apos;accéder à ce module.</Notice></div>}
      <PageHeader title="Tableau de bord" description="Vue d'ensemble de l'activité, des flux financiers et du travail en attente." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard primary label="Volume payé net des remboursements" value={formatFcfa(s.grossRevenue)} icon={<ChartLineUp size={20} />} hint={`${formatFcfa(s.refunds)} remboursés`} />
        <KpiCard label="Commissions perçues" value={formatFcfa(s.commissions)} icon={<Percent size={20} />} hint={`${formatFcfa(s.lenderNet)} revenant aux loueurs`} />
        <KpiCard label="Cautions détenues" value={formatFcfa(s.deposits.held)} icon={<ShieldCheck size={20} />} hint={`${formatFcfa(s.deposits.withheld)} retenues · ${formatFcfa(s.deposits.released)} restituées`} />
        <KpiCard label="À verser aux loueurs" value={formatFcfa(s.payableAmount)} icon={<Bank size={20} />} hint={`${formatFcfa(s.frozenAmount)} encore gelés`} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Clients" value={s.users} icon={<Users size={20} />} hint={`${s.activeUsers} actifs sur 30 jours`} />
        <KpiCard label="Loueurs actifs" value={s.lenders} icon={<Storefront size={20} />} hint={`${s.pendingLenders} en attente de validation`} />
        <KpiCard label="Produits publiés" value={s.products} hint={`${s.pendingProducts} à modérer`} />
        <KpiCard label="HOLD non convertis" value={`${Math.round(s.holdNonConversionRate * 100)} %`} icon={<Warning size={20} />} hint="Paniers bloqués puis abandonnés" />
      </div>

      {todo.length > 0 && (
        <section className="mt-6" aria-label="Travail en attente">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {todo.map((a) => <Link key={a.href} href={a.href} className="block transition hover:-translate-y-0.5"><Notice tone={a.tone}>{a.text}</Notice></Link>)}
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Volume des 6 derniers mois" description="Part des loueurs et commission LOC'CONNECT" />
          <div className="p-5">{chart.length === 0 ? <p className="py-10 text-center text-sm text-muted">Pas encore de données.</p> : <BarChart data={chart} series={[{ key: "revenue", label: "Part loueurs" }, { key: "commission", label: "Commission" }]} unit="fcfa" ariaLabel="Volume mensuel : part des loueurs et commission" />}</div>
        </Card>
        <Card>
          <CardHeader title="Réservations par statut" description={`${Object.values(s.reservationsByStatus).reduce((a, b) => a + b, 0)} au total`} action={<Link href="/admin/reservations" className="text-sm font-medium text-royal-ink hover:underline">Voir</Link>} />
          <ul className="divide-y divide-line">
            {STATUS_ORDER.filter((k) => s.reservationsByStatus[k]).map((k) => (
              <li key={k} className="flex items-center justify-between px-5 py-3"><StatusBadge entry={RESERVATION_STATUS[k]} /><span className="font-semibold tabular-nums text-ink">{s.reservationsByStatus[k]}</span></li>
            ))}
          </ul>
        </Card>
      </div>

      {audit.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Activité récente" action={<Link href="/admin/audit" className="text-sm font-medium text-royal-ink hover:underline">Journal complet</Link>} />
          <ul className="divide-y divide-line text-sm">
            {audit.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"><span><span className="font-medium text-ink">{a.user ? `${a.user.firstName} ${a.user.lastName}` : "Système"}</span> <span className="font-mono text-[13px] text-muted">{a.action}</span></span><span className="text-xs text-muted">{formatDateTime(a.createdAt)}</span></li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
