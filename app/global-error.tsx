"use client";

/** Dernier recours : remplace tout le document, donc sans dépendance au reste de l'interface. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f6fc", color: "#0d1a3a", textAlign: "center", padding: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>LOC&apos;CONNECT est momentanément indisponible</h1>
          <p style={{ color: "#51607f", marginTop: 12 }}>Une erreur inattendue s&apos;est produite. Vos données sont en sécurité.</p>
          <button onClick={reset} style={{ marginTop: 24, height: 48, padding: "0 24px", borderRadius: 10, border: 0, background: "#1d4ed8", color: "white", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>Réessayer</button>
        </div>
      </body>
    </html>
  );
}
