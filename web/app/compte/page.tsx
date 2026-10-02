import { fcfa, getProduit, PARAMS } from "@/lib/data";

export const metadata = { title: "Mon compte — LOC'CONNECT" };

const reservations = [
  { ref: "LC-X1Y2", produit: "p5", qte: 1, periode: "12 → 14 oct.", statut: "CONFIRMÉE", total: 340000, caution: 250000, modifiable: true },
  { ref: "LC-Z3W4", produit: "p3", qte: 2, periode: "20 → 21 sept.", statut: "TERMINÉE", total: 70000, caution: 100000, modifiable: false },
];

export default function Compte() {
  return (
    <div className="container section">
      <h1>Mon compte</h1>
      <div className="card" style={{ marginBottom: 20 }}>
        <strong>Konan Y.</strong> <span className="tag gray">Client</span>
        <div className="muted">konan@example.ci · Abidjan – Cocody</div>
      </div>

      <h2>Mes réservations</h2>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {reservations.map((r) => {
          const p = getProduit(r.produit);
          return (
            <div className="card" key={r.ref}>
              <div className="row spread">
                <strong>{r.ref}</strong>
                <span className={r.statut === "CONFIRMÉE" ? "tag ok" : "tag gray"}>{r.statut}</span>
              </div>
              <p style={{ margin: "8px 0" }}>{p?.emoji} {p?.nom} × {r.qte}<br /><span className="muted">{r.periode}</span></p>
              <div className="total-row"><span>Total payé</span><span>{fcfa(r.total)}</span></div>
              <div className="total-row"><span>Caution</span><span>{r.statut === "TERMINÉE" ? "Libérée" : fcfa(r.caution)}</span></div>
              {r.modifiable ? (
                <>
                  <button className="btn secondary block" style={{ marginTop: 10 }}>Demander une modification</button>
                  <p className="muted" style={{ fontSize: ".78rem", marginBottom: 0 }}>
                    Possible jusqu'à {PARAMS.delaiModificationHeures} h avant le début. Le loueur doit valider (réponse sous 2 h).
                  </p>
                </>
              ) : (
                <button className="btn secondary block" style={{ marginTop: 10 }}>Laisser un avis</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
