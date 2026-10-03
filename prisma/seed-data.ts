// Données de démonstration fictives (noms inventés, aucune entreprise réelle).

export const CITIES = [
  { name: "Cocody", region: "District d'Abidjan" },
  { name: "Plateau", region: "District d'Abidjan" },
  { name: "Marcory", region: "District d'Abidjan" },
  { name: "Yopougon", region: "District d'Abidjan" },
  { name: "Koumassi", region: "District d'Abidjan" },
  { name: "Bingerville", region: "District d'Abidjan" },
  { name: "Bouaké", region: "Vallée du Bandama" },
  { name: "Yamoussoukro", region: "Yamoussoukro" },
  { name: "San-Pédro", region: "Bas-Sassandra" },
  { name: "Korhogo", region: "Savanes" },
];

export type CategorySeed = { name: string; icon: string; description: string; children: string[] };

export const CATEGORIES: CategorySeed[] = [
  { name: "Tables et chaises", icon: "Armchair", description: "Tables, chaises et assises pour mariages, séminaires et fêtes.", children: ["Tables", "Chaises"] },
  { name: "Chapiteaux et tentes", icon: "Tent", description: "Chapiteaux, barnums et tentes de réception.", children: ["Chapiteaux", "Tentes et barnums"] },
  { name: "Vaisselle et art de la table", icon: "ForkKnife", description: "Assiettes, couverts, verres et matériel de buffet.", children: ["Assiettes et couverts", "Verres et carafes"] },
  { name: "Sonorisation", icon: "SpeakerHigh", description: "Enceintes, amplis, consoles et micros.", children: ["Enceintes et amplis", "Micros et consoles"] },
  { name: "Éclairage", icon: "Lightbulb", description: "Éclairage de scène, projecteurs et guirlandes.", children: ["Éclairage de scène", "Guirlandes et ambiance"] },
  { name: "Décoration", icon: "Flower", description: "Arches, nappes, housses et décors de réception.", children: ["Arches et fleurs", "Nappes et housses"] },
  { name: "Mobilier lounge", icon: "Couch", description: "Canapés, poufs et tables basses pour espaces détente.", children: ["Canapés", "Tables basses et poufs"] },
  { name: "Matériel de chantier", icon: "HardHat", description: "Bétonnières, compacteurs, échafaudages.", children: ["Bétonnières et compacteurs", "Échafaudages"] },
  { name: "Outillage et énergie", icon: "Wrench", description: "Groupes électrogènes et outillage électroportatif.", children: ["Groupes électrogènes", "Outillage électroportatif"] },
  { name: "Transport et manutention", icon: "Truck", description: "Utilitaires, diables, transpalettes.", children: ["Véhicules utilitaires", "Manutention"] },
];

// [nom, sous-catégorie, description, prix par jour, stock, caution unitaire, prix de remboursement unitaire, facturation complémentaire]
export type ProductSeed = [string, string, string, number, number, number, number, boolean];

export type LenderSeed = {
  company: string;
  city: string;
  owner: [string, string];
  description: string;
  status?: "APPROVED" | "PENDING";
  plan?: "FREE" | "PRO" | "PREMIUM";
  deliveryLocal: number;
  deliveryRemote: number;
  offersDelivery?: boolean;
  products: ProductSeed[];
};

