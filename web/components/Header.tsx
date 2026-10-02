"use client";
import Link from "next/link";
import { useCart } from "@/lib/cart";

export default function Header() {
  const { lignes } = useCart();
  return (
    <header className="header">
      <div className="container">
        <Link href="/" className="logo">
          LOC<span>'</span>CONNECT
        </Link>
        <nav className="nav">
          <Link href="/produits">Catalogue</Link>
          <Link href="/loueur">Espace loueur</Link>
          <Link href="/compte">Mon compte</Link>
          <Link href="/panier">
            Panier{lignes.length > 0 && <span className="badge">{lignes.length}</span>}
          </Link>
        </nav>
      </div>
    </header>
  );
}
