import type { HarnessBinding } from "./harness-binding.ts";
import { finding, type Outcome } from "./model.ts";
import { residue } from "./projection-content.ts";
export type OptionLetters = "A-B" | "A-C" | "A-D" | "A-E";
export type AuthoredProseContext = HarnessBinding & { readonly preparationStage?: "before-host"; readonly invocation: string; readonly rulesSubdir: "rules" | "aidlc-rules" | "steering"; readonly optionLetters?: OptionLetters | null };
export const renderAuthoredProse = ({ markdown, context, subject }: { readonly markdown: string; readonly context: AuthoredProseContext; readonly subject: string }): Outcome<string> => {
  if (context.invocation.trim().length === 0) return { status: "invalid", findings: [finding({ code: "invalid-invocation", subject, detail: "authored prose requires the producer's native invocation" })] };
  const lettered = context.optionLetters === undefined || context.optionLetters === null ? markdown : markdown.replaceAll("{{OPTION_LETTERS}}", context.optionLetters);
  const substituted = lettered.replace(/\{\{HARNESS_DIR\}\}|\{\{INVOKE\}\}/g, (token) => token === "{{HARNESS_DIR}}" ? context.directory : context.invocation);
  const escaped = context.directory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const projected = substituted.replace(new RegExp(`${escaped}/rules/(?!default\\.rules)`, "g"), `${context.directory}/${context.rulesSubdir}/`);
  const findings = residue({ text: projected, subject });
  return findings.length > 0 ? { status: "invalid", findings } : { status: "ok", value: projected };
};
