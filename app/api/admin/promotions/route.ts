import { created, ok, parseBody, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { createPromotion, listPromotions, promotionInput } from "@/services/admin";

/** GET /api/admin/promotions : produits à la une et sponsorisés. */
export const GET = route(async () => ok(await listPromotions(await requireAdmin())));

/** POST /api/admin/promotions : met un produit en avant pour une durée donnée. */
export const POST = route(async ({ req }) => created(await createPromotion(await requireAdmin(), await parseBody(req, promotionInput))));
