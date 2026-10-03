import type { Metadata } from "next";
import { requireClient } from "@/lib/auth/actor";
import { listNotifications } from "@/services/notifications";
import { PageHeader } from "@/components/ui/card";
import { NotificationList } from "@/features/notifications/list";

export const metadata: Metadata = { title: "Mes notifications", robots: { index: false } };

export default async function Page() {
  const actor = await requireClient();
  const items = await listNotifications(actor.userId, { take: 60 });
  return (
    <>
      <PageHeader title="Mes notifications" description="Confirmations, rappels, livraisons, cautions et litiges." />
      <NotificationList items={items.map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() }))} />
    </>
  );
}
