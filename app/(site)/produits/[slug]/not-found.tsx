import { EmptyState } from "@/components/ui/states";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24">
      <EmptyState title="Ce produit n'est plus disponible" description="Il a peut-être été retiré par le loueur ou n'est plus publié." action={<LinkButton href="/catalogue">Retour au catalogue</LinkButton>} />
    </div>
  );
}
