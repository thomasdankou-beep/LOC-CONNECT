import Link from "next/link";
import { notFound } from "next/navigation";
import { fcfa, getCategorie, getLoueur, getProduit, getVille } from "@/lib/data";
import Reservation from "./Reservation";

export default async function FicheProduit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getProduit(id);
  if (!p) notFound();
  const loueur = getLoueur(p.loueurId);

  return (
    <div className="container section">
      <p><Link href="/produits" className="muted">← Retour au catalogue</Link></p>
      <div className="two-col">
        <div>
          <div className="card product-thumb" style={{ height: 280, fontSize: "6rem" }}>{p.emoji}</div>
          <div className="row" style={{ marginTop: 16 }}>
            <span className="tag">{getCategorie(p.categorie)?.nom}</span>
            <span className="tag gray">{getVille(p.ville)}</span>
            {p.miseEnAvant && <span className="tag warn">À la une</span>}
          </div>
          <h1 style={{ marginTop: 10 }}>{p.nom}</h1>
          <p>{p.description}</p>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Tarifs et caution</h3>
            <div className="total-row"><span>Prix par jour</span><strong>{fcfa(p.prixUnitaire)}</strong></div>
            <div className="total-row"><span>Caution par unité</span><strong>{fcfa(p.caution)}</strong></div>
            <p className="muted" style={{ fontSize: ".85rem", marginBottom: 0 }}>
              {p.facturationComplementaire
                ? "En cas de dommage supérieur à la caution, le complément peut être facturé."
                : "En cas de dommage, la retenue est plafonnée au montant de la caution."}
            </p>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Loueur</h3>
            <strong>{loueur?.nom}</strong> <span className="tag ok">Validé</span>
            <div className="muted">★ {loueur?.note} ({loueur?.avis} avis) · {getVille(loueur?.ville ?? "")}</div>
          </div>
        </div>

        <Reservation produitId={p.id} prix={p.prixUnitaire} caution={p.caution} stock={p.stock} />
      </div>
    </div>
  );
}
