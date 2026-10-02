"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { calculerLigne, useCart } from "@/lib/cart";
import { fcfa, PARAMS } from "@/lib/data";

type Etape = "recap" | "hold" | "paye" | "expire";
const MODES = ["Orange Money", "MTN MoMo", "Moov Money", "Wave", "Carte bancaire"];

export default function Paiement() {
  const { lignes, vider, pret } = useCart();
  const [etape, setEtape] = useState<Etape>("recap");
  const [mode, setMode] = useState(MODES[0]);
  const [reste, setReste] = useState(PARAMS.dureeHoldMinutes * 60);
  const [ref, setRef] = useState("");

  const detail = lignes.map((l) => calculerLigne(l)).filter((c) => c !== null);
  const sousTotal = detail.reduce((s, c) => s + c.sousTotal, 0);
  const caution = detail.reduce((s, c) => s + c.caution, 0);
  const total = sousTotal + caution;

  useEffect(() => {
    if (etape !== "hold") return;
    const t = setInterval(() => setReste((r) => r - 1), 1000);
    return () => clearInterval(t);
  }, [etape]);

  useEffect(() => {
    if (etape === "hold" && reste <= 0) setEtape("expire");
  }, [etape, reste]);

  if (!pret) return <div className="container section muted">Chargement…</div>;

  if (etape === "paye") {
    return (
      <div className="container section">
        <div className="card">
          <h1>✅ Paiement confirmé</h1>
          <p>Référence de réservation : <strong>{ref}</strong></p>
          <p className="muted">Le HOLD a été converti en réservation confirmée. Les loueurs ont été notifiés.</p>
          <div className="row">
            <Link className="btn" href="/compte">Voir mes réservations</Link>
            <Link className="btn secondary" href="/produits">Continuer</Link>
          </div>
        </div>
      </div>
    );
  }

  if (detail.length === 0) {
    return (
      <div className="container section">
        <div className="card"><p>Rien à payer.</p><Link className="btn" href="/produits">Catalogue</Link></div>
      </div>
    );
  }

  const mm = String(Math.max(0, Math.floor(reste / 60))).padStart(2, "0");
  const ss = String(Math.max(0, reste % 60)).padStart(2, "0");

  return (
    <div className="container section">
      <h1>Paiement</h1>
      <div className="two-col">
        <div className="card">
          {etape === "expire" ? (
            <>
              <h3>Réservation temporaire expirée</h3>
              <p className="muted">Le délai de {PARAMS.dureeHoldMinutes} minutes est écoulé : le stock a été libéré.</p>
              <button className="btn" onClick={() => { setReste(PARAMS.dureeHoldMinutes * 60); setEtape("recap"); }}>Recommencer</button>
            </>
          ) : (
            <>
              <h3>Mode de paiement</h3>
              <div className="field">
                <label htmlFor="mode">Choisissez un mode</label>
                <select id="mode" value={mode} onChange={(e) => setMode(e.target.value)} disabled={etape === "hold"}>
                  {MODES.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>

              {etape === "hold" && (
                <div className="notice" style={{ marginBottom: 12 }}>
                  Stock bloqué pour vous pendant <strong>{mm}:{ss}</strong>. Finalisez le paiement avant l'expiration.
                </div>
              )}

              {etape === "recap" ? (
                <button className="btn" onClick={() => setEtape("hold")}>Bloquer le stock et payer</button>
              ) : (
                <div className="row">
                  <button
                    className="btn"
                    onClick={() => { setRef("LC-" + Date.now().toString(36).toUpperCase()); setEtape("paye"); vider(); }}
                  >
                    Simuler le paiement de {fcfa(total)}
                  </button>
                  <button className="btn secondary" onClick={() => setEtape("recap")}>Annuler</button>
                </div>
              )}
              <p className="muted" style={{ fontSize: ".8rem" }}>Maquette : aucun vrai paiement. En production, la confirmation vient du webhook du prestataire.</p>
            </>
          )}
        </div>

        <aside className="card">
          <h3>Récapitulatif</h3>
          <div className="total-row"><span>Locations</span><span>{fcfa(sousTotal)}</span></div>
          <div className="total-row"><span>Cautions</span><span>{fcfa(caution)}</span></div>
          <div className="total-row big"><span>Total</span><span>{fcfa(total)}</span></div>
        </aside>
      </div>
    </div>
  );
}
