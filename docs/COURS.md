# Cours : comprendre les langages et outils de LOC'CONNECT

Ce cours s'adresse à quelqu'un qui connaît déjà **HTML, CSS, JavaScript, PHP, SQL et MySQL**. Il part de ces connaissances pour arriver au code du projet. Chaque leçon se termine par un petit exercice à faire dans le dépôt.

Les extraits marqués « du projet » sont de vrais morceaux du code, parfois raccourcis.

## Sommaire

0. La carte : ce que vous savez, ce que le projet utilise
1. Le terminal et les outils (`node`, `npm`, `git`)
2. JavaScript moderne
3. TypeScript
4. HTML devient TSX (React)
5. CSS devient Tailwind
6. Next.js : pages et API (le remplaçant de PHP)
7. PostgreSQL et Prisma (le remplaçant de MySQL brut)
8. Validation des données avec Zod
9. Sécurité : droits, sessions, transactions
10. Suivre une action de bout en bout
11. Lire le projet : où est quoi
12. Plan d'apprentissage et exercices
13. Aide-mémoire et glossaire

---

## 0. La carte

| Vous connaissez | Dans LOC'CONNECT | Différence principale |
|---|---|---|
| HTML | **TSX** (React) | Du HTML écrit dans du JavaScript, découpé en composants |
| CSS | **Tailwind CSS** | Des classes courtes sur chaque balise, presque plus de fichier CSS |
| JavaScript | **TypeScript** | Le même langage, avec des types |
| PHP (serveur) | **Next.js** | Le serveur est aussi en JavaScript, un seul projet pour tout |
| SQL / MySQL | **PostgreSQL** + **Prisma** | Presque le même SQL, avec un outil qui écrit les requêtes |
| `include`, `require` | `import` / `export` | Chaque fichier déclare ce qu'il offre et ce qu'il utilise |
| `$_POST`, `$_SESSION` | corps de requête, session par cookie | Même idée, plus de vérifications |
| FTP vers l'hébergeur | `git push`, puis Docker | Le code voyage par Git |

---

## 1. Le terminal et les outils

### Node.js
JavaScript sait s'exécuter hors du navigateur grâce à **Node.js**. C'est lui qui fait tourner le serveur du site, comme Apache et PHP le faisaient.

```bash
node --version        # affiche la version (le projet demande 22 ou plus)
```

### npm et `package.json`
**npm** installe des bibliothèques écrites par d'autres (on dit « dépendances »). Il joue le rôle de Composer en PHP.

- `package.json` : la liste des dépendances et des commandes du projet.
- `node_modules/` : le dossier où les bibliothèques sont téléchargées. Il est énorme et ne va jamais dans Git.
- `package-lock.json` : fige les versions exactes pour que tout le monde ait la même chose.

Les commandes du projet (section `scripts` de `package.json`) :

```bash
npm install                  # télécharge toutes les dépendances
npm run dev                  # lance le site en mode développement
npm test                     # lance les tests automatiques
npm run build                # prépare la version de production
npm start                    # lance la version de production
npm run db:seed -- --force   # remplit la base avec des données de démonstration
```

### Le fichier `.env`
Il contient les **secrets et réglages** propres à chaque machine : adresse de la base de données, clés de signature. Il n'est jamais envoyé sur GitHub. `.env.example` en est le modèle.

### Git en 6 commandes
```bash
git status                   # qu'est-ce qui a changé ?
git add .                    # préparer tous les changements
git commit -m "message"      # enregistrer une version
git push                     # envoyer sur GitHub
git pull                     # récupérer les changements
git checkout nom-de-branche  # changer de branche
```
Une **branche** est une ligne de travail parallèle. Le projet est sur la branche `claude/stoic-carson-4jgdzc`.

> **Exercice 1.** Dans un terminal, dans le dossier du projet : `git log --oneline | head -10`. Vous voyez l'historique des étapes de construction.

---

## 2. JavaScript moderne

Ce que vous savez reste vrai. Voici ce qui a été ajouté ces dernières années et que le projet utilise partout.

### `const` et `let`
```js
const taux = 10;      // ne peut pas être réaffecté : à préférer
let compteur = 0;     // peut changer
compteur = compteur + 1;
```
`var` n'est plus utilisé.

### Fonctions fléchées
```js
function double(x) { return x * 2; }   // façon classique
const double = (x) => x * 2;           // façon courte, même effet
```

