"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { fcfa, nbJours } from "@/lib/data";

const aujourdhui = () => new Date().toISOString().slice(0, 10);

export default function Reservation({ produitId, prix, caution, stock }: { produitId: string; prix: number; caution: number; stock: number }) {
  const router = useRouter();
  const { ajouter } = useCart();
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [quantite, setQuantite] = useState(1);
  const [erreur, setErreur] = useState("");

  const jours = nbJours(debut, fin);
  const sousTotal = prix * quantite * jours;

  function valider() {
    if (!debut || !fin) return setErreur("Choisissez une date de début et de fin.");
    if (jours <= 0) return setErreur("La date de fin doit être postérieure à la date de début.");
    if (quantite < 1 || quantite > stock) return setErreur(`Quantité invalide (1 à ${stock}).`);
    setErreur("");
    ajouter({ produitId, quantite, debut, fin });
    router.push("/panier");
  }

  return (
    <aside className="card" style={{ position: "sticky", top: 80 }}>
      <h3>Réserver</h3>
      <div className="field">
        <label htmlFor="debut">Du</label>
        <input id="debut" type="date" min={aujourdhui()} value={debut} onChange={(e) => setDebut(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="fin">Au</label>
        <input id="fin" type="date" min={debut || aujourdhui()} value={fin} onChange={(e) => setFin(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="qte">Quantité (max {stock})</label>
        <input id="qte" type="number" min={1} max={stock} value={quantite} onChange={(e) => setQuantite(Number(e.target.value))} />
      </div>

      {jours > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="total-row"><span>{jours} jour{jours > 1 ? "s" : ""} × {quantite}</span><span>{fcfa(sousTotal)}</span></div>
          <div className="total-row"><span>Caution (bloquée)</span><span>{fcfa(caution * quantite)}</span></div>
        </div>
      )}
      {erreur && <p style={{ color: "var(--danger)", fontSize: ".9rem" }} role="alert">{erreur}</p>}
      <button className="btn block" onClick={valider}>Ajouter au panier</button>
      <p className="muted" style={{ fontSize: ".8rem", marginBottom: 0 }}>
        Disponibilité et montants vérifiés par le serveur au moment du paiement.
      </p>
    </aside>
  );
}
