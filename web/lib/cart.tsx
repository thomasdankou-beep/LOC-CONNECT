"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getProduit, nbJours, PARAMS } from "./data";

export type LignePanier = { produitId: string; quantite: number; debut: string; fin: string };

type CartCtx = {
  lignes: LignePanier[];
  ajouter: (l: LignePanier) => void;
  retirer: (index: number) => void;
  vider: () => void;
  pret: boolean;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "locconnect-panier";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lignes, setLignes] = useState<LignePanier[]>([]);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLignes(JSON.parse(raw));
    } catch {}
    setPret(true);
  }, []);

  useEffect(() => {
    if (!pret) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(lignes));
    } catch {}
  }, [lignes, pret]);

  return (
    <Ctx.Provider
      value={{
        lignes,
        pret,
        ajouter: (l) => setLignes((prev) => [...prev, l]),
        retirer: (i) => setLignes((prev) => prev.filter((_, idx) => idx !== i)),
        vider: () => setLignes([]),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart hors CartProvider");
  return c;
}

// Calcul indicatif côté maquette. En production : calcul exclusivement côté serveur (cahier des charges §19).
export function calculerLigne(l: LignePanier) {
  const p = getProduit(l.produitId);
  if (!p) return null;
  const jours = nbJours(l.debut, l.fin);
  const sousTotal = p.prixUnitaire * l.quantite * jours;
  return {
    produit: p,
    jours,
    sousTotal,
    commission: sousTotal * PARAMS.tauxCommission,
    caution: p.caution * l.quantite,
  };
}
