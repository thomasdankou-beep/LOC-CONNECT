import type { Metadata } from "next";
import { pageLender } from "@/lib/auth/page";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { lenderClients } from "@/services/lenders";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Avatar } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Clients", robots: { index: false } };

export default async function Page() {
  const actor = await pageLender("CUSTOMER_VIEW");
  const clients = await lenderClients(actor.lenderId);
  return (
    <>
      <PageHeader title="Clients" description="Les clients qui ont réservé chez vous. Ces coordonnées servent uniquement à la bonne exécution des locations." />
      <DataTable
        rows={clients}
        rowKey={(c) => c.id}
        empty={{ title: "Aucun client", description: "Vos clients apparaissent après leur première réservation payée." }}
        columns={[
          { header: "Client", cell: (c) => <span className="flex items-center gap-3"><Avatar name={c.name} size={32} /><span className="font-medium">{c.name}</span></span> },
          { header: "Contact", cell: (c) => <span className="block"><span className="block">{c.phone ?? ""}</span><span className="block text-xs text-muted">{c.email}</span></span> },
          { header: "Réservations", align: "right", cell: (c) => c.reservations },
          { header: "Chiffre d'affaires", align: "right", cell: (c) => formatFcfa(c.spent) },
          { header: "Dernière réservation", cell: (c) => formatDate(c.last) },
        ]}
      />
    </>
  );
}
