import { z } from "zod";
import { finding, type Outcome } from "../domain/model.ts";
const schema = z.tuple([z.string().min(1), z.string().min(1), z.string().regex(/^[a-f0-9]{40}$/), z.enum(["all", "methodology-only"])]).rest(z.string().min(1)).refine((entries) => entries.length <= 5);
export type SourceAssemblyArguments = { readonly sourceRoot: string; readonly runtimeRoot: string; readonly pin: string; readonly sharedKnowledge: "all" | "methodology-only"; readonly showFile: string | null };
export const parseSourceAssemblyArguments = ({ argv }: { readonly argv: readonly string[] }): Outcome<SourceAssemblyArguments> => {
  const parsed = schema.safeParse(argv);
  if (!parsed.success)
    return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "source-preview", detail: "usage: preview:source <trusted-source-root> <prepared-Claude-root> <source-pin> <all|methodology-only> [selected-native-file]" })] };
  return { status: "ok", value: { sourceRoot: parsed.data[0], runtimeRoot: parsed.data[1], pin: parsed.data[2], sharedKnowledge: parsed.data[3], showFile: parsed.data[4] ?? null } };
};