### Modèles de texte (backticks)
```js
const nom = "Awa";
const message = `Bonjour ${nom}, vous avez ${3 + 2} réservations`;
```

### Objets et destructuration
```js
const produit = { nom: "Table", prix: 5000, stock: 4 };

const { nom, prix } = produit;            // extrait deux champs
const copie = { ...produit, prix: 6000 }; // copie en changeant un champ
```

### Listes : `map`, `filter`, `find`, `reduce`
```js
const prix = [1000, 5000, 20000];

prix.map((p) => p * 2);              // [2000, 10000, 40000] transforme chaque élément
prix.filter((p) => p > 2000);        // [5000, 20000] garde certains éléments
prix.find((p) => p > 2000);          // 5000 premier qui correspond
prix.reduce((total, p) => total + p, 0);   // 26000 additionne
```
Ces fonctions remplacent presque toutes les boucles `for`.

### `import` et `export`
```js
// lib/money.js
export const double = (x) => x * 2;

// un autre fichier
import { double } from "@/lib/money";
```
Le `@/` est un raccourci qui désigne la racine du projet.

### Opérateurs pratiques
```js
const ville = utilisateur?.adresse?.ville;   // ?. : pas d'erreur si utilisateur est vide
const nom = saisie ?? "Anonyme";              // ?? : valeur par défaut si vide (null ou undefined)
const ok = a && b;                            // et logique
const choix = stock > 0 ? "Disponible" : "Épuisé";   // condition courte
```

### Asynchrone : `async` et `await`
Lire la base de données ou appeler un autre serveur prend du temps. JavaScript ne bloque pas : il rend une **promesse**. `await` signifie « attends le résultat ici ».

```js
async function charger() {
  const reponse = await fetch("/api/produits");   // attend la réponse
  const donnees = await reponse.json();           // attend la conversion
  return donnees;
}
```
Une fonction qui utilise `await` doit être déclarée `async`.

> **Exercice 2.** Ouvrez `lib/money.ts`. Repérez la fonction `formatFcfa` (une fonction fléchée avec un modèle de texte). Que fait `Math.round(amount)` ? Pourquoi arrondit-on ?
> *Réponse : les montants sont des entiers, on évite tout calcul avec des décimales.*

---

## 3. TypeScript

TypeScript ajoute des **types** à JavaScript. Le navigateur ne comprend pas TypeScript : il est vérifié puis converti en JavaScript au moment de la compilation. Les types n'existent que pour vous aider.

### Types de base
```ts
let nom: string = "Awa";
let age: number = 30;
let actif: boolean = true;
let date: Date = new Date();
let notes: number[] = [12, 15];          // liste de nombres
let ids: string[] = ["a", "b"];
```

### Décrire la forme d'un objet : `type`
```ts
type Produit = {
  nom: string;
  prix: number;
  stock: number;
  description?: string;     // le ? veut dire « facultatif »
};

const chaise: Produit = { nom: "Chaise", prix: 1000, stock: 10 };
```
Si vous oubliez `stock`, ou si vous écrivez `prix: "mille"`, l'éditeur souligne l'erreur en rouge avant que le site ne tourne.

### Types « parmi plusieurs valeurs »
```ts
type Statut = "BROUILLON" | "PUBLIE" | "REFUSE";
let s: Statut = "PUBLIE";     // "AUTRE" serait refusé
```
Le projet en utilise beaucoup pour les statuts de réservation (`PAID`, `CONFIRMED`, `READY`...).

### Typer une fonction
```ts
function totalLigne(prixParJour: number, jours: number, quantite: number): number {
  return prixParJour * jours * quantite;
}
```
Après les paramètres, `: number` indique ce que la fonction renvoie.

### Fonctions asynchrones
```ts
async function trouver(id: string): Promise<Produit | null> { ... }
```
`Promise<Produit | null>` : une promesse qui donnera soit un produit, soit rien.

### Un exemple du projet
Dans `components/ui/button.tsx` :

```ts
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "inverse";
export type ButtonSize = "sm" | "md" | "lg";
```
Un bouton ne peut donc pas avoir une variante inventée : l'erreur apparaît tout de suite.

### Types qui viennent de la base
Prisma génère les types à partir des tables. Quand vous écrivez `reservation.status`, l'éditeur sait que c'est un des statuts autorisés, et vous propose la liste.

