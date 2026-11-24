import { z } from "zod";

export const SIGNATURE_WIDTH = 600;
export const SIGNATURE_HEIGHT = 180;
export const MAX_SIGNATURE_STROKES = 32;
export const MAX_SIGNATURE_POINTS = 1200;

const point = z.tuple([z.number().int().min(0).max(SIGNATURE_WIDTH), z.number().int().min(0).max(SIGNATURE_HEIGHT)]);
export const signatureInput = z.array(z.array(point).min(1).max(MAX_SIGNATURE_POINTS))
  .min(1).max(MAX_SIGNATURE_STROKES)
  .refine((strokes) => strokes.reduce((total, stroke) => total + stroke.length, 0) <= MAX_SIGNATURE_POINTS, "Signature trop complexe.")
  .refine((strokes) => strokes.some(([first, ...points]) => points.some(([x, y]) => x !== first[0] || y !== first[1])), "Tracez une signature.");

export type Signature = z.infer<typeof signatureInput>;
