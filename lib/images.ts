/**
 * Photographies de démonstration (Unsplash, licence libre). Ce sont des photos d'illustration : en production, chaque loueur
 * téléverse ses propres photos de produits (stockage local ou S3). Les URL sont redimensionnées à la demande par le CDN.
 */
export const unsplash = (id: string, w = 1200, h = 900) => `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=75&auto=format`;

const P = {
  salle: "1519167758481-83f550bb49b3",
  tableFleurs: "1519225421980-715cb0215aed",
  chapiteau: "1464366400600-7168b8af9bc3",
  chaisesPelouse: "1522673607200-164d1b6ce486",
  arche: "1523438885200-e635ba2c371e",
  vaisselle: "1511795409834-ef04bbd61622",
  verres: "1519671482749-fd09be7ccebf",
  guitare: "1598387993441-a364f854c3e1",
  dj: "1470225620780-dba8ba36b745",
  concert: "1516450360452-9312f5e86fc7",
  scene: "1429962714451-bb934ecdc4ec",
  confettis: "1492684223066-81342ee5ff30",
  ballons: "1530103862676-de8c9debad1d",
  canape: "1493663284031-b7e3aefcae8e",
  canapeVert: "1555041469-a586c61ea9bc",
  fauteuil: "1586023492125-27b2c045efd7",
  chantier: "1541888946425-d81bb19240f5",
  chantierOuvriers: "1504307651254-35680f356dfd",
  perceuse: "1504148455328-c376907d081c",
  marteau: "1586864387967-d02ef85d93e8",
  outils: "1530124566582-a618bc2615dc",
  camion: "1601584115197-04ecc0da31d7",
  parking: "1565793298595-6a879b1d9492",
  casque: "1583394838336-acd977736f90",
  technicien: "1581091226825-a6a2a5aee158",
} as const;

/** Photos associées à chaque sous-catégorie (3 par produit, choisies parmi ce jeu). */
export const SUBCATEGORY_PHOTOS: Record<string, string[]> = {
  "Tables": [P.salle, P.tableFleurs, P.vaisselle],
  "Chaises": [P.chaisesPelouse, P.salle, P.chapiteau],
  "Chapiteaux": [P.chapiteau, P.salle, P.arche],
  "Tentes et barnums": [P.chapiteau, P.arche, P.chaisesPelouse],
  "Assiettes et couverts": [P.vaisselle, P.tableFleurs, P.verres],
  "Verres et carafes": [P.verres, P.vaisselle, P.tableFleurs],
  "Enceintes et amplis": [P.guitare, P.dj, P.concert],
  "Micros et consoles": [P.dj, P.casque, P.guitare],
  "Éclairage de scène": [P.concert, P.scene, P.confettis],
  "Guirlandes et ambiance": [P.ballons, P.confettis, P.scene],
  "Arches et fleurs": [P.arche, P.chaisesPelouse, P.tableFleurs],
  "Nappes et housses": [P.tableFleurs, P.chapiteau, P.salle],
  "Canapés": [P.canape, P.canapeVert, P.fauteuil],
  "Tables basses et poufs": [P.fauteuil, P.canape, P.canapeVert],
  "Bétonnières et compacteurs": [P.chantierOuvriers, P.chantier, P.outils],
  "Échafaudages": [P.chantier, P.chantierOuvriers, P.technicien],
  "Groupes électrogènes": [P.chantier, P.technicien, P.perceuse],
  "Outillage électroportatif": [P.perceuse, P.marteau, P.outils],
  "Véhicules utilitaires": [P.camion, P.parking, P.chantier],
  "Manutention": [P.parking, P.camion, P.marteau],
};

export const CATEGORY_PHOTO: Record<string, string> = {
  "Tables et chaises": P.salle,
  "Chapiteaux et tentes": P.chapiteau,
  "Vaisselle et art de la table": P.vaisselle,
  "Sonorisation": P.guitare,
  "Éclairage": P.concert,
  "Décoration": P.arche,
  "Mobilier lounge": P.canapeVert,
  "Matériel de chantier": P.chantier,
  "Outillage et énergie": P.perceuse,
  "Transport et manutention": P.camion,
};

export const COVER_PHOTOS = [P.salle, P.chapiteau, P.concert, P.chantier, P.canape, P.arche, P.dj, P.parking];

export const IMAGES = {
  heroMain: unsplash(P.tableFleurs, 900, 1100),
  heroSide: unsplash(P.chapiteau, 700, 520),
  heroSmall: unsplash(P.chaisesPelouse, 700, 520),
  becomeLender: unsplash(P.parking, 1200, 900),
  trust: unsplash(P.technicien, 900, 700),
  auth: unsplash(P.salle, 1000, 1400),
};

export const categoryPhoto = (name: string, w = 900, h = 700) => unsplash(CATEGORY_PHOTO[name] ?? P.salle, w, h);
