import { ok, route } from "@/lib/http/route";
import { listCities } from "@/services/catalog";

/** GET /api/cities : villes actives. */
export const GET = route(async () => ok(await listCities()));
