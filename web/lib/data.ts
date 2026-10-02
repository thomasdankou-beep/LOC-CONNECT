// Données factices pour la maquette. Seront remplacées par l'API (GET /products, /categories, /cities).

export type Categorie = { id: string; nom: string; icone: string };
export type Ville = { id: string; nom: string };
export type Loueur = { id: string; nom: string; ville: string; note: number; avis: number; valide: boolean };
export type Produit = {
  id: string;
  nom: string;
  description: string;
  prixUnitaire: number; // FCFA par jour
  unite: "jour";
  caution: number; // par unité
  stock: number;
  categorie: string;
  ville: string;
  loueurId: string;
  emoji: string;
  miseEnAvant?: boolean;
  facturationComplementaire: boolean; // PRODUIT.autorise_facturation_complementaire
};

export const categories: Categorie[] = [
  { id: "btp", nom: "BTP & chantier", icone: "🏗️" },
  { id: "evenementiel", nom: "Événementiel", icone: "🎪" },
  { id: "sono", nom: "Son & lumière", icone: "🔊" },
  { id: "outillage", nom: "Outillage", icone: "🔧" },
  { id: "transport", nom: "Transport & manutention", icone: "🚚" },
  { id: "jardin", nom: "Jardin & nettoyage", icone: "🌿" },
];

export const villes: Ville[] = [
  { id: "cocody", nom: "Abidjan – Cocody" },
  { id: "marcory", nom: "Abidjan – Marcory" },
  { id: "yopougon", nom: "Abidjan – Yopougon" },
  { id: "bingerville", nom: "Bingerville" },
];

export const loueurs: Loueur[] = [
  { id: "l1", nom: "Abidjan Matériel Pro", ville: "cocody", note: 4.7, avis: 38, valide: true },
  { id: "l2", nom: "Events Ivoire", ville: "marcory", note: 4.5, avis: 21, valide: true },
  { id: "l3", nom: "Sono Plus CI", ville: "yopougon", note: 4.8, avis: 54, valide: true },
  { id: "l4", nom: "Outils & Co", ville: "bingerville", note: 4.2, avis: 9, valide: true },
];

export const produits: Produit[] = [
  { id: "p1", nom: "Bétonnière 350 L", description: "Bétonnière électrique 350 litres, idéale pour les petits et moyens chantiers. Livrée propre, avec câble.", prixUnitaire: 15000, unite: "jour", caution: 100000, stock: 4, categorie: "btp", ville: "cocody", loueurId: "l1", emoji: "🏗️", miseEnAvant: true, facturationComplementaire: true },
  { id: "p2", nom: "Échafaudage 6 m (kit)", description: "Kit d'échafaudage modulaire jusqu'à 6 m de hauteur, garde-corps et plateaux inclus.", prixUnitaire: 25000, unite: "jour", caution: 200000, stock: 3, categorie: "btp", ville: "cocody", loueurId: "l1", emoji: "🪜", facturationComplementaire: true },
  { id: "p3", nom: "Chaises pliantes (lot de 50)", description: "Lot de 50 chaises pliantes blanches pour mariages, baptêmes et séminaires.", prixUnitaire: 10000, unite: "jour", caution: 50000, stock: 12, categorie: "evenementiel", ville: "marcory", loueurId: "l2", emoji: "🪑", miseEnAvant: true, facturationComplementaire: false },
  { id: "p4", nom: "Bâche / chapiteau 6×12 m", description: "Chapiteau structure alu avec bâche blanche. Montage possible sur demande.", prixUnitaire: 80000, unite: "jour", caution: 300000, stock: 2, categorie: "evenementiel", ville: "marcory", loueurId: "l2", emoji: "⛺", facturationComplementaire: true },
  { id: "p5", nom: "Sonorisation 2 × 1000 W", description: "Paire d'enceintes actives, console 8 voies, 2 micros sans fil et câblage.", prixUnitaire: 45000, unite: "jour", caution: 250000, stock: 5, categorie: "sono", ville: "yopougon", loueurId: "l3", emoji: "🔊", miseEnAvant: true, facturationComplementaire: true },
  { id: "p6", nom: "Jeu de lumières DJ", description: "4 projecteurs LED, laser et machine à fumée pour vos soirées.", prixUnitaire: 30000, unite: "jour", caution: 150000, stock: 6, categorie: "sono", ville: "yopougon", loueurId: "l3", emoji: "💡", facturationComplementaire: true },
  { id: "p7", nom: "Perceuse à percussion Bosch", description: "Perceuse 850 W avec coffret de forets béton, métal et bois.", prixUnitaire: 5000, unite: "jour", caution: 40000, stock: 8, categorie: "outillage", ville: "bingerville", loueurId: "l4", emoji: "🛠️", facturationComplementaire: false },
  { id: "p8", nom: "Groupe électrogène 5 kVA", description: "Groupe silencieux 5 kVA, démarrage électrique, autonomie 8 h.", prixUnitaire: 35000, unite: "jour", caution: 250000, stock: 3, categorie: "outillage", ville: "bingerville", loueurId: "l4", emoji: "⚡", miseEnAvant: true, facturationComplementaire: true },
  { id: "p9", nom: "Diable de manutention", description: "Diable renforcé 300 kg avec sangles. Parfait pour déménagements.", prixUnitaire: 4000, unite: "jour", caution: 30000, stock: 10, categorie: "transport", ville: "cocody", loueurId: "l1", emoji: "🛒", facturationComplementaire: false },
  { id: "p10", nom: "Nettoyeur haute pression", description: "Nettoyeur 150 bars, 2 200 W, avec flexible de 10 m et lance.", prixUnitaire: 12000, unite: "jour", caution: 80000, stock: 5, categorie: "jardin", ville: "yopougon", loueurId: "l3", emoji: "🚿", facturationComplementaire: true },
];

export const getProduit = (id: string) => produits.find((p) => p.id === id);
export const getLoueur = (id: string) => loueurs.find((l) => l.id === id);
export const getVille = (id: string) => villes.find((v) => v.id === id)?.nom ?? id;
export const getCategorie = (id: string) => categories.find((c) => c.id === id);

// Paramètres commerciaux (à valider, cf. cahier des charges §16 — jamais codés en dur dans la vraie app)
export const PARAMS = {
  tauxCommission: 0.1, // TODO: à définir par LOC'CONNECT
  dureeHoldMinutes: 15,
  delaiGelHeures: 72,
  delaiModificationHeures: 24,
};

export const fcfa = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";

export function nbJours(debut: string, fin: string): number {
  if (!debut || !fin) return 0;
  const d = (new Date(fin).getTime() - new Date(debut).getTime()) / 86_400_000;
  return d > 0 ? Math.ceil(d) : 0;
}
