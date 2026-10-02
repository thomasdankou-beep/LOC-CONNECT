import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { categories, produits, villes } from "@/lib/data";

export default function Accueil() {
  const alaUne = produits.filter((p) => p.miseEnAvant);
  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>Louez le matériel dont vous avez besoin, auprès de loueurs de confiance.</h1>
          <p className="muted">Un seul panier, un seul paiement, même avec plusieurs loueurs. Caution sécurisée.</p>
          <form className="search" action="/produits">
            <input name="q" placeholder="Que cherchez-vous ? (bétonnière, sono, chaises…)" />
            <select name="ville" defaultValue="">
              <option value="">Toutes les villes</option>
              {villes.map((v) => (
                <option key={v.id} value={v.id}>{v.nom}</option>
              ))}
            </select>
            <button className="btn" type="submit">Rechercher</button>
          </form>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2>Catégories</h2>
          <div className="chips">
            {categories.map((c) => (
              <Link key={c.id} href={`/produits?categorie=${c.id}`} className="chip">
                {c.icone} {c.nom}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="row spread">
            <h2>À la une</h2>
            <Link href="/produits" className="muted">Tout voir →</Link>
          </div>
          <div className="grid">
            {alaUne.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2>Comment ça marche</h2>
          <div className="grid">
            <div className="card"><h3>1. Cherchez</h3><p className="muted">Filtrez par catégorie, ville et dates pour voir ce qui est disponible.</p></div>
            <div className="card"><h3>2. Réservez</h3><p className="muted">Ajoutez plusieurs articles, même de loueurs différents, dans un seul panier.</p></div>
            <div className="card"><h3>3. Payez une fois</h3><p className="muted">Un paiement unique, réparti automatiquement entre les loueurs.</p></div>
            <div className="card"><h3>4. Restituez</h3><p className="muted">Constat de retour, puis libération de la caution selon l'état du matériel.</p></div>
          </div>
        </div>
      </section>
    </>
  );
}
