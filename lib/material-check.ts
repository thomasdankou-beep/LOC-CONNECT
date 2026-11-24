import { z } from "zod";

export const handoverInput = z.object({
  quantity: z.number().int().min(0),
  condition: z.enum(["GOOD", "WITH_RESERVATIONS"]),
  recipient: z.string().trim().min(1).max(120),
  packaging: z.string().trim().max(300),
  accessories: z.string().trim().max(300),
  notes: z.string().trim().max(1000),
});

export const returnCheckLabels = {
  NOT_APPLICABLE: "Sans objet",
  COMPLETE: "Complet et en bon état",
  INCOMPLETE: "Incomplet",
  DAMAGED: "Endommagé",
} as const;

export const returnCheckInput = z.object({
  packaging: z.enum(["NOT_APPLICABLE", "COMPLETE", "INCOMPLETE", "DAMAGED"]),
  accessories: z.enum(["NOT_APPLICABLE", "COMPLETE", "INCOMPLETE", "DAMAGED"]),
  notes: z.string().trim().max(1000),
});

const savedHandover = handoverInput.extend({ recordedAt: z.iso.datetime() });

export function readHandover(value: unknown) {
  return savedHandover.safeParse(value).data;
}

export function readReturnCheck(value: unknown) {
  return returnCheckInput.safeParse(value).data;
}

export function quantityToReturn(item: { quantity: number; handoverCheck: unknown }) {
  const handover = readHandover(item.handoverCheck);
  return handover ? Math.min(item.quantity, handover.quantity) : item.quantity;
}