> **Exercice 3.** Dans `components/ui/button.tsx`, ajoutez temporairement `"fantome"` dans un appel `<Button variant="fantome">` quelque part. Lancez `npm run typecheck`. Lisez l'erreur, puis annulez votre modification avec `git checkout .`

---

## 4. HTML devient TSX (React)

### Le principe : les composants
Une page web est un assemblage de blocs répétés : cartes, boutons, tableaux. Avec **React**, on écrit chaque bloc **une fois**, sous forme de fonction qui renvoie du HTML.

```tsx
function CarteProduit({ nom, prix }: { nom: string; prix: number }) {
  return (
    <div className="carte">
      <h3>{nom}</h3>
      <p>{prix} FCFA par jour</p>
    </div>
  );
}
```
Cela s'appelle du **TSX** (TypeScript + XML, le XML étant la syntaxe proche du HTML). On l'utilise comme une balise :

```tsx
<CarteProduit nom="Table ronde" prix={5000} />
<CarteProduit nom="Chaise pliante" prix={1000} />
```

### Les `props`
Ce qu'on passe dans la balise (`nom="..."`, `prix={...}`) s'appelle les **props**. C'est l'équivalent des paramètres d'une fonction.

### Les règles qui changent par rapport au HTML
| HTML | TSX |
|---|---|
| `class="x"` | `className="x"` |
| `for="champ"` | `htmlFor="champ"` |
| `<img src="a.jpg">` | `<img src="a.jpg" />` (toute balise se ferme) |
| `onclick="f()"` | `onClick={() => f()}` |
| plusieurs éléments racine | un seul parent (ou `<>...</>`) |
| valeur en dur | `{expression JavaScript}` entre accolades |

### Afficher des listes et des conditions
```tsx
<ul>
  {produits.map((p) => (
    <li key={p.id}>{p.nom}</li>
  ))}
</ul>

{stock > 0 ? <p>Disponible</p> : <p>Épuisé</p>}
{estAdmin && <button>Supprimer</button>}
```
`key` est obligatoire dans une liste : une valeur unique par élément, qui aide React à suivre chaque ligne.

### Un composant du projet
`components/ui/badge.tsx` (raccourci) :

```tsx
export function Badge({ tone = "neutral", children, className }: {
  tone?: Tone; children: ReactNode; className?: string;
}) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs", TONES[tone], className)}>
      {children}
    </span>
  );
}
```
- `tone = "neutral"` : valeur par défaut.
- `children` : ce qu'on met **entre** les balises : `<Badge>Confirmée</Badge>`.
- `TONES[tone]` : choisit les classes de couleur selon la variante.

### Interaction : `useState`
Pour qu'un morceau d'écran change quand l'utilisateur agit, on utilise un **état** :

```tsx
"use client";                       // ce fichier tourne dans le navigateur
import { useState } from "react";

function Compteur() {
  const [quantite, setQuantite] = useState(1);   // valeur de départ : 1

  return (
    <div>
      <button onClick={() => setQuantite(quantite - 1)}>-</button>
      <span>{quantite}</span>
      <button onClick={() => setQuantite(quantite + 1)}>+</button>
    </div>
  );
}
```
`quantite` est la valeur, `setQuantite` la fonction qui la change **et rafraîchit l'écran**. On n'écrit jamais `quantite = 2` directement.

### `"use client"`
Par défaut, un composant s'exécute sur le **serveur** (voir leçon 6) et ne peut pas réagir aux clics. Dès qu'un composant a besoin de `useState`, de clics ou de formulaires interactifs, on met `"use client"` tout en haut du fichier. Vous le verrez dans les fichiers du dossier `features/`.

> **Exercice 4.** Ouvrez `components/ui/badge.tsx`. Trouvez où le composant `StatusBadge` est utilisé : cherchez `StatusBadge` dans l'éditeur (recherche globale, `Ctrl+Maj+F`). Notez dans quelles pages il apparaît.

---

## 5. CSS devient Tailwind

### Le principe
Au lieu d'écrire une règle CSS puis de la rattacher à un élément, on pose des **classes utilitaires** directement sur la balise. Chacune fait une petite chose.

```html
<!-- CSS classique -->
<style>
  .bouton { background: blue; color: white; padding: 8px 16px; border-radius: 10px; }
</style>
<button class="bouton">Réserver</button>
```
```tsx
{/* Tailwind */}
<button className="bg-blue-600 text-white px-4 py-2 rounded-lg">Réserver</button>
```

