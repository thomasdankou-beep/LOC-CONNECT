import { requireLender } from "@/lib/auth/actor";
import { ok, parseBody, route } from "@/lib/http/route";
import { catalogImportInput, importCatalog } from "@/services/catalog-import";

export const POST = route(async ({ req }) => {
  const actor = await requireLender("PRODUCT_CREATE");
  return ok(await importCatalog(actor, await parseBody(req, catalogImportInput)));
});
