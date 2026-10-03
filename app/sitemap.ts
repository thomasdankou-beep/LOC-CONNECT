import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

const base = process.env.APP_URL ?? "http://localhost:3000";
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, cities, lenders] = await Promise.all([
    db.product.findMany({ where: { status: "PUBLISHED", deletedAt: null, lender: { status: "APPROVED" } }, select: { slug: true, updatedAt: true } }),
    db.category.findMany({ where: { active: true }, select: { slug: true } }),
    db.city.findMany({ where: { active: true }, select: { slug: true } }),
    db.lender.findMany({ where: { status: "APPROVED" }, select: { slug: true, updatedAt: true } }),
  ]);
  const staticPages = ["", "/catalogue", "/categories", "/devenir-loueur", "/faq", "/contact", "/conditions", "/confidentialite"].map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 }));
  return [
    ...staticPages,
    ...categories.map((c) => ({ url: `${base}/categories/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...cities.map((c) => ({ url: `${base}/villes/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...products.map((p) => ({ url: `${base}/produits/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...lenders.map((l) => ({ url: `${base}/loueurs/${l.slug}`, lastModified: l.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
