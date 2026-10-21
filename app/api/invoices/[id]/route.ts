import { ok, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { getInvoiceForActor } from "@/services/invoices";

/** GET /api/invoices/:id : contenu figé d'une facture ou d'un avoir. La version imprimable est servie par /factures/:id. */
export const GET = route<{ id: string }>(async ({ params }) => {
  const { invoice, credited, creditNotes } = await getInvoiceForActor(await requireActor(), params.id);
  return ok({ ...invoice, credited, creditNotes });
});