### Les classes à connaître
| Famille | Exemples | Effet |
|---|---|---|
| Marges intérieures | `p-4` `px-4` `py-2` `pt-2` | espace dedans (tout, horizontal, vertical, haut) |
| Marges extérieures | `m-4` `mt-2` `mx-auto` | espace dehors, `mx-auto` centre |
| Taille | `w-full` `h-11` `max-w-3xl` `min-h-dvh` | largeur, hauteur |
| Texte | `text-sm` `text-xl` `font-semibold` `text-center` | taille, graisse, alignement |
| Couleur | `bg-white` `text-gray-600` `border-gray-200` | fond, texte, bordure |
| Forme | `rounded-lg` `rounded-full` `shadow` | arrondis, ombre |
| Flexbox | `flex` `items-center` `justify-between` `gap-3` | alignement en ligne |
| Grille | `grid` `grid-cols-3` | colonnes |
| Affichage | `hidden` `block` `overflow-hidden` | visibilité |

Les chiffres suivent une échelle : `4` = 1 rem = 16 px, `2` = 8 px, `8` = 32 px.

### Les états
On préfixe la classe :
```tsx
<button className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
```
- `hover:` au survol, `focus:` au focus, `disabled:` si le bouton est désactivé.

### Adapter à la taille de l'écran (responsive)
Tailwind est **mobile d'abord** : la classe sans préfixe vaut pour toutes les tailles, puis on ajoute pour les écrans plus larges.

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
```
- 1 colonne sur téléphone, 2 dès `sm` (640 px), 4 dès `lg` (1024 px).

### Mode sombre et couleurs du projet
Les couleurs du projet portent des **noms métier** : `bg-royal` (le bleu de la marque), `text-ink` (texte), `bg-surface` (fond d'une carte), `text-danger`. Elles sont définies **une seule fois** dans `app/globals.css`, sous forme de variables CSS, avec une version claire et une version sombre. Changer un bleu dans ce fichier le change partout.

C'est le seul vrai fichier CSS du projet : 144 lignes.

### `cn(...)` : combiner des classes
Dans le code vous verrez `cn("...", condition && "...", autre)`. C'est une petite fonction (`lib/cn.ts`) qui assemble des classes en ignorant celles qui sont vides :

```tsx
<div className={cn("rounded p-4", actif && "bg-royal text-white")}>
```

> **Exercice 5.** Dans `components/ui/badge.tsx`, changez `px-2.5` en `px-5` et regardez le résultat dans le navigateur (le site se met à jour tout seul avec `npm run dev`). Annulez ensuite avec `git checkout components/ui/badge.tsx`.

---

## 6. Next.js : pages et API

**Next.js** est le moteur du site. Il remplace à la fois Apache, les fichiers PHP et le routage.

### Les pages : le dossier donne l'adresse
En PHP, `produit.php` donne `/produit.php`. Ici, c'est la **structure des dossiers** dans `app/` qui fait les adresses.

| Fichier | Adresse |
|---|---|
| `app/(site)/faq/page.tsx` | `/faq` |
| `app/(site)/produits/[slug]/page.tsx` | `/produits/chaise-pliante` (`[slug]` est variable) |
| `app/loueur/dashboard/page.tsx` | `/loueur/dashboard` |
| `app/admin/page.tsx` | `/admin` |

Les dossiers entre parenthèses, comme `(site)`, regroupent des pages **sans changer l'adresse**. Ils servent à partager une mise en page (en-tête, pied de page).

Autres fichiers à connaître :
- `layout.tsx` : l'enveloppe commune à toutes les pages du dossier (menu, pied de page).
- `loading.tsx` : ce qu'on affiche pendant le chargement (squelette).
- `not-found.tsx`, `error.tsx` : pages 404 et erreur.

### Les pages s'exécutent sur le serveur
Comme en PHP, le code d'une page s'exécute **sur le serveur**, interroge la base, et envoie du HTML terminé au navigateur.

```php
<?php // produit.php
$produit = $pdo->query("SELECT * FROM produits WHERE id = 1")->fetch();
?>
<h1><?= $produit['nom'] ?></h1>
```
```tsx
// app/exemple/page.tsx
export default async function Page() {
  const produit = await db.product.findFirst({ where: { id: "1" } });
  return <h1>{produit?.name}</h1>;
}
```
La différence importante : on peut mélanger dans un même projet des composants **serveur** (accès à la base, aucun clic) et des composants **navigateur** (`"use client"`, interactifs).

| | Composant serveur (par défaut) | Composant navigateur (`"use client"`) |
|---|---|---|
| S'exécute | sur le serveur | dans le navigateur |
| Peut lire la base | oui | non (passe par l'API) |
| Peut réagir aux clics, `useState` | non | oui |
| Secrets visibles | non | **à ne jamais y mettre** |

### Les routes d'API : `route.ts`
Un fichier `route.ts` répond à des requêtes HTTP et renvoie du JSON, comme un fichier PHP d'API.

- `app/api/contact/route.ts` répond à `POST /api/contact`.
- `app/api/products/[id]/route.ts` répond à `GET`, `PATCH`... sur `/api/products/abc`.

Du projet (`app/api/contact/route.ts`) :

```ts
export const POST = route(async ({ req, ip }) => {
  rateLimit(`contact:${ip}`, 5, 3_600_000);        // 5 messages par heure et par IP
  const input = await parseBody(req, contactInput); // vérifie les données reçues
  const actor = await getActor();                   // qui est connecté ?
  return created(await submitContact(input, actor?.userId));
});
```
Le nom de la constante (`GET`, `POST`, `PATCH`, `DELETE`) indique la méthode HTTP gérée.

### Appeler une API depuis le navigateur
```ts
const reponse = await fetch("/api/contact", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Awa", email: "awa@exemple.ci" }),
});
const resultat = await reponse.json();
```
Le projet encapsule cela dans `lib/api-client.ts` et `hooks/use-action.ts`.

### Les trois couches du projet
```
app/ (pages et routes)  →  services/ (règles métier)  →  Prisma  →  PostgreSQL
```
- Les **pages** et les **routes** reçoivent la demande, vérifient l'identité, puis délèguent.
- Les **services** contiennent les règles métier : « ce stock est-il disponible ? », « combien rembourser ? ». C'est le cœur du projet.
- Les mêmes services sont utilisés par les pages et par l'API : une règle n'est écrite qu'une fois.

> **Exercice 6.** Ouvrez `app/(site)/faq/page.tsx`. Repérez : la fonction `export default async function`, l'appel à `getSettings()` (lecture en base), et le HTML renvoyé. Changez le texte d'une question, enregistrez et rechargez `/faq`.

---

## 7. PostgreSQL et Prisma

### Ce qui ressemble à MySQL
Tables, colonnes, clés primaires, clés étrangères, `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `JOIN`, index : **tout cela fonctionne pareil**. Vos connaissances s'appliquent.

