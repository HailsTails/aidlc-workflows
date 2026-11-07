import { createAuthoredMarkdownReader, type AuthoredMarkdownReader, type AuthoredMarkdown } from "./authored-markdown.ts";
import { z } from "zod";
import type { AgentOrigin, AuthoredAgentStage, AuthoredAgent } from "../domain/agent-definition.ts";
import { agentStageModes } from "../domain/stage-participation.ts";
import { finding, type Outcome } from "../domain/model.ts";

import {
  createAuthoredYaml,
  type AuthoredYaml,
} from "./authored-yaml.ts";
export type AgentYaml = AuthoredYaml;
export const createAgentYaml = createAuthoredYaml;
const slug = z.string().regex(/^[a-z][a-z0-9-]*$/);
const example = z.string().regex(/^[a-z][a-z0-9-]*\.md$/);
const yamlFieldNames: Readonly<Record<string, string>> = Object.fromEntries([
  ["name", "name"],
  ["display_name", "displayName"],
  ["plugin", "plugin"],
  ["examples", "examples"],
  ["description", "description"],
  ["disallowedTools", "disallowedTools"],
  ["tier", "tier"],
  ["model", "model"],
  ["slug", "slug"],
  ["mode", "mode"],
  ["lead_agent", "leadAgent"],
  ["support_agents", "supportAgents"],
  ["tools", "tools"],
  ["maxTurns", "maxTurns"],
  ["omitClaudeMd", "omitClaudeMd"],
  ["reviewer", "reviewer"],
]);
const translatedYamlFields = (candidate: unknown): unknown => {
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate))
    return candidate;
  return Object.fromEntries(
    Object.entries(candidate).map(([key, entry]: [string, unknown]) => [
      yamlFieldNames[key] ?? `unknown:${key}`,
      entry,
    ]),
  );
};
const agentFieldsSchema = z.strictObject({
  name: slug,
  displayName: z.string().min(1),
  plugin: slug.optional(),
  examples: z.array(example).default([]),
  description: z.string().trim().min(1),
  disallowedTools: z.literal("Task"),
  tools: z.string().transform((text) => text.split(",").map((name) => name.trim())).pipe(z.array(z.enum(["Read", "Grep", "Glob", "Bash", "Write", "Edit"])).min(1)).optional(),
  maxTurns: z.number().int().positive().optional(),
  omitClaudeMd: z.boolean().optional(),
});
const agentSchema = z.preprocess(
  translatedYamlFields,
  z.union([
    agentFieldsSchema.extend({
      tier: z.enum(["templated", "balanced", "judgment"]),
      model: z.never().optional(),
    }),
    agentFieldsSchema.extend({
      tier: z.never().optional(),
      model: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9/._:-]*$/),
    }),
  ]),
);
type Frontmatter = AuthoredMarkdown;
const agentSyntax = ({
  frontmatter,
}: {
  readonly frontmatter: string;
}): "supported" | "unsupported" => {
  const keys = frontmatter
    .split("\n")
    .filter((line) => /^[a-z]/.test(line))
    .map((line) => line.slice(0, line.indexOf(":")));
  if (new Set(keys).size !== keys.length) return "unsupported";
  return frontmatter
    .split("\n")
    .every(
      (line) =>
        line.length === 0 ||
        /^\s/.test(line) ||
        /^(?:name|display_name|plugin|examples|description):/.test(line) ||
        /^disallowedTools: Task$/.test(line) ||
        /^tier: (?:templated|balanced|judgment)$/.test(line) ||
        /^model: [a-zA-Z0-9][a-zA-Z0-9/._:-]*$/.test(line) ||
        /^maxTurns: [1-9][0-9]*$/.test(line) ||
        /^omitClaudeMd: (?:true|false)$/.test(line) ||
        /^tools: (?:Read|Grep|Glob|Bash|Write|Edit)(?:, (?:Read|Grep|Glob|Bash|Write|Edit))*$/.test(line),
    )
    ? "supported"
    : "unsupported";
};
export const parseAgentSource = ({
  text,
  origin,
  yaml = createAgentYaml(),
  reader = createAuthoredMarkdownReader({ yaml }),
}: {
  readonly text: string;
  readonly origin: AgentOrigin;
  readonly yaml?: AgentYaml;
  readonly reader?: AuthoredMarkdownReader;
}): Outcome<AuthoredAgent> => {
  const frontmatter = reader.read({ text });
  if (frontmatter.status === "invalid") return frontmatter;
  if (agentSyntax({ frontmatter: frontmatter.value.header }) === "unsupported")
    return {
      status: "invalid",
      findings: [
        finding({
          code: "invalid-input",
          subject: origin.path,
          detail:
            "unsupported agent metadata spelling; use unique plain keys and single-line tier/model/disallowedTools fields",
        }),
      ],
    };
  const parsed = agentSchema.safeParse(frontmatter.value.decoded);
  if (!parsed.success)
    return {
      status: "invalid",
      findings: [
        finding({ code: "invalid-input", subject: origin.path, detail: parsed.error.message }),
      ],
    };
  return authoredAgent({ authored: parsed.data, origin, frontmatter: frontmatter.value });
};
const authoredAgent = ({
  authored,
  origin,
  frontmatter,
}: {
  readonly authored: z.infer<typeof agentSchema>;
  readonly origin: AgentOrigin;
  readonly frontmatter: Frontmatter;
}): Outcome<AuthoredAgent> => {
  const sourceRoot = origin.source.kind === "core" ? "core" : `plugins/${origin.source.id}`;
  if (origin.path !== `${sourceRoot}/agents/${authored.name}.md`)
    return {
      status: "invalid",
      findings: [
        finding({
          code: "invalid-path",
          subject: origin.path,
          detail: "agent filename and source directory must agree with its authored name and owner",
        }),
      ],
    };
  const model =
    authored.tier === undefined
      ? ({ kind: "explicit", model: authored.model } as const)
      : ({ kind: "tier", tier: authored.tier } as const);
  const expectedPlugin = origin.source.kind === "plugin" ? origin.source.id : undefined;
  if (authored.plugin !== expectedPlugin)
    return {
      status: "invalid",
      findings: [
        finding({
          code: "foreign-content",
          subject: origin.path,
          detail: "frontmatter plugin must agree with its source owner",
        }),
      ],
    };
  return {
    status: "ok",
    value: {
      origin,
      name: authored.name,
      description: authored.description,
      examples: authored.examples,
      model,
      delegation: "leaf",
      policy: {
        tools: authored.tools === undefined ? { kind: "inherit" } : { kind: "allow", names: authored.tools },
        turnLimit: authored.maxTurns ?? null,
        ambientInstructions: authored.omitClaudeMd === true ? "omit-claude-md" : "inherit",
      },
      frontmatter: frontmatter.header,
      body: frontmatter.body,
    },
  };
};
const stageSchema = z.preprocess(
  translatedYamlFields,
  z.object({
    slug,
      mode: z.enum(agentStageModes),
    leadAgent: slug,
    supportAgents: z.array(slug).default([]),
    reviewer: slug.nullable().default(null),
  }),
);
export const parseAgentStage = ({
  text,
  origin,
  yaml = createAgentYaml(),
  reader = createAuthoredMarkdownReader({ yaml }),
}: {
  readonly text: string;
  readonly origin: AgentOrigin;
  readonly yaml?: AgentYaml;
  readonly reader?: AuthoredMarkdownReader;
}): Outcome<AuthoredAgentStage> => {
  const frontmatter = reader.read({ text });
  if (frontmatter.status === "invalid") return frontmatter;
  const parsed = stageSchema.safeParse(frontmatter.value.decoded);
  if (!parsed.success)
    return {
      status: "invalid",
      findings: [
        finding({ code: "invalid-input", subject: origin.path, detail: parsed.error.message }),
      ],
    };
  return {
    status: "ok",
    value: {
      origin,
      slug: parsed.data.slug,
      mode: parsed.data.mode,
      lead: parsed.data.leadAgent,
      supports: parsed.data.supportAgents,
      reviewer: parsed.data.reviewer,
    },
  };
};
