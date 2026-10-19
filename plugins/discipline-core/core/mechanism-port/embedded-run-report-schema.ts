import { z } from "zod";
import { clauseAddressObjectSchema } from "../values/clause-address.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { Equal } from "../values/type-equality.ts";
import { clauseEvaluationSchema, hitSchema, type ProjectionState } from "./runner-result-schema.ts";

const inlineLineSchema = z.number().int().min(1);

export const nativeExceptionSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("ignore"), clause: clauseAddressObjectSchema, file: repoPathSchema })
    .readonly(),
  z
    .object({
      kind: z.literal("config-override"),
      clause: clauseAddressObjectSchema,
      file: repoPathSchema,
    })
    .readonly(),
  z
    .object({
      kind: z.literal("suppression-entry"),
      clause: clauseAddressObjectSchema,
      file: repoPathSchema,
      location: repoPathSchema,
    })
    .readonly(),
  z
    .object({
      kind: z.literal("inline-disable"),
      clause: clauseAddressObjectSchema,
      file: repoPathSchema,
      line: inlineLineSchema,
      text: z.string(),
    })
    .readonly(),
  z
    .object({
      kind: z.literal("inline-rule-config"),
      clause: clauseAddressObjectSchema,
      file: repoPathSchema,
      line: inlineLineSchema,
      text: z.string(),
    })
    .readonly(),
  z
    .object({
      kind: z.literal("command-line-option"),
      clause: clauseAddressObjectSchema,
      location: repoPathSchema,
      script: z.string(),
      option: z.string(),
    })
    .readonly(),
]);

export const embeddedRunReportSchema = z
  .object({
    hits: z.array(hitSchema).readonly(),
    evaluated: z.array(clauseEvaluationSchema).readonly(),
    nativeExceptions: z.array(nativeExceptionSchema).readonly(),
    projection: z.enum(["current", "out-of-date", "missing", "not-included"]),
  })
  .readonly();

export type EmbeddedRunReport = z.infer<typeof embeddedRunReportSchema>;

export const isProjectionStateEqual: Equal<EmbeddedRunReport["projection"], ProjectionState> =
  true;
