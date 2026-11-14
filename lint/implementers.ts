import { z } from "zod";
import implementersDocument from "./implementers.json" with { type: "json" };

const ImplementerSchema = z.strictObject({
  capability: z.string().min(1),
  file: z.string().min(1),
  port: z.string().min(1),
  modules: z.array(z.string().min(1)),
  globals: z.array(z.string().min(1)),
  factory: z.string().min(1),
  fakeSeam: z.string().min(1),
  hermeticTest: z.string().min(1),
});

const ImplementersSchema = z.strictObject({
  version: z.literal(1),
  implementers: z.array(ImplementerSchema),
});

export type Implementer = z.infer<typeof ImplementerSchema>;

export const IMPLEMENTERS: readonly Implementer[] =
  ImplementersSchema.parse(implementersDocument).implementers;

const globalRootOf = (reference: string): string => reference.split(".")[0] ?? reference;

export const registeredGlobalRoots = (implementer: Implementer): readonly string[] =>
  implementer.globals.map(globalRootOf);
