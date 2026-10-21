import { Suspense } from "react";
import Catalogue from "./Catalogue";

export const metadata = { title: "Catalogue — LOC'CONNECT" };

export default function Page() {
  return (
    <div className="container section">
      <h1>Catalogue</h1>
      <Suspense fallback={<p className="muted">Chargement…</p>}>
        <Catalogue />
      </Suspense>
    </div>
  );
}
