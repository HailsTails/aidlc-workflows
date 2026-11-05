import { z } from "zod";
import type { AuthoredStage } from "../domain/stage-definition.ts";
import type { SourceOrigin } from "../domain/source-origin.ts";
import { finding, type Outcome } from "../domain/model.ts";
const identity = z.object({ slug: z.string().regex(/^[a-z][a-z0-9-]*$/) });
const location = z.tuple([z.string(), z.enum(["initialization", "ideation", "inception", "construction", "operation"]), z.string()]);
export const parseStageSource = ({ text, origin }: { readonly text: string; readonly origin: SourceOrigin }): Outcome<AuthoredStage> => {
  const envelope = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  const identities = Array.from((envelope?.[1] ?? "").matchAll(/^slug:\s*(.+?)\s*$/gm));
  const scalar = (identities[0]?.[1] ?? "").trim().replace(/^(["'])([a-z][a-z0-9-]*)\1$/, "$2");
  const parsed = identity.safeParse({ slug: scalar });
  if (identities.length !== 1 || !parsed.success || (envelope?.[2] ?? "").trim().length === 0) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: origin.path, detail: "authored stage requires one top-level native slug, closed frontmatter and nonempty Markdown body; native compilation owns the remaining metadata grammar" })] };
  const matched = origin.path.match(/^core\/aidlc-common\/stages\/([a-z]+)\/([a-z][a-z0-9-]*)\.md$/);
  const located = location.safeParse(matched === null ? [] : Array.from(matched));
  if (origin.source.kind !== "core" || !located.success || located.data[2] !== parsed.data.slug) return { status: "invalid", findings: [finding({ code: "invalid-path", subject: origin.path, detail: "core stage path must declare a native phase directory and match the authored slug; plugin stage sources require their own composition contract" })] };
  return { status: "ok", value: { origin, slug: parsed.data.slug, phase: located.data[1], markdown: text } };
};
