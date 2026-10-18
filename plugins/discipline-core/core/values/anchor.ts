import { z } from "zod";

export type AnchorKind =
  | { readonly kind: "keyword"; readonly keyword: string }
  | { readonly kind: "file" }
  | { readonly kind: "source" };

export type Anchor = { readonly line: number; readonly column: number };

export const anchorSchema = z
  .object({
    line: z.number().int().min(1),
    column: z.number().int().min(0),
  })
  .readonly();
