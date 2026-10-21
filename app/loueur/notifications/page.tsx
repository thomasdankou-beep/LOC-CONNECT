import type { Metadata } from "next";
import { pageLender } from "@/lib/auth/page";
import { listNotifications } from "@/services/notifications";
import { PageHeader } from "@/components/ui/card";
import { NotificationList } from "@/features/notifications/list";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

export default async function Page() {
  const actor = await pageLender();
  const items = await listNotifications(actor.userId, { take: 60 });
  return (
    <>
      <PageHeader title="Notifications" description="Nouvelles réservations, modifications, retours, litiges et versements." />
      <NotificationList items={items.map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() }))} />
    </>
  );
}
