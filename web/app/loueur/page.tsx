import { fcfa, getProduit, PARAMS, produits } from "@/lib/data";

export const metadata = { title: "Espace loueur — LOC'CONNECT" };

const reservations = [
  { ref: "LC-A1B2", client: "Kouassi A.", produit: "p1", qte: 1, periode: "05 → 08 oct.", statut: "CONFIRMÉE", montant: 45000 },
  { ref: "LC-C3D4", client: "Traoré M.", produit: "p2", qte: 1, periode: "02 → 04 oct.", statut: "EN COURS", montant: 50000 },
  { ref: "LC-E5F6", client: "Yao B.", produit: "p9", qte: 3, periode: "28 → 30 sept.", statut: "RETOUR À CONSTATER", montant: 24000 },
];
const versements = [
  { ref: "LC-G7H8", montant: 90000, statut: "Gelé", date: "Versement prévu le 06 oct." },
  { ref: "LC-I9J0", montant: 36000, statut: "Prêt à verser", date: "Prévu le 03 oct." },
  { ref: "LC-K1L2", montant: 120000, statut: "Versé", date: "Versé le 27 sept." },
];

const tagStatut = (s: string) => (s === "CONFIRMÉE" ? "tag ok" : s === "EN COURS" ? "tag" : "tag warn");
const tagVersement = (s: string) => (s === "Versé" ? "tag ok" : s === "Gelé" ? "tag warn" : "tag");

export default function EspaceLoueur() {
  const mesProduits = produits.filter((p) => p.loueurId === "l1");
  return (
    <div className="container section">
      <div className="row spread">
        <h1>Espace loueur — Abidjan Matériel Pro</h1>
        <span className="tag ok">Compte validé</span>
      </div>

      <div className="kpis">
        <div className="card kpi"><div className="muted">Réservations actives</div><div className="value">2</div></div>
        <div className="card kpi"><div className="muted">Retours à constater</div><div className="value">1</div></div>
        <div className="card kpi"><div className="muted">Montants gelés</div><div className="value">{fcfa(90000)}</div></div>
        <div className="card kpi"><div className="muted">Versements prêts</div><div className="value">{fcfa(36000)}</div></div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Réservations</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Réf.</th><th>Client</th><th>Article</th><th>Période</th><th>Statut</th><th>Montant</th></tr></thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.ref}>
                  <td>{r.ref}</td><td>{r.client}</td>
                  <td>{getProduit(r.produit)?.nom} × {r.qte}</td>
                  <td>{r.periode}</td>
                  <td><span className={tagStatut(r.statut)}>{r.statut}</span></td>
                  <td>{fcfa(r.montant)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="two-col" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <h3>Mon stock</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Produit</th><th>Stock</th><th>Prix/jour</th></tr></thead>
              <tbody>
                {mesProduits.map((p) => (
                  <tr key={p.id}><td>{p.emoji} {p.nom}</td><td>{p.stock}</td><td>{fcfa(p.prixUnitaire)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3>Versements</h3>
          <p className="muted" style={{ fontSize: ".85rem" }}>
            Versé {PARAMS.delaiGelHeures} h après la fin de la location, le temps de la fenêtre de contestation.
          </p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Réf.</th><th>Montant</th><th>Statut</th></tr></thead>
              <tbody>
                {versements.map((v) => (
                  <tr key={v.ref}>
                    <td>{v.ref}<div className="muted" style={{ fontSize: ".75rem" }}>{v.date}</div></td>
                    <td>{fcfa(v.montant)}</td>
                    <td><span className={tagVersement(v.statut)}>{v.statut}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
