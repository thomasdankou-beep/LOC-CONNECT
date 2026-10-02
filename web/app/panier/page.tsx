"use client";
import Link from "next/link";
import { calculerLigne, useCart } from "@/lib/cart";
import { fcfa, getLoueur } from "@/lib/data";

export default function Panier() {
  const { lignes, retirer, pret } = useCart();
  if (!pret) return <div className="container section muted">Chargement…</div>;

  const detail = lignes.map((l, index) => ({ index, l, c: calculerLigne(l) })).filter((x) => x.c);
  const parLoueur = new Map<string, typeof detail>();
  for (const d of detail) {
    const id = d.c!.produit.loueurId;
    parLoueur.set(id, [...(parLoueur.get(id) ?? []), d]);
  }

  const sousTotal = detail.reduce((s, d) => s + d.c!.sousTotal, 0);
  const caution = detail.reduce((s, d) => s + d.c!.caution, 0);

  if (detail.length === 0) {
    return (
      <div className="container section">
        <h1>Panier</h1>
        <div className="card">
          <p>Votre panier est vide.</p>
          <Link className="btn" href="/produits">Parcourir le catalogue</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container section">
      <h1>Panier</h1>
      <div className="two-col">
        <div>
          {[...parLoueur.entries()].map(([loueurId, items]) => (
            <div className="card" key={loueurId} style={{ marginBottom: 16 }}>
              <div className="row spread">
                <h3 style={{ margin: 0 }}>{getLoueur(loueurId)?.nom}</h3>
                <span className="tag gray">{items.length} article{items.length > 1 ? "s" : ""}</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Article</th><th>Période</th><th>Qté</th><th>Sous-total</th><th>Caution</th><th></th></tr>
                  </thead>
                  <tbody>
                    {items.map(({ index, l, c }) => (
                      <tr key={index}>
                        <td>{c!.produit.emoji} {c!.produit.nom}</td>
                        <td>{l.debut} → {l.fin} <span className="muted">({c!.jours} j)</span></td>
                        <td>{l.quantite}</td>
                        <td>{fcfa(c!.sousTotal)}</td>
                        <td>{fcfa(c!.caution)}</td>
                        <td><button className="btn secondary" onClick={() => retirer(index)} aria-label="Retirer">✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        <aside className="card" style={{ position: "sticky", top: 80 }}>
          <h3>Récapitulatif</h3>
          <div className="total-row"><span>Locations</span><span>{fcfa(sousTotal)}</span></div>
          <div className="total-row"><span>Cautions (bloquées)</span><span>{fcfa(caution)}</span></div>
          <div className="total-row big"><span>Total à régler</span><span>{fcfa(sousTotal + caution)}</span></div>
          <p className="muted" style={{ fontSize: ".85rem" }}>
            Un paiement unique, réparti entre {parLoueur.size} loueur{parLoueur.size > 1 ? "s" : ""}. La caution est libérée après le constat de retour.
          </p>
          <Link href="/paiement" className="btn block">Passer au paiement</Link>
        </aside>
      </div>
    </div>
  );
}