export const LENDERS: LenderSeed[] = [
  {
    company: "Abidjan Événements Prestige", city: "Cocody", owner: ["Brou", "Kouamé"], plan: "PRO", deliveryLocal: 5000, deliveryRemote: 12000,
    description: "Location de mobilier de réception pour mariages, baptêmes et cérémonies d'entreprise. Livraison, montage et reprise sur Abidjan.",
    products: [
      ["Table ronde 10 personnes", "Tables", "Table ronde de 1,8 m de diamètre en bois et métal, pliable, idéale pour les repas assis de 10 convives.", 5000, 40, 10000, 45000, true],
      ["Table rectangulaire 8 personnes", "Tables", "Table rectangulaire de 1,8 m avec plateau stratifié résistant et pieds pliants, livrée propre.", 3500, 60, 7000, 30000, true],
      ["Chaise Napoléon blanche", "Chaises", "Chaise Napoléon en résine blanche, empilable, très appréciée pour les mariages. Prix par chaise.", 800, 400, 1500, 12000, true],
      ["Chaise pliante blanche", "Chaises", "Chaise pliante en métal et plastique blanc, légère et robuste, pour séminaires et fêtes de quartier.", 400, 600, 1000, 7000, false],
    ],
  },
  {
    company: "Cocody Réception", city: "Cocody", owner: ["Aminata", "Koné"], plan: "PREMIUM", deliveryLocal: 15000, deliveryRemote: 40000,
    description: "Spécialiste des chapiteaux et tentes de réception. Équipe de montage incluse sur demande dans le Grand Abidjan.",
    products: [
      ["Chapiteau 6 x 12 m", "Chapiteaux", "Chapiteau à structure aluminium avec bâche blanche ignifugée, 72 m², pour 60 à 80 invités.", 120000, 6, 250000, 1800000, true],
      ["Chapiteau 10 x 20 m", "Chapiteaux", "Grand chapiteau de 200 m² avec parois latérales, pour 150 à 200 invités. Montage par nos équipes.", 280000, 3, 500000, 4200000, true],
      ["Tente pliante 3 x 3 m", "Tentes et barnums", "Tente pliante à ossature acier, toit imperméable. Pratique pour stands, marchés et buvettes.", 15000, 25, 30000, 120000, false],
      ["Barnum 5 x 8 m", "Tentes et barnums", "Barnum robuste de 40 m² avec lestage fourni, idéal pour cérémonies en plein air.", 70000, 10, 120000, 900000, true],
    ],
  },
  {
    company: "Plateau Mobilier Pro", city: "Plateau", owner: ["Salif", "Konaté"], plan: "PRO", deliveryLocal: 8000, deliveryRemote: 20000,
    description: "Mobilier lounge et assises premium pour événements d'entreprise, cocktails et soirées privées au Plateau et à Cocody.",
    products: [
      ["Canapé lounge 3 places", "Canapés", "Canapé 3 places en simili cuir blanc cassé, entretenu après chaque location.", 25000, 12, 50000, 350000, true],
      ["Canapé d'angle modulable", "Canapés", "Canapé d'angle 5 places modulable en tissu gris anthracite, avec coussins.", 45000, 6, 90000, 650000, true],
      ["Pouf rond en velours", "Tables basses et poufs", "Pouf rond de 45 cm en velours côtelé, coloris au choix dans la limite du stock.", 4000, 40, 8000, 35000, false],
      ["Table basse en bois clair", "Tables basses et poufs", "Table basse rectangulaire en bois clair massif, 110 x 60 cm, pour espaces détente.", 9000, 20, 18000, 90000, true],
    ],
  },
  {
    company: "Yop Sono Service", city: "Yopougon", owner: ["Ismaël", "Traoré"], plan: "PRO", deliveryLocal: 10000, deliveryRemote: 25000,
    description: "Sonorisation pour concerts, mariages et conférences. Technicien disponible sur demande, matériel testé avant chaque départ.",
    products: [
      ["Sonorisation 2 x 1000 W", "Enceintes et amplis", "Paire d'enceintes actives 2 x 1000 W avec pieds, câbles et console 8 voies. Pour 150 personnes.", 55000, 8, 200000, 1200000, true],
      ["Enceinte active 15 pouces", "Enceintes et amplis", "Enceinte amplifiée 15 pouces, 800 W, entrées XLR et jack, avec housse de transport.", 25000, 14, 90000, 450000, true],
      ["Console de mixage 12 voies", "Micros et consoles", "Console analogique 12 voies avec effets intégrés et alimentation fantôme.", 20000, 6, 80000, 380000, true],
      ["Micro sans fil double", "Micros et consoles", "Deux micros main sans fil UHF avec récepteur, piles incluses. Portée 50 m.", 15000, 12, 60000, 260000, false],
    ],
  },
  {
    company: "Lagune Décor", city: "Marcory", owner: ["Adèle", "Yao"], deliveryLocal: 4000, deliveryRemote: 10000,
    description: "Décoration de salles et de cérémonies : arches, nappes, housses et compositions florales artificielles de qualité.",
    products: [
      ["Arche de mariage florale", "Arches et fleurs", "Arche en métal blanc de 2,4 m habillée de fleurs artificielles blanches et vertes, prête à poser.", 35000, 8, 70000, 380000, true],
      ["Arche ronde dorée", "Arches et fleurs", "Arche ronde de 2 m de diamètre en métal doré, pour cérémonies et photos.", 25000, 6, 50000, 280000, true],
      ["Nappe ronde en satin", "Nappes et housses", "Nappe ronde de 3 m en satin, plusieurs coloris disponibles. Lavée et repassée.", 3000, 120, 3000, 15000, false],
      ["Housse de chaise stretch", "Nappes et housses", "Housse de chaise extensible blanche avec noeud en option, convient aux chaises standard.", 500, 500, 500, 3500, false],
    ],
  },
  {
    company: "Marcory Chapiteaux", city: "Marcory", owner: ["Désiré", "N'Guessan"], deliveryLocal: 12000, deliveryRemote: 35000,
    description: "Chapiteaux, podiums et tentes de réception pour tous types d'événements, avec montage et démontage.",
    products: [
      ["Chapiteau 8 x 15 m", "Chapiteaux", "Chapiteau de 120 m² en aluminium, bâche PVC blanche, pour 100 à 120 invités assis.", 180000, 5, 350000, 2600000, true],
      ["Tente de réception 5 x 10 m", "Tentes et barnums", "Tente de réception de 50 m² avec parois amovibles et sol protégé.", 85000, 8, 150000, 1100000, true],
      ["Podium modulable 2 x 1 m", "Chapiteaux", "Module de podium 2 x 1 m, hauteur réglable de 40 à 80 cm, surface antidérapante.", 12000, 30, 25000, 140000, true],
      ["Rideaux blancs pour chapiteau", "Chapiteaux", "Lot de rideaux blancs ignifugés pour habiller l'intérieur d'un chapiteau, 20 m linéaires.", 30000, 10, 40000, 220000, false],
    ],
  },
  {
    company: "Koumassi Matériel BTP", city: "Koumassi", owner: ["Mamadou", "Diallo"], deliveryLocal: 15000, deliveryRemote: 30000,
    description: "Location de matériel de chantier pour entreprises et particuliers : béton, compactage, échafaudage, avec dépannage rapide.",
    products: [
      ["Bétonnière 350 L", "Bétonnières et compacteurs", "Bétonnière électrique de 350 litres sur roues, robuste, câble de 10 m fourni.", 15000, 7, 100000, 650000, true],
      ["Plaque vibrante 90 kg", "Bétonnières et compacteurs", "Plaque vibrante thermique de 90 kg pour compactage de remblais, sable et pavés.", 35000, 4, 200000, 1400000, true],
      ["Échafaudage 6 m (kit complet)", "Échafaudages", "Kit d'échafaudage modulaire jusqu'à 6 m avec garde-corps, plateaux et stabilisateurs.", 25000, 9, 200000, 1100000, true],
      ["Échelle télescopique 5 m", "Échafaudages", "Échelle télescopique en aluminium de 5 m, charge maximale de 150 kg.", 6000, 15, 30000, 160000, false],
    ],
  },
  {
    company: "Bingerville Location Express", city: "Bingerville", owner: ["Constant", "Ouattara"], deliveryLocal: 7000, deliveryRemote: 20000,
    description: "Groupes électrogènes et outillage en location courte durée, avec livraison rapide sur Bingerville et Abidjan Est.",
    products: [
      ["Groupe électrogène 5 kVA", "Groupes électrogènes", "Groupe silencieux 5 kVA, démarrage électrique, autonomie de 8 heures à demi-charge.", 35000, 6, 250000, 1500000, true],
      ["Groupe électrogène 20 kVA", "Groupes électrogènes", "Groupe diesel 20 kVA triphasé sur châssis, idéal pour chantiers et grands événements.", 120000, 3, 600000, 5200000, true],
      ["Perceuse à percussion 850 W", "Outillage électroportatif", "Perceuse à percussion avec coffret de forets béton, métal et bois.", 5000, 20, 40000, 90000, false],
      ["Meuleuse 230 mm", "Outillage électroportatif", "Meuleuse d'angle 2200 W avec disques à tronçonner et à meuler fournis.", 6000, 12, 45000, 110000, false],
    ],
  },
  {
    company: "Bouaké Fêtes et Mobilier", city: "Bouaké", owner: ["Alphonse", "Bamba"], deliveryLocal: 6000, deliveryRemote: 25000,
    description: "Tout le nécessaire pour vos fêtes à Bouaké : tables, chaises, tentes et sonorisation de base.",
    products: [
      ["Table ronde 8 personnes", "Tables", "Table ronde pliante de 1,5 m, plateau stratifié, pieds acier. Prix par table.", 3500, 50, 7000, 28000, true],
      ["Chaise plastique empilable", "Chaises", "Chaise plastique blanche empilable, résistante au soleil et à la pluie.", 350, 800, 800, 6000, false],
      ["Tente 4 x 8 m", "Tentes et barnums", "Tente de réception 4 x 8 m, structure métal, toile blanche, lestage compris.", 50000, 12, 90000, 600000, true],
      ["Sono 1000 W avec micro", "Enceintes et amplis", "Système de sonorisation 1000 W : 2 enceintes, ampli, un micro filaire et câblage.", 35000, 6, 120000, 700000, true],
    ],
  },
  {
    company: "Yamoussoukro Events", city: "Yamoussoukro", owner: ["Odette", "Kouassi"], deliveryLocal: 6000, deliveryRemote: 28000,
    description: "Organisation et location de matériel pour la capitale : chapiteaux, chaises Chiavari, éclairage et ambiance.",
    products: [
      ["Chapiteau 5 x 10 m", "Chapiteaux", "Chapiteau de 50 m² aluminium et bâche blanche, pour 40 à 50 invités.", 75000, 8, 150000, 1000000, true],
      ["Chaise Chiavari dorée", "Chaises", "Chaise Chiavari dorée avec coussin ivoire, élégante pour mariages et galas.", 1200, 200, 3000, 25000, true],
      ["Projecteurs LED PAR (lot de 8)", "Éclairage de scène", "Lot de 8 projecteurs LED PAR RGB avec contrôleur DMX et câbles.", 30000, 6, 100000, 520000, true],
      ["Guirlande guinguette 20 m", "Guirlandes et ambiance", "Guirlande de 20 m avec 20 ampoules LED chaudes, utilisable en extérieur.", 8000, 30, 12000, 45000, false],
    ],
  },
  {
    company: "San-Pédro Équipements", city: "San-Pédro", owner: ["Fulgence", "Gnahoré"], deliveryLocal: 8000, deliveryRemote: 30000,
    description: "Matériel technique pour chantiers et industriels du port de San-Pédro : énergie, pompage, compression.",
    products: [
      ["Groupe électrogène 10 kVA", "Groupes électrogènes", "Groupe 10 kVA monophasé et triphasé, réservoir 30 L, démarrage électrique.", 60000, 5, 350000, 2400000, true],
      ["Compresseur 100 L", "Outillage électroportatif", "Compresseur d'air 100 litres, 3 CV, avec flexible et pistolet de gonflage.", 20000, 6, 120000, 600000, true],
      ["Pompe à eau immergée", "Outillage électroportatif", "Pompe immergée pour eaux chargées, débit 15 m3/h, tuyau de refoulement de 10 m.", 18000, 8, 90000, 420000, true],
      ["Nettoyeur haute pression", "Outillage électroportatif", "Nettoyeur 150 bars, 2200 W, avec flexible de 10 m et lance réglable.", 12000, 8, 80000, 330000, false],
    ],
  },
  {
    company: "Korhogo Location Plus", city: "Korhogo", owner: ["Seydou", "Coulibaly"], deliveryLocal: 5000, deliveryRemote: 25000,
    description: "Matériel de réception et de sonorisation pour le nord de la Côte d'Ivoire, à des tarifs accessibles.",
    products: [
      ["Table pliante 1,8 m", "Tables", "Table rectangulaire pliante de 1,8 m en plastique renforcé, légère et résistante.", 2500, 80, 5000, 25000, false],
      ["Chaise plastique blanche", "Chaises", "Chaise plastique blanche robuste, adaptée aux événements en extérieur.", 300, 700, 700, 5500, false],
      ["Barnum 3 x 6 m", "Tentes et barnums", "Barnum 3 x 6 m avec toit imperméable, idéal pour marchés et réceptions.", 30000, 12, 60000, 380000, true],
      ["Enceinte portable 300 W", "Enceintes et amplis", "Enceinte portable sur batterie avec micro sans fil, autonomie 6 heures.", 12000, 10, 50000, 240000, false],
    ],
  },
  {
    company: "Éclat Lumière CI", city: "Cocody", owner: ["Yannick", "Anoh"], plan: "PRO", deliveryLocal: 8000, deliveryRemote: 20000,
    description: "Éclairage scénique et effets pour soirées, concerts et mariages. Installation et régie lumière sur demande.",
    products: [
      ["Jeu de lumières DJ complet", "Éclairage de scène", "Quatre projecteurs LED, un laser, une boule à facettes et un contrôleur. Prêt à brancher.", 40000, 8, 150000, 800000, true],
      ["Lyres LED motorisées (lot de 4)", "Éclairage de scène", "Quatre lyres spot LED 150 W motorisées, contrôle DMX, pour scènes et grandes salles.", 90000, 4, 350000, 3200000, true],
      ["Machine à fumée 1500 W", "Éclairage de scène", "Machine à fumée 1500 W avec télécommande et réservoir de 2 litres, liquide fourni.", 12000, 10, 40000, 180000, false],
      ["Projecteur laser RGB", "Éclairage de scène", "Laser RGB 3 W animé, mode automatique et musical, pour ambiance de soirée.", 18000, 8, 90000, 450000, true],
    ],
  },
  {
    company: "Baobab Matériel de Traiteur", city: "Marcory", owner: ["Clarisse", "Tano"], deliveryLocal: 4000, deliveryRemote: 12000,
    description: "Vaisselle, couverts et verrerie pour traiteurs et particuliers, livrés propres et comptés avec vous à la remise.",
    products: [
      ["Assiettes plates blanches (lot de 50)", "Assiettes et couverts", "Lot de 50 assiettes plates blanches en porcelaine, 27 cm. Prix par lot.", 6000, 40, 15000, 60000, true],
      ["Couverts inox (lot de 50)", "Assiettes et couverts", "Lot de 50 couverts inox : fourchette, couteau et cuillère. Prix par lot.", 5000, 40, 12000, 50000, true],
      ["Verres à eau (lot de 50)", "Verres et carafes", "Lot de 50 verres à eau en verre trempé de 25 cl. Prix par lot.", 4000, 50, 10000, 40000, true],
      ["Flûtes à champagne (lot de 50)", "Verres et carafes", "Lot de 50 flûtes à champagne en verre de 16 cl, livrées en caisses de protection.", 5000, 30, 12000, 55000, true],
      ["Réchauds de buffet inox", "Assiettes et couverts", "Réchaud de buffet en inox avec bacs et brûleurs, pour 12 à 15 convives. Prix par réchaud.", 8000, 25, 20000, 90000, true],
    ],
  },
  {
    company: "Ivoire Outillage", city: "Yopougon", owner: ["Eugène", "Aka"], deliveryLocal: 6000, deliveryRemote: 18000,
    description: "Outillage électroportatif professionnel pour artisans et particuliers, entretenu et vérifié avant chaque location.",
    products: [
      ["Perforateur SDS-Plus 1200 W", "Outillage électroportatif", "Perforateur burineur 1200 W avec mallette et jeu de forets SDS-Plus.", 9000, 10, 60000, 220000, false],
      ["Scie circulaire 1400 W", "Outillage électroportatif", "Scie circulaire 1400 W, lame de 190 mm, guide parallèle et sac de transport.", 7000, 9, 45000, 150000, false],
      ["Tronçonneuse thermique 45 cc", "Outillage électroportatif", "Tronçonneuse thermique 45 cc, guide de 40 cm, avec huile de chaîne et équipements de base.", 15000, 6, 90000, 380000, true],
      ["Ponceuse à bande 1010 W", "Outillage électroportatif", "Ponceuse à bande 1010 W avec sac à poussière et bandes de rechange.", 6000, 8, 40000, 140000, false],
    ],
  },
  {
    company: "Atlantique Transport & Manutention", city: "Plateau", owner: ["Moussa", "Sangaré"], status: "PENDING", deliveryLocal: 10000, deliveryRemote: 25000,
    description: "Véhicules utilitaires et matériel de manutention pour déménagements et livraisons. Dossier en cours de validation.",
    products: [
      ["Camionnette 3,5 t avec chauffeur", "Véhicules utilitaires", "Camionnette de 3,5 tonnes avec chauffeur, 12 m3 de volume utile, carburant en sus.", 75000, 3, 200000, 0, false],
      ["Diable de manutention 300 kg", "Manutention", "Diable renforcé 300 kg avec sangles, pour déménagements et livraisons de colis lourds.", 4000, 12, 20000, 75000, false],
      ["Transpalette manuel 2,5 t", "Manutention", "Transpalette manuel de 2,5 tonnes, fourches de 115 cm, pour entrepôts et chantiers.", 10000, 5, 60000, 260000, false],
    ],
  },
];

