import { z } from "zod";
import type { AuthoredSkill } from "../domain/skill-definition.ts";
import type { SourceOrigin } from "../domain/source-origin.ts";
import { finding, pathStatus, type Outcome } from "../domain/model.ts";
import { createAuthoredMarkdownReader, type AuthoredMarkdownReader } from "./authored-markdown.ts";

const hintKey = "argument-hint";
const userKey = "user-invocable";
const skillSchema = z.strictObject({ name: z.string().regex(/^[a-z][a-z0-9-]*$/), description: z.string().trim().min(1), [hintKey]: z.string().optional(), [userKey]: z.boolean().optional(), classification: z.string().trim().min(1).optional() });
export type SkillSourceRules = { readonly path: typeof pathStatus };
export const createSkillSourceRules = (): SkillSourceRules => ({ path: pathStatus });
export const parseSkillSource = ({ text, origin, reader = createAuthoredMarkdownReader(), rules = createSkillSourceRules() }: {
  readonly text: string;
  readonly origin: SourceOrigin;
  readonly reader?: AuthoredMarkdownReader;
  readonly rules?: SkillSourceRules;
}): Outcome<AuthoredSkill> => {
  const markdown = reader.read({ text });
  if (markdown.status === "invalid") return markdown;
  const parsed = skillSchema.safeParse(markdown.value.decoded);
  if (!parsed.success) {
    const unsupported = parsed.error.issues.flatMap((issue) => issue.code === "unrecognized_keys" ? issue.keys : []);
    return { status: "invalid", findings: [finding({ code: unsupported.length > 0 ? "capability-gap" : "invalid-input", subject: origin.path, detail: unsupported.length > 0 ? `unsupported authored skill metadata: ${unsupported.join(", ")}; provide a verified native policy before projecting these fields` : parsed.error.message })] };
  }
  const root = origin.source.kind === "core" ? "core" : `plugins/${origin.source.id}`;
  if (rules.path({ path: origin.path }) === "unsafe" || origin.path !== `${root}/skills/${parsed.data.name}/SKILL.md`)
    return { status: "invalid", findings: [finding({ code: "invalid-path", subject: origin.path, detail: "skill path must agree with its source owner and authored name" })] };
  return { status: "ok", value: { origin, name: parsed.data.name, description: parsed.data.description, argumentHint: parsed.data[hintKey] ?? null, userInvocation: parsed.data[userKey] === undefined ? "native-default" : parsed.data[userKey] ? "enabled" : "disabled", classification: parsed.data.classification ?? null, header: markdown.value.header, body: markdown.value.body } };
};
