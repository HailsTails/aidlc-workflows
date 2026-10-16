import { z } from "zod";
import { anchorSchema } from "../../../core/values/anchor.ts";
import { isRepoPathText } from "../../../core/values/repo-path.ts";
import type { Equal } from "../../../core/values/type-equality.ts";
import type { WalkerCheck } from "./walker-check.ts";

const inspectCallSchema = z.function({ input: [z.unknown()], output: z.unknown() });

export const walkerCheckModuleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("syntax"), inspect: inspectCallSchema }),
  z.object({ kind: z.literal("path"), inspect: inspectCallSchema }),
  z.object({ kind: z.literal("repository"), inspect: inspectCallSchema }),
]);

export type LoadedWalkerCheck = z.infer<typeof walkerCheckModuleSchema>;

export const walkerPieceModuleSchema = z.object({ check: walkerCheckModuleSchema });

export const walkerPieceSettingsSchema = z
  .object({
    module: z
      .string()
      .refine(
        (text) => text.endsWith(".ts") && isRepoPathText({ text }) === "repo-path",
        "the module is not a path inside the piece folder ending .ts",
      ),
  })
  .readonly();

export type WalkerPieceSettings = z.infer<typeof walkerPieceSettingsSchema>;

export const anchoredSnippetsSchema = z.array(
  z.object({ anchor: anchorSchema, snippet: z.string() }).readonly(),
);

export const pathVerdictSchema = z.enum(["violates", "conforms"]);

type GenericWalkerCheck = WalkerCheck<unknown, unknown, unknown>;

export const isSyntaxVariantKeySetEqual: Equal<
  keyof Extract<GenericWalkerCheck, { readonly kind: "syntax" }>,
  keyof Extract<LoadedWalkerCheck, { readonly kind: "syntax" }>
> = true;

export const isPathVariantKeySetEqual: Equal<
  keyof Extract<GenericWalkerCheck, { readonly kind: "path" }>,
  keyof Extract<LoadedWalkerCheck, { readonly kind: "path" }>
> = true;

export const isRepositoryVariantKeySetEqual: Equal<
  keyof Extract<GenericWalkerCheck, { readonly kind: "repository" }>,
  keyof Extract<LoadedWalkerCheck, { readonly kind: "repository" }>
> = true;

export const isWalkerCheckKeySetEqual = isSyntaxVariantKeySetEqual && isPathVariantKeySetEqual && isRepositoryVariantKeySetEqual;
