import type { Metadata } from "next";
import { pageAdmin } from "@/lib/auth/page";
import { can } from "@/lib/auth/actor";
import { getSettingsForAdmin } from "@/services/admin";
import { PageHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { SettingsEditor, type SettingRow } from "@/features/admin/settings-editor";

export const metadata: Metadata = { title: "Paramètres", robots: { index: false } };

export default async function Page() {
  const actor = await pageAdmin("ADMIN_SETTINGS");
  const settings = (await getSettingsForAdmin(actor)) as SettingRow[];
  return (
    <>
      <PageHeader title="Paramètres commerciaux" description="Aucune règle commerciale n'est codée en dur : commission, délais, durées de HOLD, contestation, modification, sécurité." />
      <div className="mb-6"><Notice tone="info">Chaque modification est journalisée et s&apos;applique aux nouvelles opérations. Les réservations existantes conservent les valeurs figées au moment de leur création (commission, politique d&apos;annulation).</Notice></div>
      <SettingsEditor settings={settings} canEdit={can(actor, "ADMIN_SETTINGS")} />
    </>
  );
}
