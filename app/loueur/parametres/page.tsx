import type { Metadata } from "next";
import { db } from "@/lib/db";
import { pageLender } from "@/lib/auth/page";
import { PageHeader } from "@/components/ui/card";
import { ProfileForms } from "@/features/account/profile-forms";

export const metadata: Metadata = { title: "Paramètres du compte", robots: { index: false } };

export default async function Page() {
  const actor = await pageLender();
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.userId } });
  return (
    <>
      <PageHeader title="Paramètres du compte" description="Vos informations personnelles et votre mot de passe. Les informations de l'entreprise se gèrent dans « Mon entreprise »." />
      <ProfileForms profile={{ firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone ?? "", deliveryAddress: "", cityId: "" }} cities={[]} showAddress={false} allowDelete={false} />
    </>
  );
}
