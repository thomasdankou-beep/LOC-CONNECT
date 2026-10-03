import type { Metadata } from "next";
import { pageAdmin } from "@/lib/auth/page";
import { formatDateTime } from "@/lib/dates";
import { listContactMessages } from "@/services/contact";
import { PageHeader } from "@/components/ui/card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { Tabs } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { ActionButton } from "@/components/ui/action";
import { Envelope } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Messages de contact", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string }> }) {
  const actor = await pageAdmin("ADMIN_NOTIFICATIONS");
  const sp = await searchParams;
  const tab = sp.tab === "handled" ? "handled" : sp.tab === "all" ? "all" : "new";
  const r = await listContactMessages(actor, { handled: tab === "all" ? undefined : tab === "handled", page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Messages de contact" description="Messages envoyés depuis la page Contact. Répondez par e-mail puis marquez-les comme traités." />
      <Tabs active={tab} items={[{ key: "new", label: "À traiter", href: "/admin/messages" }, { key: "handled", label: "Traités", href: "/admin/messages?tab=handled" }, { key: "all", label: "Tous", href: "/admin/messages?tab=all" }]} />
      {r.rows.length === 0 ? (
        <EmptyState icon={<Envelope size={28} />} title="Aucun message" description="Les messages du formulaire de contact apparaissent ici." />
      ) : (
        <ul className="space-y-4">
          {r.rows.map((m) => (
            <li key={m.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{m.subject} {m.handled ? <Badge tone="success">Traité</Badge> : <Badge tone="warning">À traiter</Badge>}</p>
                    <p className="text-sm text-muted">{m.name} · <a href={`mailto:${m.email}`} className="text-royal-ink hover:underline">{m.email}</a>{m.phone ? ` · ${m.phone}` : ""} · {formatDateTime(m.createdAt)}</p>
                  </div>
                  <ActionButton endpoint={`/api/admin/messages/${m.id}`} method="PATCH" body={{ handled: !m.handled }} label={m.handled ? "Rouvrir" : "Marquer comme traité"} variant={m.handled ? "secondary" : "primary"} success={m.handled ? "Message rouvert" : "Message traité"} />
                </div>
                <p className="mt-3 whitespace-pre-line text-[15px] text-ink/90">{m.message}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={r.page} totalPages={r.totalPages} basePath="/admin/messages" params={{ tab: tab === "new" ? undefined : tab }} />
    </>
  );
}
