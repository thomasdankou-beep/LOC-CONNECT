import type { Metadata } from "next";
import { db } from "@/lib/db";
import { pageAdmin } from "@/lib/auth/page";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ActionButton, FormAction } from "@/components/ui/action";
import { Plus } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Villes", robots: { index: false } };

export default async function Page() {
  await pageAdmin("ADMIN_CATALOG");
  const cities = await db.city.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true, lenders: true } } } });
  return (
    <>
      <PageHeader
        title="Villes"
        description="Zones couvertes par la plateforme. Une ville inactive disparaît des filtres et des formulaires."
        actions={<FormAction endpoint="/api/admin/cities" label="Nouvelle ville" icon={<Plus size={18} />} title="Nouvelle ville" fields={[{ name: "name", label: "Nom", required: true }, { name: "region", label: "Région ou district", required: true }]} submitLabel="Créer" success="Ville créée" variant="primary" size="md" />}
      />
      <DataTable
        rows={cities}
        rowKey={(c) => c.id}
        empty={{ title: "Aucune ville" }}
        columns={[
          { header: "Ville", cell: (c) => <span className="font-medium text-ink">{c.name}</span> },
          { header: "Région", cell: (c) => c.region },
          { header: "Loueurs", align: "right", cell: (c) => c._count.lenders },
          { header: "Produits", align: "right", cell: (c) => c._count.products },
          { header: "Statut", cell: (c) => (c.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>) },
          {
            header: "Actions",
            cell: (c) => (
              <div className="flex gap-2">
                <FormAction endpoint={`/api/admin/cities/${c.id}`} method="PATCH" label="Modifier" title={`Modifier ${c.name}`} fields={[{ name: "name", label: "Nom", required: true, defaultValue: c.name }, { name: "region", label: "Région ou district", required: true, defaultValue: c.region }]} submitLabel="Enregistrer" success="Ville mise à jour" />
                <ActionButton endpoint={`/api/admin/cities/${c.id}`} method="PATCH" body={{ active: !c.active }} label={c.active ? "Désactiver" : "Activer"} success={c.active ? "Ville désactivée" : "Ville activée"} />
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