### Ce qui change
| MySQL | PostgreSQL |
|---|---|
| noms entre accents graves `` `table` `` | noms entre guillemets doubles `"Table"` |
| `AUTO_INCREMENT` | identifiants texte générés (cuid) ou `SERIAL` |
| `DATETIME` | `TIMESTAMP` |
| `ENUM` | vrai type `ENUM` plus strict |
| JSON basique | `JSONB` (indexable, plus puissant) |
| transactions possibles | transactions très robustes, verrous de ligne (`FOR UPDATE`) |

Le projet utilise surtout PostgreSQL pour ses **transactions** : plusieurs opérations réussissent toutes ensemble, ou aucune. C'est essentiel pour de l'argent et du stock.

### Prisma : le schéma
On décrit les tables dans `prisma/schema.prisma` :

```prisma
model Product {
  id            String   @id @default(cuid())     // clé primaire
  slug          String   @unique                  // doit être unique
  name          String
  unitPrice     Int                               // prix par jour, en FCFA
  stockQuantity Int
  depositAmount Int
  status        ProductStatus @default(DRAFT)     // valeur par défaut
  lenderId      String
  lender        Lender   @relation(fields: [lenderId], references: [id])
}
```
Équivalent SQL (simplifié) :

```sql
CREATE TABLE "Product" (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  "unitPrice" INTEGER NOT NULL,
  "stockQuantity" INTEGER NOT NULL,
  "depositAmount" INTEGER NOT NULL,
  status "ProductStatus" NOT NULL DEFAULT 'DRAFT',
  "lenderId" TEXT NOT NULL REFERENCES "Lender"(id)
);
```
- `String?` : colonne facultative (peut être `NULL`).
- `@relation` : la clé étrangère. De l'autre côté, `Lender` déclare `products Product[]`.

