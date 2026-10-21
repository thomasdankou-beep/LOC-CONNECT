import Link from "next/link";
import { getActor } from "@/lib/auth/actor";
import { cartCount } from "@/services/cart";
import { unreadCount } from "@/services/notifications";
import { LinkButton } from "@/components/ui/button";
import { ShoppingCart, MagnifyingGlass } from "@/components/ui/icons";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { UserMenu, type MenuUser } from "./user-menu";

const LINKS = [
  { href: "/catalogue", label: "Catalogue" },
  { href: "/categories", label: "Catégories" },
  { href: "/#comment-ca-marche", label: "Comment ça marche" },
  { href: "/devenir-loueur", label: "Devenir loueur" },
];

export async function SiteHeader() {
  const actor = await getActor();
  let menuUser: MenuUser | null = null;
  let cart = 0;
  if (actor) {
    const [unread, count] = await Promise.all([unreadCount(actor.userId), actor.accountType === "CLIENT" ? cartCount(actor.userId) : Promise.resolve(0)]);
    cart = count;
    menuUser = {
      name: `${actor.firstName} ${actor.lastName}`.trim(),
      email: actor.email,
      accountType: actor.accountType,
      spaceHref: actor.accountType === "CLIENT" ? "/mon-compte" : actor.accountType === "LENDER" ? "/loueur/dashboard" : "/admin",
      spaceLabel: actor.accountType === "CLIENT" ? "Mon espace" : actor.accountType === "LENDER" ? "Espace loueur" : "Administration",
      unread,
    };
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-control px-3 py-2 text-sm font-medium text-ink/80 transition hover:bg-surface-2 hover:text-ink">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/catalogue" className="flex size-11 items-center justify-center rounded-control text-ink hover:bg-surface-2 lg:hidden" aria-label="Rechercher">
            <MagnifyingGlass size={22} />
          </Link>
          {(!actor || actor.accountType === "CLIENT") && (
            <Link href="/panier" className="relative flex size-11 items-center justify-center rounded-control border border-line bg-surface text-ink transition hover:bg-surface-2" aria-label={`Panier, ${cart} article${cart > 1 ? "s" : ""}`}>
              <ShoppingCart size={22} />
              {cart > 0 && <span className="absolute -right-1.5 -top-1.5 flex min-w-5 items-center justify-center rounded-full bg-royal px-1 text-xs font-semibold text-white">{cart}</span>}
            </Link>
          )}
          {menuUser ? (
            <UserMenu user={menuUser} />
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <LinkButton href="/connexion" variant="ghost">
                Se connecter
              </LinkButton>
              <LinkButton href="/inscription">Créer un compte</LinkButton>
            </div>
          )}
          <MobileNav links={[...LINKS, ...(menuUser ? [{ href: menuUser.spaceHref, label: menuUser.spaceLabel }] : [{ href: "/connexion", label: "Se connecter" }])]} cta={menuUser ? undefined : { href: "/inscription", label: "Créer un compte" }} />
        </div>
      </div>
    </header>
  );
}
