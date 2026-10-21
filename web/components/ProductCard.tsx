import Link from "next/link";
import { fcfa, getLoueur, getVille, type Produit } from "@/lib/data";

export default function ProductCard({ p }: { p: Produit }) {
  const loueur = getLoueur(p.loueurId);
  return (
    <Link href={`/produits/${p.id}`} className="card product-card">
      <div className="product-thumb">{p.emoji}</div>
      <div className="product-body">
        {p.miseEnAvant && <span className="tag">À la une</span>}
        <h3 style={{ marginTop: 6 }}>{p.nom}</h3>
        <div className="muted" style={{ fontSize: ".85rem" }}>
          {loueur?.nom} · {getVille(p.ville)}
        </div>
        <div style={{ marginTop: 8 }}>
          <span className="price">{fcfa(p.prixUnitaire)}</span> <span className="muted">/ jour</span>
        </div>
        <div className="muted" style={{ fontSize: ".8rem" }}>Caution : {fcfa(p.caution)}</div>
      </div>
    </Link>
  );
}
