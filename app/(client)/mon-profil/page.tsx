import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/auth/actor";
import { listCities } from "@/services/catalog";
import { PageHeader } from "@/components/ui/card";
import { ProfileForms } from "@/features/account/profile-forms";

export const metadata: Metadata = { title: "Mon profil", robots: { index: false } };

export default async function Page() {
  const actor = await requireClient();
  const [user, cities] = await Promise.all([db.user.findUniqueOrThrow({ where: { id: actor.userId } }), listCities()]);
  return (
    <>
      <PageHeader title="Mon profil" description="Vos informations, votre mot de passe et la gestion de votre compte." />
      <ProfileForms profile={{ firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone ?? "", deliveryAddress: user.deliveryAddress ?? "", cityId: user.cityId ?? "" }} cities={cities.map((c) => ({ id: c.id, name: c.name }))} />
    </>
  );
}
