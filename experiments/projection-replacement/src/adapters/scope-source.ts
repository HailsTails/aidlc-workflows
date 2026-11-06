import { z } from "zod";
import { createAuthoredMarkdownReader, type AuthoredMarkdownReader } from "./authored-markdown.ts";
import type { AuthoredScope } from "../domain/scope-definition.ts";
import type { SourceOrigin } from "../domain/source-origin.ts";
import { finding, type Outcome } from "../domain/model.ts";
const identity = z.object({ name: z.string().regex(/^[a-z][a-z0-9-]*$/) });
export const parseScopeSource = ({ text, origin, reader = createAuthoredMarkdownReader() }: { readonly text: string; readonly origin: SourceOrigin; readonly reader?: AuthoredMarkdownReader }): Outcome<AuthoredScope> => {
  const markdown = reader.read({ text });
  if (markdown.status === "invalid") return markdown;
  const parsed = identity.safeParse(markdown.value.decoded);
  if (!parsed.success || markdown.value.body.trim().length === 0) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: origin.path, detail: "authored scope requires a canonical name and nonempty Markdown body" })] };
  if (origin.source.kind !== "core" || origin.path !== `core/scopes/aidlc-${parsed.data.name}.md`) return { status: "invalid", findings: [finding({ code: "invalid-path", subject: origin.path, detail: "this core scope source path must match its authored name; plugin scope composition requires its own source contract" })] };
  return { status: "ok", value: { origin, name: parsed.data.name, markdown: text } };
};
