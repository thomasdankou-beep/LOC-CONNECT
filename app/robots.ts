import type { MetadataRoute } from "next";

const base = process.env.APP_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/loueur", "/mon-compte", "/mes-", "/panier", "/reservation", "/paiement", "/confirmation", "/connexion", "/inscription"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