export const CLIENTS: [string, string, string][] = [
  ["Aya", "Koffi", "Cocody"],
  ["Jean-Marc", "Yao", "Marcory"],
  ["Fatoumata", "Traoré", "Yopougon"],
  ["Kévin", "N'Guessan", "Koumassi"],
  ["Mariam", "Ouattara", "Plateau"],
  ["Serge", "Kouassi", "Bingerville"],
  ["Adjoua", "Bamba", "Cocody"],
  ["Ibrahim", "Coulibaly", "Bouaké"],
  ["Estelle", "Diallo", "Marcory"],
  ["Franck", "Konan", "Yamoussoukro"],
  ["Nadège", "Aka", "Cocody"],
  ["Cédric", "Tano", "San-Pédro"],
];

export const REVIEW_COMMENTS = [
  "Matériel propre et conforme à la description, livraison à l'heure. Je recommande.",
  "Très bon accueil et matériel en parfait état. Le loueur a été flexible sur l'horaire de retrait.",
  "Tout s'est bien passé, un peu d'attente à la remise mais le résultat était au rendez-vous.",
  "Rapport qualité prix excellent pour notre mariage, les invités ont été ravis.",
  "Équipe réactive, caution restituée rapidement après le retour. Merci.",
  "Matériel un peu usé mais fonctionnel, le loueur a été honnête et arrangeant.",
  "Service professionnel, montage soigné. Nous referons appel à eux.",
  "Bonne expérience globale, communication claire avant et après la location.",
];
