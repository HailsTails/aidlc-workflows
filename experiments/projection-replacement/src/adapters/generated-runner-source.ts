import { z } from "zod";
import type { GeneratedRunner, RunnerRequest } from "../domain/generated-runner.ts";
import type { HarnessBinding } from "../domain/harness-binding.ts";
import type { SourceOrigin } from "../domain/source-origin.ts";
import { finding, type Outcome, type DocumentSource } from "../domain/model.ts";
import { createAuthoredMarkdownReader, type AuthoredMarkdownReader } from "./authored-markdown.ts";

const marker = "generated-by";
const hint = "argument-hint";
const user = "user-invocable";
const disabled = "disable-model-invocation";
const schema = z.strictObject({ name: z.string().regex(/^[a-z][a-z0-9-]*$/), [marker]: z.literal("aidlc-runner-gen"), description: z.string().trim().min(1), [hint]: z.string(), [user]: z.literal(true), [disabled]: z.boolean().optional() });
export const parseGeneratedRunner = ({ markdown, compiler, owner, binding, request, reader = createAuthoredMarkdownReader() }: { readonly markdown: string; readonly compiler: SourceOrigin; readonly owner: DocumentSource; readonly binding: HarnessBinding; readonly request: RunnerRequest; readonly reader?: AuthoredMarkdownReader }): Outcome<GeneratedRunner> => {
  const framed = reader.read({ text: markdown });
  if (framed.status === "invalid") return framed;
  const parsed = schema.safeParse(framed.value.decoded);
  if (!parsed.success)
    return { status: "invalid", findings: [finding({ code: "capability-gap", subject: compiler.path, detail: `unsupported generated-runner metadata: ${parsed.error.message}` })] };
  return { status: "ok", value: { compiler, owner, binding, request, name: parsed.data.name, description: parsed.data.description, markdown: `---\n${framed.value.header}\n---\n${framed.value.body}`, frontmatterInvocation: parsed.data[disabled] === undefined ? "unspecified" : parsed.data[disabled] ? "disabled" : "enabled" } };
};
