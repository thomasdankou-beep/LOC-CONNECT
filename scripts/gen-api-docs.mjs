// Génère docs/API.md à partir des routes de app/api : méthode, chemin et commentaire de chaque handler.
// Usage : npm run docs:api
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve("app/api");
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name === "route.ts") files.push(full);
  }
})(root);

const rows = [];
for (const file of files) {
  const url = "/api/" + path.relative(root, path.dirname(file)).split(path.sep).filter(Boolean).join("/").replace(/\[\.\.\.(\w+)\]/g, ":$1*").replace(/\[(\w+)\]/g, ":$1");
  const src = readFileSync(file, "utf8");
  const re = /(\/\*\*([\s\S]*?)\*\/\s*)?export (?:const|async function) (GET|POST|PUT|PATCH|DELETE)\b/g;
  let m;
  while ((m = re.exec(src))) {
    let doc = (m[2] ?? "").replace(/^\s*\*\s?/gm, "").replace(/\s+/g, " ").trim();
    doc = doc.replace(new RegExp(`^${m[3]}\\s+\\S+\\s*:?\\s*`), "");
    rows.push({ url: url.replace(/\/$/, ""), method: m[3], doc });
  }
}
const order = ["GET", "POST", "PUT", "PATCH", "DELETE"];
rows.sort((a, b) => a.url.localeCompare(b.url) || order.indexOf(a.method) - order.indexOf(b.method));

const groups = new Map();
for (const r of rows) {
  const key = r.url.split("/")[2] ?? "";
  groups.set(key, [...(groups.get(key) ?? []), r]);
}

let out = `# API REST LOC'CONNECT

Document généré par \`npm run docs:api\` à partir du code (${rows.length} opérations). Ne pas modifier à la main.

## Conventions

- Toutes les réponses sont du JSON. Succès : \`{ "success": true, "data": ... }\`. Erreur : \`{ "success": false, "error": { "code", "message", "request_id", "details"? } }\`.
- Codes d'erreur : \`VALIDATION_ERROR\` (422), \`UNAUTHENTICATED\` (401), \`FORBIDDEN\` (403), \`NOT_FOUND\` (404), \`CONFLICT\` (409), \`STOCK_INSUFFICIENT\` (409), \`INVALID_TRANSITION\` (409), \`RATE_LIMITED\` (429), \`CSRF_REJECTED\` (403), \`INTERNAL_ERROR\` (500).
- Authentification : cookie de session \`lc_session\` (HttpOnly, SameSite=Lax). Les requêtes qui modifient des données vérifient l'en-tête \`Origin\`.
- Montants : entiers en FCFA. Dates de location : \`AAAA-MM-JJ\`, période semi-ouverte [début, fin).
- Idempotence : \`idempotencyKey\` sur la création de paiement ; les webhooks sont dédupliqués par \`(provider, eventId)\`.
- Webhook de paiement : signature HMAC-SHA256 du corps brut dans l'en-tête \`x-signature\`.
- Chaque route contrôle côté serveur le rôle **et** la permission, puis l'appartenance de la ressource (un loueur n'accède qu'à ses lignes).

`;
for (const [key, list] of groups) {
  out += `## /api/${key}\n\n| Méthode | Chemin | Description |\n|---|---|---|\n`;
  for (const r of list) out += `| \`${r.method}\` | \`${r.url}\` | ${r.doc.replace(/\|/g, "\\|") || ""} |\n`;
  out += "\n";
}
writeFileSync("docs/API.md", out);
console.log(`docs/API.md : ${rows.length} opérations`);
