import type { FulfillmentType } from "@prisma/client";
import { z } from "zod";
import { AppError } from "./errors";
import { slotInput } from "./slots";

export const lenderFulfillmentInput = z.array(z.object({
  lenderId: z.string().min(1),
  mode: z.enum(["PICKUP", "DELIVERY"]),
  deliverySlot: slotInput.optional(),
  returnSlot: slotInput.optional(),
})).min(1);

export type LenderFulfillment = z.infer<typeof lenderFulfillmentInput>;

type OrderFulfillment = {
  fulfillmentType: FulfillmentType;
  lenderFulfillment?: unknown;
  deliverySlot?: string | null;
  returnSlot?: string | null;
};

export function fulfillmentFor(order: OrderFulfillment, lenderId: string) {
  const configured = order.lenderFulfillment as LenderFulfillment | null | undefined;
  return configured?.find((entry) => entry.lenderId === lenderId) ?? {
    mode: order.fulfillmentType,
    deliverySlot: order.deliverySlot,
    returnSlot: order.returnSlot,
  };
}

export function isMixedFulfillment(order: OrderFulfillment): boolean {
  const configured = order.lenderFulfillment as LenderFulfillment | null | undefined;
  return new Set(configured?.map((entry) => entry.mode)).size > 1;
}

export function validateLenderFulfillment(
  lenders: { id: string; companyName: string; offersDelivery: boolean; deliveryRequired: boolean }[],
  order: { fulfillmentType: FulfillmentType; lenderFulfillment?: LenderFulfillment | null },
) {
  const ids = new Set(lenders.map((lender) => lender.id));
  const entries = order.lenderFulfillment;
  if (entries) {
    const chosen = new Set(entries.map((entry) => entry.lenderId));
    if (entries.length !== ids.size || chosen.size !== ids.size || entries.some((entry) => !ids.has(entry.lenderId))) {
      throw new AppError("VALIDATION_ERROR", "Choisissez un mode de remise pour chaque loueur du panier.");
    }
    const summary = entries.some((entry) => entry.mode === "DELIVERY") ? "DELIVERY" : "PICKUP";
    if (order.fulfillmentType !== summary) throw new AppError("VALIDATION_ERROR", "Les modes de remise doivent être actualisés.");
  } else if (lenders.some((lender) => lender.deliveryRequired) && lenders.some((lender) => !lender.offersDelivery)) {
    throw new AppError("VALIDATION_ERROR", "Ce panier mélange livraison obligatoire et retrait uniquement. Choisissez le mode de remise par loueur.");
  }

  for (const lender of new Map(lenders.map((entry) => [entry.id, entry])).values()) {
    const { mode } = fulfillmentFor(order, lender.id);
    if (mode === "PICKUP" && lender.deliveryRequired) throw new AppError("VALIDATION_ERROR", `${lender.companyName} livre obligatoirement son matériel.`);
    if (mode === "DELIVERY" && !lender.offersDelivery) throw new AppError("VALIDATION_ERROR", `${lender.companyName} ne propose pas la livraison.`);
  }
}
