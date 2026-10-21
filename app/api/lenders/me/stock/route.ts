import { ok, route } from "@/lib/http/route";
import { requireLender } from "@/lib/auth/actor";
import { stockOverview } from "@/services/products";

/** GET /api/lenders/me/stock : stock physique, réservé, bloqué et disponible aujourd'hui par produit. */
export const GET = route(async () => ok(await stockOverview((await requireLender("STOCK_VIEW")).lenderId)));
