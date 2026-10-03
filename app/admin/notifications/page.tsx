import type { Metadata } from "next";
import { pageAdmin } from "@/lib/auth/page";
import { formatDateTime } from "@/lib/dates";
import { listNotificationsAdmin } from "@/services/admin";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Notice } from "@/components/ui/states";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

const CHANNEL: Record<string, string> = { INTERNAL: "Interne", EMAIL: "E-mail", SMS: "SMS", WHATSAPP: "WhatsApp", PUSH: "Notification push" };

export default async function Page({ searchParams }: { searchParams: Promise<{ channel?: string; page?: string }> }) {
  const actor = await pageAdmin("ADMIN_NOTIFICATIONS");
  const sp = await searchParams;
  const r = await listNotificationsAdmin(actor, { channel: sp.channel || undefined, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Notifications" description="Toutes les notifications émises par la plateforme, avec leur canal et leur état d'envoi." />
      <div className="mb-5"><Notice tone="info">Les notifications internes et les e-mails sont actifs. Les canaux SMS et WhatsApp ne sont pas connectés dans cette version : ils s&apos;ajoutent par un fournisseur dédié sans modifier les événements.</Notice></div>
      <form action="/admin/notifications" method="get" className="mb-5 flex gap-3">
        <select name="channel" defaultValue={sp.channel ?? ""} aria-label="Canal" className="h-11 rounded-control border border-line bg-surface px-3 text-[15px] text-ink"><option value="">Tous les canaux</option>{Object.entries(CHANNEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <button type="submit" className="h-11 rounded-control bg-navy px-5 text-sm font-medium text-white hover:opacity-90">Filtrer</button>
      </form>
      <DataTable
        rows={r.rows}
        rowKey={(n) => n.id}
        empty={{ title: "Aucune notification", description: "Aucune notification pour ce filtre." }}
        columns={[
          { header: "Date", cell: (n) => <span className="whitespace-nowrap">{formatDateTime(n.createdAt)}</span> },
          { header: "Destinataire", cell: (n) => `${n.user.firstName} ${n.user.lastName}` },
          { header: "Canal", cell: (n) => <Badge>{CHANNEL[n.channel] ?? n.channel}</Badge> },
          { header: "Message", cell: (n) => <span className="block max-w-96"><span className="block truncate font-medium text-ink">{n.title}</span><span className="block truncate text-xs text-muted">{n.body}</span></span> },
          { header: "Lue", cell: (n) => (n.readAt ? "Oui" : "Non") },
        ]}
      />
      <Pagination page={r.page} totalPages={r.totalPages} basePath="/admin/notifications" params={{ channel: sp.channel }} />
    </>
  );
}
