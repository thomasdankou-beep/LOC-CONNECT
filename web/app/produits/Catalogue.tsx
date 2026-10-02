"use client";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import { categories, produits, villes } from "@/lib/data";

type Tri = "pertinence" | "prix-asc" | "prix-desc";
const PAR_PAGE = 6;

export default function Catalogue() {
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [categorie, setCategorie] = useState(sp.get("categorie") ?? "");
  const [ville, setVille] = useState(sp.get("ville") ?? "");
  const [tri, setTri] = useState<Tri>("pertinence");
  const [page, setPage] = useState(1);

  const resultats = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const liste = produits.filter(
      (p) =>
        (!needle || p.nom.toLowerCase().includes(needle) || p.description.toLowerCase().includes(needle)) &&
        (!categorie || p.categorie === categorie) &&
        (!ville || p.ville === ville),
    );
    if (tri === "prix-asc") liste.sort((a, b) => a.prixUnitaire - b.prixUnitaire);
    else if (tri === "prix-desc") liste.sort((a, b) => b.prixUnitaire - a.prixUnitaire);
    else liste.sort((a, b) => Number(!!b.miseEnAvant) - Number(!!a.miseEnAvant));
    return liste;
  }, [q, categorie, ville, tri]);

  const nbPages = Math.max(1, Math.ceil(resultats.length / PAR_PAGE));
  const courante = Math.min(page, nbPages);
  const visibles = resultats.slice((courante - 1) * PAR_PAGE, courante * PAR_PAGE);
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  return (
    <>
      <div className="filters">
        <input placeholder="Rechercher…" value={q} onChange={(e) => reset(setQ)(e.target.value)} aria-label="Recherche" />
        <select value={categorie} onChange={(e) => reset(setCategorie)(e.target.value)} aria-label="Catégorie">
          <option value="">Toutes catégories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <select value={ville} onChange={(e) => reset(setVille)(e.target.value)} aria-label="Ville">
          <option value="">Toutes villes</option>
          {villes.map((v) => <option key={v.id} value={v.id}>{v.nom}</option>)}
        </select>
        <select value={tri} onChange={(e) => setTri(e.target.value as Tri)} aria-label="Tri">
          <option value="pertinence">Pertinence</option>
          <option value="prix-asc">Prix croissant</option>
          <option value="prix-desc">Prix décroissant</option>
        </select>
      </div>

      <p className="muted">{resultats.length} résultat{resultats.length > 1 ? "s" : ""}</p>
      {visibles.length === 0 ? (
        <div className="card">Aucun équipement ne correspond à votre recherche.</div>
      ) : (
        <div className="grid">{visibles.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      )}

      {nbPages > 1 && (
        <div className="row" style={{ marginTop: 20, justifyContent: "center" }}>
          <button className="btn secondary" disabled={courante === 1} onClick={() => setPage(courante - 1)}>← Précédent</button>
          <span className="muted">Page {courante} / {nbPages}</span>
          <button className="btn secondary" disabled={courante === nbPages} onClick={() => setPage(courante + 1)}>Suivant →</button>
        </div>
      )}
    </>
  );
}