### Prisma : les migrations
Quand on modifie le schéma, `npx prisma migrate dev --name description` crée un fichier SQL dans `prisma/migrations/`. En production, `npx prisma migrate deploy` applique ceux qui manquent. La base évolue donc par étapes, de façon traçable.

### Prisma : les requêtes
```ts
// SELECT * FROM "Product" WHERE "unitPrice" < 5000 ORDER BY name ASC LIMIT 10
const produits = await db.product.findMany({
  where: { unitPrice: { lt: 5000 } },
  orderBy: { name: "asc" },
  take: 10,
});

// Un seul enregistrement
const p = await db.product.findUnique({ where: { slug: "chaise-pliante" } });

// INSERT
await db.product.create({
  data: { name: "Table", slug: "table", unitPrice: 5000, stockQuantity: 4, depositAmount: 10000, lenderId },
});

// UPDATE
await db.product.update({ where: { id }, data: { stockQuantity: 3 } });

// DELETE
await db.product.delete({ where: { id } });

// COUNT
const total = await db.product.count({ where: { status: "PUBLISHED" } });

// JOIN : le produit avec son loueur et sa catégorie
const complet = await db.product.findFirst({
  where: { id },
  include: { lender: true, category: true },
});
```

Opérateurs de filtre fréquents : `equals`, `not`, `in: [...]`, `lt`, `lte`, `gt`, `gte`, `contains` (équivalent de `LIKE '%...%'`), `AND`, `OR`.

### Une transaction
```ts
await db.$transaction(async (tx) => {
  await tx.reservationItem.update({ where: { id }, data: { status: "CANCELLED" } });
  await tx.refund.create({ data: { ... } });
  // si une des deux échoue, tout est annulé
});
```

### Tables du projet (57 au total), par domaine
- **Comptes** : `User`, `Session`, `Role`, `Permission`
- **Loueurs** : `Lender`, `LenderMember`
- **Catalogue** : `Category`, `City`, `Product`, `ProductPhoto`
- **Réservation** : `Cart`, `Hold`, `Reservation`, `ReservationItem`
- **Argent** : `Payment`, `PaymentAllocation`, `Refund`, `Payout`, `BalanceEntry`, `FinancialTransaction`
- **Caution et retour** : `Deposit`, `ReturnReport`, `ReturnPhoto`
- **Autres** : `Delivery`, `Dispute`, `Review`, `Notification`, `Setting`, `AuditLog`

> **Exercice 7.** Ouvrez `prisma/schema.prisma`. Trouvez le modèle `Reservation`, puis `ReservationItem`. Quelle est la relation entre les deux ? (*Une réservation a plusieurs lignes ; chaque ligne appartient à une réservation et vise un seul loueur.*) Pourquoi le statut est-il sur la ligne plutôt que sur la réservation ? (*Pour qu'un litige avec un loueur n'affecte pas les autres loueurs du même panier.*)

> **Exercice 8 (avancé).** Lancez `npm run db:studio` : une page web s'ouvre et affiche toutes les tables avec leurs données de démonstration. Parcourez `Product` et `Reservation`.

---

## 8. Validation des données avec Zod

Tout ce qui vient du navigateur est **suspect** : l'utilisateur peut envoyer n'importe quoi. **Zod** décrit la forme attendue et refuse le reste, avec des messages clairs.

Du projet (`services/contact.ts`) :

```ts
export const contactInput = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom").max(100),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  phone: z.string().trim().max(30).optional(),
  subject: z.string().trim().min(3, "Indiquez un objet").max(150),
  message: z.string().trim().min(10, "Votre message est trop court").max(3000),
});
```

- `.trim()` retire les espaces, `.toLowerCase()` met en minuscules.
- `.optional()` : champ facultatif.
- Si les données sont invalides, l'API renvoie une erreur 422 avec le détail champ par champ, et le formulaire affiche le message sous le bon champ.
- `z.infer<typeof contactInput>` produit **automatiquement le type TypeScript** correspondant : on ne répète pas la description.

> **Exercice 9.** Dans `services/contact.ts`, passez `min(10, ...)` du message à `min(20, ...)`. Envoyez un message court depuis `/contact` et observez l'erreur. Annulez avec `git checkout services/contact.ts`.

