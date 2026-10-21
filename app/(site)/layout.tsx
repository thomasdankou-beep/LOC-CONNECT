import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { maybeRunMaintenance } from "@/services/maintenance";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  void maybeRunMaintenance();
  return (
    <>
      <SiteHeader />
      <main id="contenu">{children}</main>
      <SiteFooter />
    </>
  );
}