---

## 9. Sécurité : droits, sessions, transactions

Pour un site qui manipule de l'argent, ces mécanismes sont plus importants que l'apparence. Les voici simplement.

### Connexion et session
- Le mot de passe est **haché** (`bcryptjs`) : on stocke une empreinte irréversible, jamais le mot de passe.
- À la connexion, un **cookie de session** est posé (`lc_session`). Il est `HttpOnly` : le JavaScript du navigateur ne peut pas le lire, ce qui limite le vol.
- La session est aussi enregistrée en base, donc on peut la révoquer.

### Droits : trois questions à chaque action
1. **Êtes-vous connecté ?**
2. **Avez-vous la permission** pour cette action ? (`ORDER_VALIDATE`, `ADMIN_REFUNDS`...)
3. **Cette ressource est-elle à vous ?** (un loueur ne voit que ses lignes de réservation)

Ces contrôles se font **côté serveur**, jamais seulement en cachant un bouton. Un utilisateur malin peut appeler l'API directement : seul le serveur peut donc faire foi.

### Protection contre les doubles réservations
Si deux clients réservent la dernière unité au même instant, il ne doit rester qu'un gagnant. Le projet **verrouille** la ligne produit dans la base (`SELECT ... FOR UPDATE`) pendant qu'il vérifie le stock. Le second client attend, puis constate qu'il n'y a plus de stock. Un test automatique lance 12 clients simultanés sur 3 unités et vérifie que exactement 3 réussissent.

### Idempotence
Si le même message de paiement arrive deux fois (cela arrive en vrai), il ne doit être traité qu'**une fois**. Chaque événement a un identifiant unique enregistré en base.

### Journal d'audit
Les actions importantes (remboursement, changement de paramètre, validation d'un loueur) sont inscrites dans `AuditLog` : qui, quoi, quand, ancienne et nouvelle valeur.

---

## 10. Suivre une action de bout en bout : « annuler une réservation »

1. **Page** `app/(client)/mes-reservations/[id]/page.tsx` (serveur) charge la réservation et affiche un bouton.
2. **Composant navigateur** `features/reservations/client-actions.tsx` (`"use client"`) : au clic sur Annuler, il demande d'abord un aperçu du remboursement (`GET .../cancellation-preview`), puis envoie `POST /api/reservations/:id/cancel`.
3. **Route API** `app/api/reservations/[id]/cancel/route.ts` : identifie l'utilisateur, vérifie les données avec Zod, appelle le service.
4. **Service** `services/refunds.ts`, fonction `cancelReservation` :
   - vérifie que la réservation est bien au client ;
   - calcule le remboursement ligne par ligne selon la politique d'annulation ;
   - dans **une transaction** : enregistre le remboursement, restitue les cautions, change le statut des lignes, déduit la part des loueurs concernés ;
   - écrit dans le journal d'audit et envoie les notifications.
5. **Retour** : la route renvoie le résultat, la page se rafraîchit, le client voit « Annulée ».

Chaque étape correspond à une leçon de ce cours.

> **Exercice 10.** Ouvrez, dans cet ordre : `features/reservations/client-actions.tsx` (cherchez `CancelButton`), puis `app/api/reservations/[id]/cancel/route.ts`, puis `services/refunds.ts` (cherchez `cancelReservation`). À chaque fichier, notez en une phrase son rôle.

---

## 11. Lire le projet : où est quoi

| Dossier | Contenu | Commencez par |
|---|---|---|
| `app/` | Pages et routes API | `app/(site)/faq/page.tsx` (simple) |
| `components/ui/` | Briques d'interface : bouton, badge, carte, tableau | `badge.tsx`, `button.tsx` |
| `components/layout/` | En-tête, pied de page, menus des espaces | `site-footer.tsx` |
| `features/` | Composants interactifs par domaine | `features/contact/contact-form.tsx` |
| `services/` | **Règles métier** | `services/contact.ts` (simple), puis `availability.ts` |
| `lib/` | Outils communs : argent, dates, droits, paramètres | `money.ts`, `dates.ts` |
| `prisma/` | Tables, migrations, données de démonstration | `schema.prisma` |
| `tests/` | Tests automatiques | `tests/admin.test.ts` |
| `docs/` | Documentation | `ARCHITECTURE.md` |

Quelques astuces dans l'éditeur (VS Code) :
- `Ctrl + P` : ouvrir un fichier par son nom.
- `Ctrl + Maj + F` : chercher un mot dans tout le projet.
- `Ctrl + clic` sur un nom de fonction : aller à sa définition.
- Survoler un mot : l'éditeur affiche son type.

---

## 12. Plan d'apprentissage et exercices

**Semaine 1 : JavaScript moderne.** Leçon 2, avec des petits exercices dans la console du navigateur (F12). Entraînez-vous surtout à `map`, `filter`, la destructuration et `async/await`.

**Semaine 2 : TypeScript et React.** Leçons 3 et 4. Construisez un composant `CarteProduit` et affichez-en une liste.

**Semaine 3 : Tailwind.** Leçon 5. Reproduisez une carte produit avec l'aide de la documentation (tailwindcss.com). Essayez le responsive.

**Semaine 4 : Next.js.** Leçon 6. Créez une page `app/(site)/test/page.tsx` qui affiche un texte, puis une route `app/api/bonjour/route.ts` qui renvoie `{ message: "Bonjour" }`.

**Semaine 5 : Prisma.** Leçon 7. Écrivez dans une page la liste des 10 premiers produits par ordre alphabétique, avec leur loueur.

**Ensuite : relisez les services.** Prenez `services/availability.ts` puis `services/refunds.ts`, ligne par ligne, en vous aidant de la leçon correspondante.

### Mini-projets dans LOC'CONNECT
1. Changer la couleur de la marque dans `app/globals.css` (`--lc-royal`) et observer.
2. Ajouter une nouvelle question dans la FAQ.
3. Ajouter un champ « téléphone » obligatoire au formulaire de contact (formulaire, Zod, base).
4. Afficher le nombre de produits par ville sur une page.
5. Écrire un test dans `tests/` qui vérifie un calcul simple.

---

## 13. Aide-mémoire et glossaire

### Commandes
```bash
npm install            # installer les dépendances
npm run dev            # lancer le site (http://localhost:3000)
npm test               # tests
npm run typecheck      # vérifier les types
npm run db:studio      # explorer la base dans le navigateur
npx prisma migrate dev --name mon_changement   # créer une migration
```

### Glossaire
| Mot | Signification |
|---|---|
| **API** | Ensemble d'adresses que le navigateur ou une autre application appelle pour lire ou modifier des données |
| **Async / Promesse** | Opération qui prend du temps ; on l'attend avec `await` |
| **Composant** | Fonction qui renvoie un morceau d'interface, réutilisable |
| **Props** | Paramètres passés à un composant |
| **État (`useState`)** | Valeur qui, en changeant, rafraîchit l'écran |
| **Route** | Une adresse gérée par le serveur |
| **Migration** | Fichier SQL qui fait évoluer la base d'une version à la suivante |
| **ORM** | Outil qui traduit des objets en requêtes SQL (Prisma ici) |
| **Transaction** | Groupe d'opérations qui réussissent toutes ou échouent toutes |
| **Hash** | Empreinte irréversible d'un mot de passe |
| **Cookie de session** | Petit jeu de données gardé par le navigateur pour vous reconnaître |
| **CSRF** | Attaque où un autre site fait agir votre navigateur à votre insu ; contrée ici en vérifiant l'origine de la requête |
| **Rate limit** | Limite du nombre de requêtes par minute ou par heure |
| **Build** | Préparation du site pour la production (compilation, optimisation) |
| **Variable d'environnement** | Réglage ou secret propre à une machine (fichier `.env`) |
| **Webhook** | Message envoyé par un service extérieur (opérateur de paiement) à votre serveur |
| **Idempotent** | Qui produit le même résultat même si on le répète |
| **Seed** | Remplissage de la base avec des données de démonstration |

### Pour aller plus loin (documentation officielle)
- JavaScript : developer.mozilla.org (en français, très complet)
- TypeScript : typescriptlang.org/docs
- React : react.dev (section « Apprendre »)
- Next.js : nextjs.org/docs. **Attention** : le projet utilise une version récente avec des changements. Le dossier `node_modules/next/dist/docs/` contient la documentation exacte de la version installée.
- Tailwind : tailwindcss.com/docs
- Prisma : prisma.io/docs
- PostgreSQL : postgresql.org/docs
- Zod : zod.dev
